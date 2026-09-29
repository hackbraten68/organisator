/**
 * Runtime schema health check.
 *
 * WHY THIS EXISTS
 * A deploy reporting "Succeeded" does not mean the custom fields reached the
 * runtime schema. In this org family the Metadata API, the Tooling API and the
 * deploy report all agree a field exists, while SOQL, REST describe and Apex
 * all report "No such column" and `sf project retrieve` returns nothing.
 * The only source we trust is the runtime schema itself.
 *
 * See docs/AGENTS-salesforce-runtime-schema-troubleshooting.md (root cause
 * and the manual-recovery procedure) for the full history.
 *
 * OUTPUT
 * One machine-readable line per check so scripts/schema-check.mjs can compare
 * the org against the repository:
 *
 *   OBJ|<object>|<customFieldCount>
 *   OBJ|<object>|ABSENT
 *   FIELD|<object>|<fieldApiName>|PRESENT
 *   SOQL|<object>|OK|<detail>
 *   SOQL|<object>|FAIL|<errorMessage>
 *   NEWOBJ|<object>|OK
 *   NEWOBJ|<object>|FAIL|<errorMessage>
 *   INSERT|<object>|SUCCESS|<id>
 *   INSERT|<object>|FAIL:<errorMessage>
 *   INSERT|<object>|SKIPPED:<errorMessage>
 *   SUMMARY|objects=<n>|fields=<n>|soqlFailures=<n>|newObjFailures=<n>|insertFailures=<n>
 *
 * INSERT results are advisory. A failure whose message mentions a missing or
 * invalid field is the bug signature and is counted as a failure; any other
 * failure is reported as SKIPPED because it is usually a business rule (a
 * required field, a picklist default) and not a schema defect.
 *
 * USAGE
 *   sf apex run --target-org organiser-dev --file scripts/schema-check.apex
 */

List<String> OBJECT_NAMES = new List<String>{
  'Account',
  'Participant__c',
  'Coach_Profile__c',
  'Program__c',
  'Learning_Path__c',
  'Module__c',
  'Appointment__c',
  'Absence__c',
  'AuditEvent__c',
  'AvailabilitySlot__c',
  'AuditOutbox__c'
};

String report = '';
Integer fieldCount = 0;
Integer soqlFailures = 0;
Integer newObjFailures = 0;
Integer insertFailures = 0;
Integer missingObjects = 0;

for (Integer i = 0; i < OBJECT_NAMES.size(); i++) {
  String objectName = OBJECT_NAMES[i];
  Schema.SObjectType sobjectType = Schema.getGlobalDescribe().get(objectName);

  // A deploy that was rolled back (or an object that never materialised)
  // leaves the type absent. Report it instead of dereferencing null, which
  // used to abort the whole probe and hide the more useful rows.
  if (sobjectType == null) {
    report += 'OBJ|' + objectName + '|ABSENT\n';
    report +=
      'NEWOBJ|' +
      objectName +
      '|FAIL|object not present in the runtime schema\n';
    missingObjects++;
    continue;
  }

  Map<String, Schema.SObjectField> fieldMap = sobjectType.getDescribe()
    .fields.getMap();

  List<String> customFields = new List<String>();
  for (String fieldName : fieldMap.keySet()) {
    if (fieldName.endsWith('__c')) {
      customFields.add(fieldName);
    }
  }
  customFields.sort();

  report += 'OBJ|' + objectName + '|' + customFields.size() + '\n';
  for (Integer j = 0; j < customFields.size(); j++) {
    report += 'FIELD|' + objectName + '|' + customFields[j] + '|PRESENT\n';
  }
  fieldCount += customFields.size();

  // SOQL proves the field is usable by a query, not merely listed by describe.
  if (customFields.isEmpty()) {
    report += 'SOQL|' + objectName + '|OK|no custom fields\n';
  } else {
    try {
      List<sObject> probe = Database.query(
        'SELECT Id, ' +
          String.join(customFields, ', ') +
          ' FROM ' +
          objectName +
          ' LIMIT 1'
      );
      report += 'SOQL|' + objectName + '|OK|' + probe.size() + ' row(s)\n';
    } catch (Exception queryError) {
      soqlFailures++;
      report +=
        'SOQL|' +
        objectName +
        '|FAIL|' +
        queryError.getMessage().replaceAll('\\s+', ' ') +
        '\n';
    }
  }

  // newSObject proves the object can still be constructed with its fields.
  try {
    sobjectType.newSObject();
    report += 'NEWOBJ|' + objectName + '|OK\n';
  } catch (Exception constructError) {
    newObjFailures++;
    report +=
      'NEWOBJ|' +
      objectName +
      '|FAIL|' +
      constructError.getMessage().replaceAll('\\s+', ' ') +
      '\n';
  }

  // Insert is advisory: separates the bug signature from ordinary business rules.
  try {
    sObject probe = sobjectType.newSObject();
    insert probe;
    report += 'INSERT|' + objectName + '|SUCCESS|' + probe.get('Id') + '\n';
    delete probe;
  } catch (Exception insertError) {
    String message = insertError.getMessage().replaceAll('\\s+', ' ');
    String lower = message.toLowerCase();
    Boolean looksLikeSchemaDefect =
      lower.contains('no such column') ||
      lower.contains('invalid field') ||
      lower.contains('unknown field') ||
      lower.contains('does not exist');
    if (looksLikeSchemaDefect) {
      insertFailures++;
      report += 'INSERT|' + objectName + '|FAIL:' + message + '\n';
    } else {
      report += 'INSERT|' + objectName + '|SKIPPED:' + message + '\n';
    }
  }
}

report +=
  'SUMMARY|objects=' +
  OBJECT_NAMES.size() +
  '|fields=' +
  fieldCount +
  '|soqlFailures=' +
  soqlFailures +
  '|newObjFailures=' +
  newObjFailures +
  '|insertFailures=' +
  insertFailures +
  '|missingObjects=' +
  missingObjects;

System.debug(report);
