# UI Bundle Architecture

## Current State

The project already contains a Salesforce UI Bundle.

Location:

```text
force-app/main/default/uiBundles/backend
```

The UI Bundle includes:

- React
- TypeScript
- Vite
- shadcn/ui
- Tailwind
- Vitest
- Playwright

This bundle will serve as the primary frontend application.

No separate frontend project is required.

---

## Structure

```text
backend/
└── force-app/
    └── main/
        └── default/
            └── uiBundles/
                └── backend/
                    ├── src/
                    ├── package.json
                    ├── vite.config.ts
                    └── components.json
```

---

## MVP Goal

Create a Participant Management screen.

Capabilities:

- Select Participant
- Edit Participant
- Assign Program
- Assign Coach
- Save changes

---

## Initial Route

```text
/participants
```

---

## First Components

```text
src/components/participants/
├── ParticipantPage.tsx
├── ParticipantSelector.tsx
├── ParticipantForm.tsx
├── ProgramSelect.tsx
└── CoachSelect.tsx
```

---

## Initial Salesforce Objects

Program__c

Coach_Profile__c

Participant__c

---

## Verified Runtime Relationships

```text
Participant__c
  ├─ Program__c
  └─ Coach_Profile__c
```

Relationship Query:

```sql
SELECT
    Name,
    Status__c,
    Program__r.Name,
    Coach_Profile__r.Name
FROM Participant__c
```

Validated successfully.

---

## Current Test Data

Participant:

Max Mustermann

Program:

IT Pro

Coach:

Sam Dillenburg

---

## Next Step

Inspect the existing React application structure inside:

```text
src/
```

and identify:

- router setup
- application entry point
- current pages
- existing API layer
- existing Salesforce integration
