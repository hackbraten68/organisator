# AGENTS: Salesforce Runtime Schema Troubleshooting

## Purpose

This document records the troubleshooting performed after the previous `AGENTS.md` entry while building the Salesforce backend for the **Organisator** participant-management platform.

It documents:

- the custom objects and fields involved;
- the symptoms observed after successful metadata deployments;
- the diagnostic commands used;
- the hypotheses that were tested and rejected;
- the confirmed root cause;
- the recovery procedure;
- the final verification results;
- rules to follow when extending the Salesforce schema.

This file is intended to be merged into the main `AGENTS.md` later.

---

## Project context

Project root:

```text
/home/sam/github/organisator/backend
```

Salesforce project structure:

```text
backend/
├── config/
│   └── project-scratch-def.json
├── force-app/
│   └── main/
│       └── default/
│           └── objects/
└── sfdx-project.json
```

Target scratch-org alias:

```text
backendtest
```

Dev Hub alias used to create the replacement scratch org:

```text
test
```

Salesforce metadata API version:

```text
67.0
```

---

## Intended Sprint 1 data model

```text
Program__c
Participant__c
Coach_Profile__c
```

> Important: the manually recreated coach object uses the API name `Coach_Profile__c`. This differs from the earlier generated object name `CoachProfile__c`.

### Program fields

```text
Program__c
├── DurationWeeks__c    Number(2,0)
└── Description__c      Long Text Area(32768)
```

### Participant fields

```text
Participant__c
├── Status__c            Picklist
├── Email__c             Email
├── Discord__c           Text(255)
├── GitHub__c            Text(255)
├── StartDate__c         Date
├── ExpectedEndDate__c   Date
├── Program__c           Lookup(Program__c)
├── Coach_Profile__c     Lookup(Coach_Profile__c)
└── Contact__c           Lookup(Contact)
```

`Status__c` values:

```text
Onboarding
Active
Paused
Graduated
Placed
Dropped
```

Default value:

```text
Onboarding
```

Lookup deletion behavior selected for academy references:

```text
Clear the value of this field.
```

This avoids deleting Participant records when a referenced Program, Coach Profile, or Contact is removed.

---

## Original symptom

Custom fields were generated locally and deployed successfully. Salesforce reported the fields as created, and the fields were visible in several metadata-oriented surfaces.

However, normal Salesforce runtime APIs could not use them.

Example failure:

```bash
sf data query \
  --target-org backendtest \
  --query "SELECT Id, Name, Status__c FROM Participant__c"
```

Returned:

```text
No such column 'Status__c' on entity 'Participant__c'
```

The same problem occurred with other custom fields, including:

```text
Participant__c.Email__c
Program__c.DurationWeeks__c
Program__c.Description__c
```

Records could still be created using only standard fields:

```bash
sf data create record \
  --target-org backendtest \
  --sobject Participant__c \
  --values "Name='Test Participant'"
```

This proved that the custom object itself existed and was operational, while its custom fields were unavailable to the runtime schema.

---

## Contradictory diagnostic results

### Metadata deployment succeeded

Deployments completed successfully and listed all custom fields as created or unchanged.

```bash
sf project deploy start \
  --source-dir force-app/main/default/objects/Participant__c \
  --target-org backendtest
```

A wider deployment also succeeded:

```bash
sf project deploy start \
  --source-dir force-app/main/default/objects \
  --target-org backendtest \
  --ignore-conflicts
```

### Metadata retrieve succeeded

The object and fields could be retrieved from the org:

```bash
sf project retrieve start \
  --metadata CustomObject:Participant__c \
  --target-org backendtest
```

The retrieve returned all expected fields, including:

```text
Participant__c.Status__c
Participant__c.Email__c
Participant__c.Program__c
Participant__c.CoachProfile__c
Participant__c.Contact__c
```

### Tooling API FieldDefinition showed the fields

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName, DataType
FROM FieldDefinition
WHERE EntityDefinition.QualifiedApiName='Participant__c'
ORDER BY QualifiedApiName"
```

The output included the custom fields.

### Tooling API EntityParticle showed the fields

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName
FROM EntityParticle
WHERE EntityDefinition.QualifiedApiName='Participant__c'
ORDER BY QualifiedApiName"
```

This returned fields such as:

```text
CoachProfile__c
Contact__c
Discord__c
Email__c
ExpectedEndDate__c
Github__c
Program__c
StartDate__c
Status__c
```

### Object Manager showed the fields

The fields were visible under:

```text
Setup
└── Object Manager
    └── Participant
        └── Fields & Relationships
```

### Runtime Describe did not show the fields

```bash
sf sobject describe \
  --sobject Participant__c \
  --target-org backendtest \
  --json > participant.json

cat participant.json | jq -r '.result.fields[].name'
```

The result initially contained only standard fields:

```text
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
```

No Participant custom fields appeared.

### Direct REST Describe confirmed the runtime issue

The REST endpoint for `Participant__c/describe` also returned only standard fields. This ruled out a problem limited to the `sf` CLI command wrapper.

The mismatch was therefore:

```text
Metadata deployment       OK
Metadata retrieve         OK
Object Manager            OK
Tooling FieldDefinition   OK
Tooling EntityParticle    OK
REST/SObject Describe     FAILED to expose custom fields
Normal SOQL               FAILED to resolve custom fields
```

---

## Troubleshooting attempts that did not resolve the issue

### Saving the object without changes

The following UI workaround was attempted:

```text
Setup
→ Object Manager
→ Participant
→ Edit
→ Save
```

Saving without changing the object did not publish the Participant fields to the runtime schema.

### Redeploying all object metadata

```bash
sf project deploy start \
  --source-dir force-app/main/default/objects \
  --target-org backendtest \
  --ignore-conflicts
```

The deployment succeeded, but Runtime Describe and SOQL still did not expose the fields.

### Retrieving the objects again

Retrieving the objects and fields proved that Salesforce had stored the metadata, but did not fix runtime visibility.

### Recreating the scratch org alone

A completely new scratch org was created and the same project metadata was deployed. The problem was reproducible, proving that the original scratch org was not the sole cause.

This was a critical finding:

```text
The failure followed the deployed metadata into a fresh scratch org.
```

---

## Replacement scratch org

The project initially had no scratch-org definition at the expected path.

The required location is the project root:

```text
/home/sam/github/organisator/backend/config/project-scratch-def.json
```

The layout is:

```text
backend/
├── config/
│   └── project-scratch-def.json
├── force-app/
└── sfdx-project.json
```

A scratch-org definition was created, for example:

```json
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
```

Creating the org without a default Dev Hub failed:

```text
NoDefaultDevHubError: No default dev hub found.
```

The successful command explicitly specified the Dev Hub alias:

```bash
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias backendtest \
  --set-default \
  --target-dev-hub test
```

The replacement scratch org was created successfully and assigned the alias `backendtest`.

---

## Control test that isolated the root cause

A disposable custom object was created manually in Salesforce Setup:

```text
Student_Test__c
└── Test_Field__c
```

The object was retrieved:

```bash
sf project retrieve start \
  --metadata CustomObject:Student_Test__c \
  --target-org backendtest
```

Runtime Describe was then tested:

```bash
sf sobject describe \
  --sobject Student_Test__c \
  --target-org backendtest \
  --json > student.json

cat student.json | jq -r '.result.fields[].name'
```

The output included:

```text
Test_Field__c
```

This test proved:

```text
Scratch org runtime schema                  WORKING
Salesforce REST/SObject Describe            WORKING
SOQL custom-field support                   WORKING
Objects created manually in Salesforce UI   WORKING
Previously generated object metadata        PROBLEMATIC
```

---

## Confirmed root cause

The original `Program__c`, `Participant__c`, and coach object definitions had been produced using the schema-generation workflow rather than being created manually in Salesforce Setup.

Those generated object definitions deployed without reporting errors and appeared in metadata-oriented APIs, but their custom fields were not exposed by the normal runtime schema.

The issue was reproduced in a fresh scratch org, so it was not merely stale source tracking or a damaged original org.

The decisive comparison was:

```text
Manually created Student_Test__c + Test_Field__c
→ runtime describe exposed Test_Field__c immediately

Generated Program__c / Participant__c metadata
→ runtime describe exposed only standard fields
```

Therefore, the working resolution was to recreate the affected objects manually in Salesforce Setup and retrieve the resulting metadata.

### Important clarification

The missing XML namespace observed in one earlier local object file was a useful warning sign, but the practical root-cause proof came from the reproducible UI-created control object test and the successful manual recreation of the real objects.

---

## Recovery procedure

### 1. Preserve the current repository state

Before removing or replacing object metadata:

```bash
cd /home/sam/github/organisator/backend

git add .
git commit -m "Backup academy schema before object recreation"
```

### 2. Create the affected objects manually

Create the objects under:

```text
Setup
→ Object Manager
→ Create
→ Custom Object
```

Objects recreated:

```text
Program__c
Participant__c
Coach_Profile__c
```

The manually selected coach API name is now:

```text
Coach_Profile__c
```

All later lookups and SOQL statements must use that API name.

### 3. Recreate the fields in Salesforce Setup

`Program__c` fields:

```text
DurationWeeks__c
Description__c
```

`Participant__c` fields:

```text
Status__c
Email__c
Discord__c
GitHub__c
StartDate__c
ExpectedEndDate__c
Program__c
Coach_Profile__c
Contact__c
```

> API names are case-sensitive in source and queries. The recreated GitHub field is `GitHub__c`, not the older local spelling `Github__c`.

### 4. Retrieve the manually created metadata

```bash
sf project retrieve start \
  --metadata CustomObject:Program__c \
  --metadata CustomObject:Participant__c \
  --metadata CustomObject:Coach_Profile__c \
  --target-org backendtest
```

Expected local paths:

```text
force-app/main/default/objects/Program__c/
force-app/main/default/objects/Participant__c/
force-app/main/default/objects/Coach_Profile__c/
```

### 5. Verify Runtime Describe before creating data

Program verification:

```bash
sf sobject describe \
  --sobject Program__c \
  --target-org backendtest \
  --json > program.json

cat program.json | jq -r '.result.fields[].name'
```

Expected custom fields:

```text
DurationWeeks__c
Description__c
```

Participant verification:

```bash
sf sobject describe \
  --sobject Participant__c \
  --target-org backendtest \
  --json > participant.json

cat participant.json | jq -r '.result.fields[].name'
```

Confirmed output:

```text
Status__c
Email__c
Discord__c
GitHub__c
StartDate__c
ExpectedEndDate__c
Program__c
Coach_Profile__c
Contact__c
```

This is the most important validation. A successful metadata deployment alone is not sufficient.

---

## Final successful runtime tests

### Program record creation

```bash
sf data create record \
  --target-org backendtest \
  --sobject Program__c \
  --values "
Name='IT Pro'
DurationWeeks__c=24
Description__c='DevOps and Cloud Engineer Program'
"
```

The record was created successfully.

### Program SOQL verification

```bash
sf data query \
  --target-org backendtest \
  --query "
SELECT
  Name,
  DurationWeeks__c,
  Description__c
FROM Program__c"
```

Confirmed values:

```text
Name: IT Pro
DurationWeeks__c: 24
Description__c: DevOps and Cloud Engineer Program
```

### Participant record creation

```bash
sf data create record \
  --target-org backendtest \
  --sobject Participant__c \
  --values "
Name='Max Mustermann'
Status__c='Onboarding'
Email__c='max@example.com'
GitHub__c='maxmustermann'
Discord__c='max#1234'
"
```

The record was created successfully.

### Participant SOQL verification

```bash
sf data query \
  --target-org backendtest \
  --query "
SELECT
  Name,
  Status__c,
  Email__c,
  GitHub__c,
  Discord__c
FROM Participant__c"
```

Confirmed values:

```text
Name: Max Mustermann
Status__c: Onboarding
Email__c: max@example.com
GitHub__c: maxmustermann
Discord__c: max#1234
```

The successful record creation and SOQL queries confirm that the normal Salesforce runtime schema now recognizes the custom fields.

---

## Current confirmed schema

### Program__c

```text
Program__c
├── DurationWeeks__c
└── Description__c
```

### Participant__c

```text
Participant__c
├── Status__c
├── Email__c
├── Discord__c
├── GitHub__c
├── StartDate__c
├── ExpectedEndDate__c
├── Program__c
├── Coach_Profile__c
└── Contact__c
```

### Coach object

```text
Coach_Profile__c
```

The previous name `CoachProfile__c` is obsolete in the rebuilt schema unless it is deliberately reintroduced.

---

## Mandatory rules for future schema work

### 1. Verify the working directory

Always work from:

```bash
cd /home/sam/github/organisator/backend
pwd
```

Expected path:

```text
/home/sam/github/organisator/backend
```

### 2. Do not trust deployment success as runtime proof

After adding or deploying fields, always run Runtime Describe:

```bash
sf sobject describe \
  --sobject ObjectApiName__c \
  --target-org backendtest \
  --json \
| jq -r '.result.fields[].name'
```

Then run a normal SOQL query that references the field.

### 3. Distinguish metadata APIs from runtime APIs

Use Tooling API for metadata troubleshooting:

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "SELECT QualifiedApiName FROM EntityParticle WHERE EntityDefinition.QualifiedApiName='Participant__c'"
```

But do not consider the field operational until it is also returned by:

```bash
sf sobject describe
```

and accepted by:

```bash
sf data query
```

### 4. Preserve exact API names

Current names include:

```text
GitHub__c
Coach_Profile__c
```

Do not silently substitute:

```text
Github__c
CoachProfile__c
```

### 5. Keep scratch-org configuration in the project root

Required location:

```text
config/project-scratch-def.json
```

Create a scratch org with the explicit Dev Hub when no default exists:

```bash
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias backendtest \
  --set-default \
  --target-dev-hub test
```

### 6. Avoid copying formatted HTML or Markdown markers into Fish

Do not paste HTML entities such as:

```text
&gt;
&lt;
```

Do not paste Markdown fence markers such as:

```text
```
```

Copy only the actual shell command.

### 7. Review generated object metadata before deployment

Until the schema-generator behavior is separately validated, prefer creating foundational custom objects in Salesforce Setup and retrieving their metadata.

For later fields, immediately verify Runtime Describe and SOQL after deployment.

---

## Security note

During troubleshooting, an OAuth access token was pasted into terminal/chat output while testing the REST Describe endpoint.

Treat any exposed access token as compromised. Revoke or invalidate the related session before continuing sensitive work. Never store access tokens in:

```text
AGENTS files
Git commits
shell history
screenshots
chat logs intended for sharing
```

Use temporary environment variables for direct REST tests and remove them afterward.

---

## Recommended cleanup before merging

The repository may now contain temporary or obsolete artifacts from troubleshooting, including:

```text
force-app/main/default/objects/Account/
force-app/main/default/objects/Student_Test__c/
participant.json
program.json
student.json
```

Before merging:

1. Decide whether the retrieved `Account` metadata is needed.
2. Remove `Student_Test__c` if it was only a diagnostic object.
3. Remove temporary JSON describe outputs or add them to `.gitignore`.
4. Confirm that the obsolete local `CoachProfile__c` directory is gone.
5. Confirm that all participant lookup metadata points to `Coach_Profile__c`.
6. Run `git status` and inspect every changed file.
7. Run Runtime Describe and SOQL smoke tests again.

Suggested inspection commands:

```bash
find force-app/main/default/objects -maxdepth 3 -type f | sort

git status --short

grep -R "CoachProfile__c\|Github__c" force-app/main/default || true
```

---

## Recommended next development step

With runtime schema visibility restored, continue in this order:

1. Create a `Coach_Profile__c` test record.
2. Create or select a Salesforce Contact test record.
3. Update the existing Participant with:
   - `Program__c`
   - `Coach_Profile__c`
   - `Contact__c`
   - start and expected end dates.
4. Query relationship fields using `Program__r.Name`, `Coach_Profile__r.Name`, and `Contact__r.Name` after confirming the actual relationship names in Runtime Describe.
5. Add a permission set for the React backend/portal integration.
6. Only then implement the Opportunity or Contact to Participant automation Flow.

Do not begin the Flow until the lookup records, lookup fields, and relationship queries have all been verified through the normal Data API.

---

## Final status

```text
Program runtime schema          VERIFIED
Participant runtime schema      VERIFIED
Program record creation         VERIFIED
Participant record creation     VERIFIED
Program custom-field SOQL       VERIFIED
Participant custom-field SOQL   VERIFIED
Root cause isolated             VERIFIED
Manual recreation resolution    VERIFIED
```

The Sprint 1 academy schema is now operational in the replacement scratch org.
