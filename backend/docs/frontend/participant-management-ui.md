# Participant Management UI

## Goal

Build the first React + shadcn/ui interface for Academy management.

The UI should provide CRUD operations for `Participant__c` and expose lookup relationships to `Program__c` and `Coach_Profile__c`.

---

## Salesforce Data Model

### Program__c

Fields:

- Name
- DurationWeeks__c
- Description__c

Sample record:

- IT Pro
- DurationWeeks = 24
- Description = DevOps and Cloud Engineer Program

---

### Coach_Profile__c

Fields:

- Name
- Email__c
- GitHub__c
- Discord__c
- Role__c

Sample records:

- Sam Dillenburg
- Ghaith Saidani
- Sandra Krüger
- Frank Blum

---

### Participant__c

Fields:

- Name
- Status__c
- Email__c
- GitHub__c
- Discord__c
- StartDate__c
- ExpectedEndDate__c
- Program__c
- Coach_Profile__c
- Contact__c

Sample record:

Name:

Max Mustermann

Status:

Onboarding

Program:

IT Pro

Coach:

Sam Dillenburg

---

## Verified Relationship Query

```sql
SELECT
    Name,
    Status__c,
    Program__r.Name,
    Coach_Profile__r.Name
FROM Participant__c
```

Expected result:

```text
Max Mustermann | Onboarding | IT Pro | Sam Dillenburg
```

---

## UI Vision

```text
Participant Selection

Name
Status
Email
GitHub
Discord

Program (Dropdown)
Coach (Dropdown)

Save
Delete
Create New
```

---

## API Endpoints

```http
GET /api/participants

GET /api/participants/{id}

POST /api/participants

PATCH /api/participants/{id}

DELETE /api/participants/{id}

GET /api/programs

GET /api/coaches
```

---

## Frontend Data Types

```ts
export type Participant = {
  id: string
  name: string
  status: string
  email: string
  github: string
  discord: string
  startDate: string
  expectedEndDate: string
  programId: string
  coachProfileId: string
}

export type Program = {
  id: string
  name: string
  durationWeeks?: number
  description?: string
}

export type Coach = {
  id: string
  name: string
  email?: string
  github?: string
  discord?: string
  role?: string
}
```

---

## Validated Runtime State

The following runtime tests have been completed successfully:

### Program Runtime Query

```sql
SELECT
    Name,
    DurationWeeks__c,
    Description__c
FROM Program__c
```

Result:

```text
IT Pro
DurationWeeks: 24
Description: DevOps and Cloud Engineer Program
```

### Participant Relationship Query

```sql
SELECT
    Name,
    Status__c,
    Program__r.Name,
    Coach_Profile__r.Name
FROM Participant__c
```

Result:

```text
Max Mustermann
Status: Onboarding
Program: IT Pro
Coach: Sam Dillenburg
```

---

## Next Steps

1. Create React application
2. Install shadcn/ui
3. Create mock API
4. Build Participant editor
5. Connect Salesforce backend adapter
6. Implement Opportunity → Participant automation flow
7. Add Program management screen
8. Add Coach management screen
