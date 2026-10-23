/**
 * Guard fuer ScheduleEntry__c.
 *
 * before insert/update: Eltern-Zuordnung, Date__c aus WeeklySchedule__c.StartDate__c + DayOfWeek__c,
 * Start < Ende, TargetType ↔ Participant__c/ParticipantGroup__c, Plausibilitaet.
 */
trigger ScheduleEntryGuard on ScheduleEntry__c (before insert, before update) {
    Set<Id> scheduleIds = new Set<Id>();
    for (ScheduleEntry__c entry : Trigger.new) {
        if (entry.WeeklySchedule__c != null) {
            scheduleIds.add(entry.WeeklySchedule__c);
        }
    }

    Map<Id, WeeklySchedule__c> schedules = new Map<Id, WeeklySchedule__c>();
    if (!scheduleIds.isEmpty()) {
        schedules = new Map<Id, WeeklySchedule__c>(
            [SELECT Id, StartDate__c FROM WeeklySchedule__c WHERE Id IN :scheduleIds]
        );
    }

    for (ScheduleEntry__c entry : Trigger.new) {
        Boolean hasWeekly = entry.WeeklySchedule__c != null;
        Boolean hasTemplate = entry.ScheduleTemplate__c != null;

        if (!hasWeekly && !hasTemplate) {
            entry.addError('Eine Planzeile muss entweder einem Wochenplan oder einer Vorlage zugeordnet sein.');
            continue;
        }
        if (hasWeekly && hasTemplate) {
            entry.addError('Eine Planzeile muss entweder einem Wochenplan oder einer Vorlage zugeordnet sein.');
            continue;
        }

        if (hasTemplate) {
            entry.Date__c = null;
        }

        if (hasWeekly) {
            if (String.isNotBlank(entry.DayOfWeek__c)) {
                WeeklySchedule__c schedule = schedules.get(entry.WeeklySchedule__c);
                if (schedule != null && schedule.StartDate__c != null) {
                    Integer offset = ScheduleService.dayOffset(entry.DayOfWeek__c);
                    entry.Date__c = schedule.StartDate__c.addDays(offset);
                }
            }
        }

        String targetType = entry.TargetType__c;
        if (String.isNotBlank(targetType)) {
            if (targetType == 'Course') {
                if (entry.ParticipantGroup__c != null || entry.Participant__c != null) {
                    entry.addError('Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
                    continue;
                }
            } else if (targetType == 'Group') {
                if (entry.ParticipantGroup__c == null || entry.Participant__c != null) {
                    entry.addError('Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
                    continue;
                }
            } else if (targetType == 'Individual') {
                if (entry.Participant__c == null || entry.ParticipantGroup__c != null) {
                    entry.addError('Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
                    continue;
                }
            }
        }

        if (Trigger.isUpdate && entry.WeeklySchedule__c != null) {
            ScheduleEntry__c oldEntry = Trigger.oldMap.get(entry.Id);
            if (oldEntry != null && oldEntry.IsCustomized__c == false) {
                Boolean changed = false;
                if (entry.Name != oldEntry.Name) changed = true;
                else if (entry.Description__c != oldEntry.Description__c) changed = true;
                else if (entry.EntryKind__c != oldEntry.EntryKind__c) changed = true;
                else if (entry.Type__c != oldEntry.Type__c) changed = true;
                else if (entry.IsRequired__c != oldEntry.IsRequired__c) changed = true;
                else if (entry.DayOfWeek__c != oldEntry.DayOfWeek__c) changed = true;
                else if (entry.StartTime__c != oldEntry.StartTime__c) changed = true;
                else if (entry.EndTime__c != oldEntry.EndTime__c) changed = true;
                else if (entry.DurationMinutes__c != oldEntry.DurationMinutes__c) changed = true;
                else if (entry.TargetType__c != oldEntry.TargetType__c) changed = true;
                else if (entry.ParticipantGroup__c != oldEntry.ParticipantGroup__c) changed = true;
                else if (entry.Participant__c != oldEntry.Participant__c) changed = true;
                else if (entry.Coach_Profile__c != oldEntry.Coach_Profile__c) changed = true;
                else if (entry.Location__c != oldEntry.Location__c) changed = true;
                else if (entry.MeetingLink__c != oldEntry.MeetingLink__c) changed = true;
                else if (entry.Order__c != oldEntry.Order__c) changed = true;
                else if (entry.DeviationReason__c != oldEntry.DeviationReason__c) changed = true;
                else if (entry.Notes__c != oldEntry.Notes__c) changed = true;
                if (changed) {
                    entry.IsCustomized__c = true;
                }
            }
        }

        if (entry.StartTime__c != null && entry.EndTime__c == null) {
            entry.addError('Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
            continue;
        }
        if (entry.StartTime__c == null && entry.EndTime__c != null) {
            entry.addError('Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
            continue;
        }
        if (entry.StartTime__c != null && entry.EndTime__c != null) {
            if (entry.EndTime__c <= entry.StartTime__c) {
                entry.addError('Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
                continue;
            }
        }
        if (entry.DurationMinutes__c != null && entry.DurationMinutes__c < 1) {
            entry.addError('Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
            continue;
        }
    }
}
