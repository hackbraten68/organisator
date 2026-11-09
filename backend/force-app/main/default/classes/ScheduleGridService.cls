/**
 * Persistenz und Validierung der Rasterkonfiguration fuer Wochenplaene und
 * Vorlagen.
 *
 * Die Zeitbloecke liegen als versionierte JSON in GridConfig__c. Beim Speichern
 * werden bestehende Eintraege, die exakt auf einem alten Zeitblock lagen, auf
 * die neuen Zeiten verschoben. Eintraege mit abweichender Zeit (z. B.
 * Sondertermine innerhalb eines Blocks) bleiben unveraendert.
 */
global with sharing class ScheduleGridService {
    public static final String CODE_GRID_INVALID = 'GRID_INVALID';
    public static final String CODE_GRID_SLOT_IN_USE = 'GRID_SLOT_IN_USE';
    public static final String CODE_PLAN_NOT_EDITABLE = ScheduleService.CODE_PLAN_NOT_EDITABLE;
    public static final String EVENT_GRID_UPDATED = 'schedule.grid_updated';
    public static final String ACTION_UPDATED = 'updated';

    private static final Integer MAX_SLOTS = 20;
    private static final Integer MAX_ID_LENGTH = 64;
    private static final Integer MAX_TEXT_LENGTH = 500;

    global class GridSlot {
        global String id;
        global String start;
        global String endTime;
        global Integer durationMinutes;
        global String units;
        global String format;
        global String azav;
    }

    global class GridConfig {
        global Integer version;
        global List<GridSlot> slots;
    }

    /**
     * Speichert die Rasterkonfiguration eines Plans und zieht die Zeiten der
     * zugeordneten Eintraege nach. Gibt die Anzahl der verschobenen Eintraege
     * zurueck.
     */
    public static Integer saveForPlan(Id planId, String rawConfig) {
        if (planId == null) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        List<WeeklySchedule__c> plans = [
            SELECT Id, Status__c, ProgramWeek__c, GridConfig__c
            FROM WeeklySchedule__c
            WHERE Id = :planId
            LIMIT 1
        ];
        if (plans.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        WeeklySchedule__c plan = plans[0];
        if (plan.Status__c == 'Published') {
            throw new ScheduleServiceException(409, CODE_PLAN_NOT_EDITABLE,
                'Ein veroffentlichter Wochenplan kann nicht bearbeitet werden. Bitte zuerst zurueckziehen.');
        }
        ScheduleService.assertCoachAccess(plan.ProgramWeek__c);

        GridConfig config = parse(rawConfig);

        Savepoint sp = Database.setSavepoint();
        try {
            Integer changed = applyToEntries(true, plan.Id, plan.GridConfig__c, config);
            plan.GridConfig__c = serialize(config);
            update plan;
            insertAudit('WeeklySchedule__c', plan.Id);
            return changed;
        } catch (ScheduleServiceException e) {
            Database.rollback(sp);
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new ScheduleServiceException(500, ScheduleService.CODE_INTERNAL, e.getMessage());
        }
    }

    /**
     * Speichert die Rasterkonfiguration einer Vorlage und zieht die Zeiten der
     * zugeordneten Eintraege nach.
     */
    public static Integer saveForTemplate(Id templateId, String rawConfig) {
        if (templateId == null) {
            throw notFound('Die Vorlage existiert nicht.');
        }
        List<ScheduleTemplate__c> templates = [
            SELECT Id, Program__c, ProgramWeek__c, GridConfig__c
            FROM ScheduleTemplate__c
            WHERE Id = :templateId
            LIMIT 1
        ];
        if (templates.isEmpty()) {
            throw notFound('Die Vorlage existiert nicht.');
        }
        ScheduleTemplate__c template = templates[0];
        assertTemplateAccess(template);

        GridConfig config = parse(rawConfig);

        Savepoint sp = Database.setSavepoint();
        try {
            Integer changed = applyToEntries(false, template.Id, template.GridConfig__c, config);
            template.GridConfig__c = serialize(config);
            update template;
            insertAudit('ScheduleTemplate__c', template.Id);
            return changed;
        } catch (ScheduleServiceException e) {
            Database.rollback(sp);
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new ScheduleServiceException(500, ScheduleService.CODE_INTERNAL, e.getMessage());
        }
    }

    /**
     * Validiert und normalisiert die JSON-Konfiguration. Die Dauer wird aus
     * Start und Ende berechnet; die Slots werden nach Startzeit sortiert.
     */
    public static GridConfig parse(String rawConfig) {
        if (String.isBlank(rawConfig)) {
            throw invalid('Die Rasterkonfiguration fehlt.');
        }

        Object parsedValue;
        try {
            parsedValue = JSON.deserializeUntyped(rawConfig);
        } catch (Exception e) {
            throw invalid('Die Rasterkonfiguration ist nicht lesbar.');
        }
        if (!(parsedValue instanceof Map<String, Object>)) {
            throw invalid('Die Rasterkonfiguration ist nicht lesbar.');
        }
        Map<String, Object> parsed = (Map<String, Object>) parsedValue;

        Object versionValue = parsed.get('version');
        if (versionValue == null) {
            throw invalid('Die Rasterkonfiguration hat eine unbekannte Version.');
        }
        Integer version = (Integer) versionValue;
        if (version != 1) {
            throw invalid('Die Rasterkonfiguration hat eine unbekannte Version.');
        }

        Object slotsValue = parsed.get('slots');
        if (slotsValue == null) {
            throw invalid('Mindestens ein Zeitblock ist erforderlich.');
        }
        List<Object> rawSlots = (List<Object>) slotsValue;
        if (rawSlots == null || rawSlots.isEmpty()) {
            throw invalid('Mindestens ein Zeitblock ist erforderlich.');
        }
        if (rawSlots.size() > MAX_SLOTS) {
            throw invalid('Es sind hoechstens ' + MAX_SLOTS + ' Zeitbloecke erlaubt.');
        }

        List<GridSlot> slots = new List<GridSlot>();
        Set<String> ids = new Set<String>();
        for (Object rawSlot : rawSlots) {
            Map<String, Object> raw = (Map<String, Object>) rawSlot;
            GridSlot slot = new GridSlot();
            slot.id = (String) raw.get('id');
            slot.start = (String) raw.get('start');
            slot.endTime = (String) raw.get('end');
            slot.durationMinutes = (Integer) raw.get('durationMinutes');
            slot.units = (String) raw.get('units');
            slot.format = (String) raw.get('format');
            slot.azav = (String) raw.get('azav');

            if (String.isBlank(slot.id) || !Pattern.matches('^[A-Za-z0-9_-]{1,64}$', slot.id)) {
                throw invalid('Jeder Zeitblock braucht eine stabile ID aus Buchstaben, Zahlen, _ oder -.');
            }
            if (!ids.add(slot.id)) {
                throw invalid('Die Zeitblock-ID "' + slot.id + '" ist doppelt vergeben.');
            }
            Integer startMinutes = parseMinutes(slot.start);
            Integer endMinutes = parseMinutes(slot.endTime);
            if (endMinutes <= startMinutes) {
                throw invalid('Endzeit muss nach Startzeit liegen (Zeitblock ' + slot.start + '-' + slot.endTime + ').');
            }
            slot.start = formatMinutes(startMinutes);
            slot.endTime = formatMinutes(endMinutes);
            slot.durationMinutes = endMinutes - startMinutes;
            slot.units = trimToLength(slot.units, MAX_TEXT_LENGTH);
            slot.format = trimToLength(slot.format, MAX_TEXT_LENGTH);
            slot.azav = trimToLength(slot.azav, MAX_TEXT_LENGTH);
            slots.add(slot);
        }

        GridConfig config = new GridConfig();
        config.version = version;
        config.slots = slots;

        sortSlots(slots);
        for (Integer i = 1; i < slots.size(); i++) {
            GridSlot previous = slots[i - 1];
            GridSlot current = slots[i];
            if (parseMinutes(previous.endTime) > parseMinutes(current.start)) {
                throw invalid('Die Zeitbloecke duerfen sich nicht ueberschneiden.');
            }
        }
        return config;
    }

    public static String serialize(GridConfig config) {
        if (config == null) {
            return null;
        }
        Map<String, Object> configMap = new Map<String, Object>();
        configMap.put('version', config.version);
        List<Object> slots = new List<Object>();
        for (GridSlot slot : config.slots) {
            Map<String, Object> slotMap = new Map<String, Object>();
            slotMap.put('id', slot.id);
            slotMap.put('start', slot.start);
            slotMap.put('end', slot.endTime);
            slotMap.put('durationMinutes', slot.durationMinutes);
            slotMap.put('units', slot.units);
            slotMap.put('format', slot.format);
            slotMap.put('azav', slot.azav);
            slots.add(slotMap);
        }
        configMap.put('slots', slots);
        return JSON.serialize(configMap);
    }

    private static Integer applyToEntries(
        Boolean isPlan,
        Id parentId,
        String oldRawConfig,
        GridConfig newConfig
    ) {
        GridConfig oldConfig = null;
        if (String.isNotBlank(oldRawConfig)) {
            try {
                oldConfig = parse(oldRawConfig);
            } catch (ScheduleServiceException e) {
                oldConfig = null;
            }
        }

        List<GridSlot> oldSlots = oldConfig == null ? new List<GridSlot>() : oldConfig.slots;
        Map<String, GridSlot> oldById = new Map<String, GridSlot>();
        for (GridSlot slot : oldSlots) {
            oldById.put(slot.id, slot);
        }
        Map<String, GridSlot> newById = new Map<String, GridSlot>();
        for (GridSlot slot : newConfig.slots) {
            newById.put(slot.id, slot);
        }

        List<ScheduleEntry__c> entries = isPlan
            ? [
                SELECT Id, Name, DayOfWeek__c, TimeSlotId__c, StartTime__c, EndTime__c, DurationMinutes__c
                FROM ScheduleEntry__c
                WHERE WeeklySchedule__c = :parentId
            ]
            : [
                SELECT Id, Name, DayOfWeek__c, TimeSlotId__c, StartTime__c, EndTime__c, DurationMinutes__c
                FROM ScheduleEntry__c
                WHERE ScheduleTemplate__c = :parentId
            ];

        for (ScheduleEntry__c entry : entries) {
            if (String.isNotBlank(entry.TimeSlotId__c)
                    && oldById.containsKey(entry.TimeSlotId__c)
                    && !newById.containsKey(entry.TimeSlotId__c)) {
                throw new ScheduleServiceException(409, CODE_GRID_SLOT_IN_USE,
                    'Der Zeitblock "' + oldById.get(entry.TimeSlotId__c).start + '-' + oldById.get(entry.TimeSlotId__c).endTime
                    + '" wird noch von Eintraegen verwendet und kann nicht entfernt werden.');
            }
        }

        List<ScheduleEntry__c> updates = new List<ScheduleEntry__c>();
        for (ScheduleEntry__c entry : entries) {
            Boolean changed = false;

            if (String.isBlank(entry.TimeSlotId__c) && entry.StartTime__c != null && entry.EndTime__c != null) {
                GridSlot oldMatch = findExact(oldSlots, entry.StartTime__c, entry.EndTime__c);
                if (oldMatch != null && newById.containsKey(oldMatch.id)) {
                    entry.TimeSlotId__c = oldMatch.id;
                    changed = true;
                } else {
                    GridSlot newMatch = findExact(newConfig.slots, entry.StartTime__c, entry.EndTime__c);
                    if (newMatch != null) {
                        entry.TimeSlotId__c = newMatch.id;
                        changed = true;
                    }
                }
            }

            if (String.isNotBlank(entry.TimeSlotId__c) && newById.containsKey(entry.TimeSlotId__c)) {
                GridSlot oldSlot = oldById.get(entry.TimeSlotId__c);
                GridSlot newSlot = newById.get(entry.TimeSlotId__c);
                if (oldSlot != null
                        && (oldSlot.start != newSlot.start || oldSlot.endTime != newSlot.endTime)
                        && entry.StartTime__c != null
                        && entry.EndTime__c != null
                        && entry.StartTime__c == ScheduleService.parseTime(oldSlot.start)
                        && entry.EndTime__c == ScheduleService.parseTime(oldSlot.endTime)) {
                    entry.StartTime__c = ScheduleService.parseTime(newSlot.start);
                    entry.EndTime__c = ScheduleService.parseTime(newSlot.endTime);
                    entry.DurationMinutes__c = newSlot.durationMinutes;
                    changed = true;
                }
            }

            if (changed) {
                updates.add(entry);
            }
        }

        if (!updates.isEmpty()) {
            update updates;
        }
        return updates.size();
    }

    private static GridSlot findExact(List<GridSlot> slots, Time startTime, Time endTime) {
        for (GridSlot slot : slots) {
            if (ScheduleService.parseTime(slot.start) == startTime
                    && ScheduleService.parseTime(slot.endTime) == endTime) {
                return slot;
            }
        }
        return null;
    }

    private static void sortSlots(List<GridSlot> slots) {
        for (Integer i = 0; i < slots.size() - 1; i++) {
            for (Integer j = 0; j < slots.size() - 1 - i; j++) {
                if (compareSlots(slots[j], slots[j + 1]) > 0) {
                    GridSlot temp = slots[j];
                    slots[j] = slots[j + 1];
                    slots[j + 1] = temp;
                }
            }
        }
    }

    private static Integer compareSlots(GridSlot left, GridSlot right) {
        Integer leftStart = parseMinutes(left.start);
        Integer rightStart = parseMinutes(right.start);
        if (leftStart != rightStart) {
            return leftStart - rightStart;
        }
        return left.id.compareTo(right.id);
    }

    private static Integer parseMinutes(String value) {
        if (String.isBlank(value)) {
            throw invalid('Jeder Zeitblock braucht Start- und Endzeit.');
        }
        try {
            Time parsed = ScheduleService.parseTime(value);
            return parsed.hour() * 60 + parsed.minute();
        } catch (Exception e) {
            throw invalid('Die Zeitangabe "' + value + '" ist nicht lesbar.');
        }
    }

    private static String formatMinutes(Integer minutes) {
        if (minutes == null || minutes < 0 || minutes >= 24 * 60) {
            throw invalid('Die Zeitangabe liegt ausserhalb des Tages.');
        }
        Integer hour = minutes / 60;
        Integer minute = Math.mod(minutes, 60);
        return twoDigits(hour) + ':' + twoDigits(minute);
    }

    private static String twoDigits(Integer value) {
        return value < 10 ? '0' + value : String.valueOf(value);
    }

    private static String trimToLength(String value, Integer maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) {
            throw invalid('Ein Text in der Rasterkonfiguration ist zu lang.');
        }
        return trimmed;
    }

    private static void assertTemplateAccess(ScheduleTemplate__c template) {
        if (template.ProgramWeek__c != null) {
            ScheduleService.assertCoachAccess(template.ProgramWeek__c);
            return;
        }
        if (template.Program__c == null || ProgramCoachService.isStaffUser(UserInfo.getUserId())) {
            return;
        }
        if (!ProgramCoachService.isAssignedToProgram(template.Program__c, UserInfo.getUserId())) {
            throw new ScheduleServiceException(403, ScheduleService.CODE_NOT_ASSIGNED,
                'Sie sind diesem Programm nicht zugeordnet.');
        }
    }

    private static void insertAudit(String subjectType, Id subjectId) {
        AuditEvent__c audit = ScheduleService.buildAudit(ACTION_UPDATED, EVENT_GRID_UPDATED, subjectType, subjectId, null);
        Database.SaveResult result = Database.insert(audit, false);
        if (!result.isSuccess()) {
            throw new ScheduleServiceException(500, ScheduleService.CODE_AUDIT_FAILED,
                'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.');
        }
    }

    private static ScheduleServiceException invalid(String message) {
        return new ScheduleServiceException(400, CODE_GRID_INVALID, message);
    }

    private static ScheduleServiceException notFound(String message) {
        return new ScheduleServiceException(404, ScheduleService.CODE_SCHEDULE_NOT_FOUND, message);
    }
}
