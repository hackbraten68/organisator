Perfekt! 🎉

Die neue Scratch Org wurde erfolgreich erstellt:

OrgId:    00D9b00000d4Gsi
Alias:    backendtest
Username: test-wfcaih57il7r@example.com
Status:   Active


Das ist genau der richtige Zeitpunkt für ein Troubleshooting-Dokument.

AGENTS-SCRATCH-ORG-TROUBLESHOOTING.md
# Sprint 1 Troubleshooting Log

Date: 2026-09-24

## Context

Project:

/home/sam/github/organisator/backend

Objects created:

- Program__c
- Participant__c
- CoachProfile__c

Participant fields:

- Status__c
- Email__c
- Discord__c
- Github__c
- StartDate__c
- ExpectedEndDate__c
- Program__c Lookup
- CoachProfile__c Lookup
- Contact__c Lookup

---

# Problem

Custom fields appeared correctly in:

- Object Manager
- Tooling API
- Metadata Retrieval
- Deployment Result

but did NOT appear in:

- SOQL
- REST Describe API
- sf sobject describe

Example:

```sql
SELECT Id, Name, Status__c
FROM Participant__c


returned:

No such column 'Status__c'

Evidence
Tooling API

Worked:

sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName, DataType
FROM FieldDefinition
WHERE EntityDefinition.QualifiedApiName='Participant__c'
"


Fields returned:

Status__c
Email__c
Discord__c
Github__c
Program__c
CoachProfile__c
Contact__c
EntityParticle

Worked:

sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName
FROM EntityParticle
WHERE EntityDefinition.QualifiedApiName='Participant__c'
"


Returned all custom fields.

Object Manager

Setup → Object Manager → Participant → Fields & Relationships

All custom fields visible.

Metadata Retrieve

Worked:

sf project retrieve start \
  --metadata CustomObject:Participant__c \
  --target-org backendtest


Retrieved:

Participant__c
Status__c
Email__c
Program__c
CoachProfile__c
Contact__c
Critical Discovery

REST Describe endpoint:

/services/data/v67.0/sobjects/Participant__c/describe


returned ONLY:

Id
OwnerId
IsDeleted
Name
CreatedDate
CreatedById
LastModifiedDate
LastModifiedById
SystemModstamp
LastActivityDate

NONE of the custom fields appeared.

Therefore:

Metadata Layer ✅ correct

Runtime Describe Layer ❌ incorrect

Workarounds Attempted
Save object without changes

Setup → Object Manager → Participant → Edit → Save

Result:

No change.

Full object deploy
sf project deploy start \
  --source-dir force-app/main/default/objects \
  --target-org backendtest \
  --ignore-conflicts


Result:

Successful deployment.

Runtime problem remained.

Contact lookup

Salesforce CLI generator did not initially offer Contact.

Manual metadata file used:

Contact__c.field-meta.xml

Deployment successful.

Contact field visible in Tooling API and Object Manager.

Conclusion

Scratch Org became inconsistent.

Metadata layer and runtime layer diverged.

Factory reset of the Scratch Org was chosen instead of further debugging.

New Scratch Org

Created:

sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias backendtest \
  --set-default \
  --target-dev-hub test


Result:

OrgId: 00D9b00000d4Gsi
Alias: backendtest
Status: Active

Scratch Org Definition

Path:

config/project-scratch-def.json

Contents:

{
  "orgName": "Organisator",
  "edition": "Developer",
  "features": [],
  "settings": {
    "lightningExperienceSettings": {
      "enableS1DesktopEnabled": true
    }
  }
}

Next Step

Deploy academy objects again:

sf project deploy start \
  --source-dir force-app/main/default/objects \
  --target-org backendtest


Verify:

sf sobject describe \
  --sobject Participant__c \
  --target-org backendtest \
  --json | jq -r '.result.fields[].name'


Expected:

Status__c
Email__c
Discord__c
Github__c
Program__c
CoachProfile__c
Contact__c

If visible:

Proceed with test data creation and Flow development.


---

# Dein nächster Schritt

Jetzt sofort:

```bash
cd /home/sam/github/organisator/backend


Deploy der Objekte:

sf project deploy start \
  --source-dir force-app/main/default/objects \
  --target-org backendtest


Danach prüfen:

sf sobject describe \
  --sobject Participant__c \
  --target-org backendtest \
  --json > participant.json

cat participant.json | jq -r '.result.fields[].name' | grep '__c'


Bevor wir irgendetwas anderes machen, möchte ich genau diese Ausgabe sehen.

Wenn dort diesmal die Custom Fields auftauchen, ist die neue Org gesund und wir können direkt mit:

Participant Testdaten
↓
Opportunity → Participant Flow
↓
LearningPath__c


weitermachen.
