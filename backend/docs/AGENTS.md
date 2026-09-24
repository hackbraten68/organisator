# AGENTS.md

## Project context

This repository contains the Salesforce backend and React UI Bundle for the **Organisator** participant-management platform.

Project root:

```text
/home/sam/github/organisator/backend
```

Target scratch org alias:

```text
backendtest
```

Salesforce project configuration:

```text
force-app/main/default/
├── applications/
├── objects/
├── permissionsets/
└── uiBundles/
```

The planned Salesforce architecture separates the standard CRM layer from the custom academy layer.

```text
CRM layer
Lead
└── Opportunity
    └── Contact

Academy layer
Program__c
Participant__c
CoachProfile__c
LearningPath__c
Project__c
Module__c
```

The current implementation is Sprint 1 and focuses on:

```text
Program__c
Participant__c
CoachProfile__c
```

---

## Current state

The following custom objects have been generated and successfully deployed:

```text
Program__c
Participant__c
CoachProfile__c
```

The following fields have been generated for `Program__c`:

```text
Description__c      Long Text Area(32768)
DurationWeeks__c    Number(2,0)
```

Correct local structure:

```text
force-app/main/default/objects/Program__c/
├── Program__c.object-meta.xml
└── fields/
    ├── Description__c.field-meta.xml
    └── DurationWeeks__c.field-meta.xml
```

The fields are visible in Salesforce Setup under:

```text
Setup
└── Object Manager
    └── Program
        └── Fields & Relationships
```

The Tooling API confirms that both custom fields exist:

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName, DataType
FROM FieldDefinition
WHERE EntityDefinition.QualifiedApiName='Program__c'
ORDER BY QualifiedApiName"
```

Expected relevant output:

```text
Description__c     Long Text Area(32768)
DurationWeeks__c   Number(2,0)
```

A second Tooling API check also confirmed the custom fields:

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName
FROM FieldDefinition
WHERE EntityDefinition.QualifiedApiName='Program__c'
AND QualifiedApiName LIKE '%__c'"
```

Expected output:

```text
Description__c
DurationWeeks__c
```

---

## Important troubleshooting findings

### 1. Always run Salesforce schema generators from the project root

Before generating an object or field, verify the current directory:

```bash
cd /home/sam/github/organisator/backend
pwd
```

Expected result:

```text
/home/sam/github/organisator/backend
```

Do not run schema generation commands from inside the UI Bundle directory:

```text
force-app/main/default/uiBundles/backend
```

Running a command such as this from the wrong working directory:

```bash
sf schema generate field \
  --object force-app/main/default/objects/Program__c \
  --label "Duration Weeks"
```

caused Salesforce CLI to create a nested and invalid project structure:

```text
force-app/main/default/uiBundles/backend/force-app/main/default/objects/
```

### 2. Verify where generated files were actually created

Use:

```bash
find force-app/main/default -type f | sort
```

For a specific object:

```bash
find force-app/main/default/objects/Program__c -type f | sort
```

The field metadata must be stored under the parent object:

```text
objects/Program__c/fields/DurationWeeks__c.field-meta.xml
objects/Program__c/fields/Description__c.field-meta.xml
```

A field must not be stored as though it were its own object, for example:

```text
objects/Description__c/fields/Description__c.field-meta.xml
```

### 3. Repairing fields generated in the wrong directory

Create the correct target directory:

```bash
mkdir -p /home/sam/github/organisator/backend/force-app/main/default/objects/Program__c/fields
```

Move the generated metadata files into the correct object directory:

```bash
mv \
  /home/sam/github/organisator/backend/force-app/main/default/uiBundles/backend/force-app/main/default/objects/Program__c/fields/DurationWeeks__c.field-meta.xml \
  /home/sam/github/organisator/backend/force-app/main/default/objects/Program__c/fields/
```

```bash
mv \
  /home/sam/github/organisator/backend/force-app/main/default/uiBundles/backend/force-app/main/default/objects/Description__c/fields/Description__c.field-meta.xml \
  /home/sam/github/organisator/backend/force-app/main/default/objects/Program__c/fields/
```

After confirming that the two field files are in the correct location, remove the accidental nested Salesforce project:

```bash
rm -rf /home/sam/github/organisator/backend/force-app/main/default/uiBundles/backend/force-app
```

Verify the repaired structure:

```bash
tree /home/sam/github/organisator/backend/force-app/main/default/objects/Program__c
```

### 4. Deploy only the metadata currently being worked on

A full deployment originally failed because the UI Bundle was included:

```text
ExpectedSourceFilesError: Expected source files for type 'UIBundle'
```

To isolate the custom objects from the frontend bundle, deploy selected metadata only:

```bash
sf project deploy start \
  --metadata CustomObject:Program__c \
  --metadata CustomObject:Participant__c \
  --metadata CustomObject:CoachProfile__c \
  --target-org backendtest
```

To deploy one complete object with all of its local fields:

```bash
sf project deploy start \
  --source-dir force-app/main/default/objects/Program__c \
  --target-org backendtest
```

To deploy all academy objects and their fields:

```bash
sf project deploy start \
  --source-dir force-app/main/default/objects \
  --target-org backendtest
```

### 5. UI Bundle conflicts are separate from object metadata errors

The `backend` UI Bundle already existed in the scratch org and produced source-tracking conflicts.

The local UI Bundle was intentionally treated as the source of truth and deployed with:

```bash
sf project deploy start \
  --metadata UIBundle:backend \
  --target-org backendtest \
  --ignore-conflicts
```

This deployment succeeded.

Use `--ignore-conflicts` only when it is intentional that the local source overwrites the remote version.

### 6. Normal data API and Tooling API can report different schema visibility

The following standard data query did not recognize the new custom field, despite a successful metadata deployment:

```bash
sf data query \
  --target-org backendtest \
  --query "SELECT Id, Name, DurationWeeks__c FROM Program__c"
```

Observed error:

```text
No such column 'DurationWeeks__c' on entity 'Program__c'
```

The normal object describe command also returned no custom fields:

```bash
sf force schema sobject describe \
  --sobject Program__c \
  --target-org backendtest \
  --json \
| jq -r '.result.fields[].name' \
| grep '__c'
```

However, all of the following confirmed that the fields exist:

- The metadata deployment reported both fields as created.
- Salesforce Object Manager displayed both fields.
- Tooling API `FieldDefinition` returned both fields.
- Tooling API `CustomField` returned `DurationWeeks`.

Use the Tooling API for definitive metadata troubleshooting:

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName, DataType
FROM FieldDefinition
WHERE EntityDefinition.QualifiedApiName='Program__c'
ORDER BY QualifiedApiName"
```

To verify a particular custom field definition:

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT DeveloperName
FROM CustomField
WHERE DeveloperName='DurationWeeks'"
```

Do not assume that a successful deployment alone means the normal Data API can immediately use a newly deployed field. Verify independently with Object Manager and the Tooling API.

### 7. Always specify the target org for data operations

Metadata deployments used `backendtest`, so subsequent data commands must explicitly use the same org:

```bash
sf data create record \
  --target-org backendtest \
  --sobject Program__c \
  --values "Name='IT-Pro'"
```

Verify the org when needed:

```bash
sf org display --target-org backendtest
```

Relevant org values observed during troubleshooting:

```text
Alias: backendtest
API version: 67.0
Edition: Developer
Status: Active
```

### 8. Avoid copying Markdown fence markers into fish shell

The fish error below was caused by accidentally pasting Markdown backticks into the terminal:

```text
fish: Unknown command: ``
```

Only copy the command contents, not the surrounding Markdown fence.

---

## Field configuration decisions

### Program__c.DurationWeeks__c

Use:

```text
Type: Number
Precision: 2
Scale: 0
Required: No
Unique: No
External ID: No
Security classification: Internal
```

This supports values such as `12` and `24`.

### Program__c.Description__c

Use:

```text
Type: Long Text Area
Length: 32768
Visible lines: 10
Security classification: Internal
```

### External ID rule

A field does not need to be an External ID for the React application or a participant portal to read it through Salesforce APIs.

Do not use External ID for descriptive or operational fields such as:

```text
DurationWeeks__c
Description__c
Status__c
StartDate__c
ExpectedEndDate__c
```

Reserve External IDs for stable identifiers supplied by, or shared with, external systems, for example:

```text
ExternalStudentId__c
DiscordUserId__c
GithubUserId__c
```

---

## Useful verification commands

### Show the local object structure

```bash
tree force-app/main/default/objects/Program__c
```

### Find a field in local metadata

```bash
grep -R "DurationWeeks" force-app/main/default/objects/Program__c
```

```bash
grep -R "Description__c" force-app/main/default/objects/Program__c
```

### Display only custom fields from an object describe response

```bash
sf force schema sobject describe \
  --sobject Program__c \
  --target-org backendtest \
  --json \
| jq -r '.result.fields[].name' \
| grep '__c'
```

### Display selected field names and data types

```bash
sf force schema sobject describe \
  --sobject Program__c \
  --target-org backendtest \
  --json \
| jq -r '.result.fields[] | "\(.name) | \(.type)"' \
| grep -E 'Duration|Description'
```

### Verify fields using Tooling API

```bash
sf data query \
  --target-org backendtest \
  --use-tooling-api \
  --query "
SELECT QualifiedApiName, DataType
FROM FieldDefinition
WHERE EntityDefinition.QualifiedApiName='Program__c'
ORDER BY QualifiedApiName"
```

### List Program records

```bash
sf data query \
  --target-org backendtest \
  --query "SELECT Id, Name FROM Program__c"
```

Program records created during troubleshooting:

```text
TEST
IT-Pro
IT-Pro Advanced
```

The `TEST` record can be deleted later if it is no longer needed.

---

## Mandatory next step

Continue with the fields and relationships on `Participant__c`.

```text
Participant__c
├── Status__c
├── Email__c
├── Discord__c
├── Github__c
├── StartDate__c
├── ExpectedEndDate__c
├── Program__c Lookup
├── CoachProfile__c Lookup
└── Contact__c Lookup
```

Recommended field types:

```text
Status__c            Picklist
Email__c             Email
Discord__c           Text(255)
Github__c            Text(255)
StartDate__c         Date
ExpectedEndDate__c   Date
Program__c           Lookup(Program__c)
CoachProfile__c      Lookup(CoachProfile__c)
Contact__c           Lookup(Contact)
```

Recommended values for `Status__c`:

```text
Onboarding
Active
Paused
Graduated
Placed
Dropped
```

Recommended default:

```text
Onboarding
```

Before generating these fields, always return to the project root:

```bash
cd /home/sam/github/organisator/backend
pwd
```

Then generate each field against the correct local object folder:

```bash
sf schema generate field \
  --object force-app/main/default/objects/Participant__c \
  --label "Status"
```

After all Participant fields are generated, verify the directory structure before deployment:

```bash
tree force-app/main/default/objects/Participant__c
```

Deploy only `Participant__c` and its fields:

```bash
sf project deploy start \
  --source-dir force-app/main/default/objects/Participant__c \
  --target-org backendtest
```

Use the Tooling API to verify the resulting field definitions before creating dependent test data or implementing the next Salesforce Flow.


## Scratch Org Rebuild Result

A completely fresh scratch org was created:

```bash
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias backendtest \
  --set-default \
  --target-dev-hub test
