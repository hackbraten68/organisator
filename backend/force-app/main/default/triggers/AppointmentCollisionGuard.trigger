/**
 * Prevents overlapping appointments on a coach's calendar (ADR-016).
 *
 * WHY A TRIGGER
 *   The protection has to sit on the object, not in a service: it must see
 *   every way a record can be written — the UI API, the named Apex entry
 *   point, a data loader, another client. A check in the application layer
 *   protects only the path that happens to go through it, and the release
 *   boundary of this project promises exactly the opposite.
 *
 * SCOPE
 *   - before insert: every new appointment is checked.
 *   - before update: only when a collision-relevant field changed. The
 *     relevant fields are `Coach__c`, `StartTime__c`, `EndTime__c` and the
 *     status insofar as it moves in or out of a blocking status. An update to
 *     anything else — a note, a type, a meeting link — must not fail because
 *     a historical record is part of an overlap.
 *
 * THE RULE
 *   Two appointments collide when
 *   `existingStart < candidateEnd AND existingEnd > candidateStart`.
 *   Windows that only touch do not overlap, so the coach can start the next
 *   appointment right after the last one.
 *
 *   The scope of a collision is the coach, not the participant. The same coach
 *   cannot be in two appointments at once, whoever the participants are.
 *
 *   `Cancelled` frees a time and every other status occupies it — including
 *   `NoShow`, where the slot really was taken.
 *
 * BEFORE, NOT AFTER
 *   A conflict has to be found before the record is written. A rejected write
 *   leaves the record exactly as it was; there is no half-saved appointment
 *   to repair afterwards.
 *
 * NO BYPASS
 *   There is no switch, no metadata flag and no administrator path in this
 *   trigger. A later exception route is its own decision with its own
 *   permission, its own reason field and its own audit trail (ADR-016).
 *
 * BULK
 *   One query for the whole batch, never one per row. Conflicts inside the
 *   batch are found by comparing the candidates with each other, so a bulk
 *   insert of two overlapping appointments is rejected just like two single
 *   inserts.
 */
trigger AppointmentCollisionGuard on Appointment__c(before insert, before update) {
    // ---- 1. Das Intervall dort pruefen, wo Zeiten geschrieben werden ----
    // Ein historischer Termin mit ungueltigem Intervall bleibt, wie er ist:
    // eine sachfremde Aenderung an ihm darf nicht daran scheitern. Neu
    // geschriebene Zeiten dagegen muessen ein gueltiges Intervall ergeben.
    for (Appointment__c row : Trigger.new) {
        Appointment__c before = Trigger.isUpdate ? Trigger.oldMap.get(row.Id) : null;
        if (!AppointmentCollisionService.writesTimes(before, row)) {
            continue;
        }
        if (row.StartTime__c == null || row.EndTime__c == null) {
            // Pflichtfelder: die Plattform meldet das genauer und ohne
            // Umweg ueber diesen Waelter.
            continue;
        }
        if (row.StartTime__c >= row.EndTime__c) {
            throw new AppointmentConflictException(
                AppointmentConflictException.messageForInvalidInterval()
            );
        }
    }

    // ---- 2. Die Kandidaten sammeln ----
    List<Appointment__c> candidates = new List<Appointment__c>();
    for (Appointment__c row : Trigger.new) {
        if (!AppointmentCollisionService.isBlocking(row.Status__c)) {
            continue;
        }
        if (row.Coach__c == null) {
            // Ohne Coach gibt es keinen Slot, der belegt werden koennte.
            continue;
        }
        if (row.StartTime__c == null || row.EndTime__c == null) {
            // Pflichtfelder: die Plattform meldet das genauer und ohne
            // Umweg ueber diesen Waelter.
            continue;
        }
        if (Trigger.isUpdate) {
            Appointment__c before = Trigger.oldMap.get(row.Id);
            if (before == null) {
                continue;
            }
            if (!AppointmentCollisionService.isCollisionRelevantChange(before, row)) {
                continue;
            }
        }
        candidates.add(row);
    }
    if (candidates.isEmpty()) {
        return;
    }

    // ---- 3. Die gespeicherten Termine laden: eine Query fuer den ganzen Batch ----
    Set<Id> coachIds = new Set<Id>();
    Set<Id> batchIds = new Set<Id>();
    Datetime earliest = null;
    Datetime latest = null;
    for (Appointment__c row : candidates) {
        coachIds.add(row.Coach__c);
        if (row.Id != null) {
            batchIds.add(row.Id);
        }
        if (earliest == null || row.StartTime__c < earliest) {
            earliest = row.StartTime__c;
        }
        if (latest == null || row.EndTime__c > latest) {
            latest = row.EndTime__c;
        }
    }
    if (earliest == null || latest == null) {
        return;
    }

    // Die Query laeuft ohne Sharing: der Waechter muss den ganzen Kalender
    // des Coachs sehen, unabhaengig davon, wer schreibt.
    List<Appointment__c> stored = AppointmentCollisionService.findStoredAppointments(
        coachIds,
        earliest,
        latest
    );

    // ---- 4. Pruefen: gegen die gespeicherten Termine und gegen den Batch selbst ----
    for (Integer i = 0; i < candidates.size(); i++) {
        Appointment__c row = candidates[i];

        // 4a. Die gespeicherten Termine. Der eigene Datensatz und alle
        // anderen Datensaetze desselben Batches sind ausgenommen: sie werden
        // batch-intern geprueft, und ihre alte Fassung sagt nichts ueber die
        // neue aus.
        for (Appointment__c other : stored) {
            if (batchIds.contains(other.Id)) {
                continue;
            }
            if (other.Coach__c != row.Coach__c) {
                continue;
            }
            if (!AppointmentCollisionService.overlaps(
                row.StartTime__c,
                row.EndTime__c,
                other.StartTime__c,
                other.EndTime__c
            )) {
                continue;
            }
            System.debug(
                LoggingLevel.ERROR,
                'AppointmentCollisionGuard: Zeitkonflikt. Coach ' +
                row.Coach__c +
                ', Kandidat ' +
                row.Id +
                ' (' +
                row.StartTime__c +
                ' bis ' +
                row.EndTime__c +
                ') kollidiert mit ' +
                other.Id +
                ' (' +
                other.StartTime__c +
                ' bis ' +
                other.EndTime__c +
                ').'
            );
            throw new AppointmentConflictException(
                AppointmentConflictException.messageForTimeConflict()
            );
        }

        // 4b. Die anderen Kandidaten desselben Batches. Ueber den Index
        // verglichen, nicht ueber die Id: bei einem Insert haben beide keine.
        for (Integer j = 0; j < candidates.size(); j++) {
            if (i == j) {
                continue;
            }
            Appointment__c other = candidates[j];
            if (other.Coach__c != row.Coach__c) {
                continue;
            }
            if (!AppointmentCollisionService.overlaps(
                row.StartTime__c,
                row.EndTime__c,
                other.StartTime__c,
                other.EndTime__c
            )) {
                continue;
            }
            System.debug(
                LoggingLevel.ERROR,
                'AppointmentCollisionGuard: Zeitkonflikt innerhalb eines Batches. Coach ' +
                row.Coach__c +
                ', Kandidat ' +
                row.Id +
                ' (' +
                row.StartTime__c +
                ' bis ' +
                row.EndTime__c +
                ') kollidiert mit ' +
                other.Id +
                ' (' +
                other.StartTime__c +
                ' bis ' +
                other.EndTime__c +
                ').'
            );
            throw new AppointmentConflictException(
                AppointmentConflictException.messageForTimeConflict()
            );
        }
    }
}
