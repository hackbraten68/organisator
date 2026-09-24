# Participant Page Implementation

## Goal

Add the first Academy management screen to the existing UI Bundle.

The page should allow users to:

- View participants
- Select a participant
- Edit participant information
- Assign a program
- Assign a coach

Initially the page may work with mock data before connecting Salesforce.

---

## Existing Router

Current routes:

```text
/
├── Home
├── Search
├── accounts/:recordId
└── NotFound
```

---

## New Route

Add:

```text
/participants
```

---

## New Page

Location:

```text
src/pages/ParticipantPage.tsx
```

Purpose:

Participant administration.

---

## Route Registration

Add the route inside:

```text
src/routes.tsx
```

Example:

```tsx
{
  path: "participants",
  element: <ParticipantPage />,
  handle: {
    showInNavigation: true,
    label: "Participants"
  }
}
```

---

## First Version

Use local mock data.

Reason:

Allows UI development before backend integration.

---

## Mock Data

```ts
const participants = [
  {
    id: "1",
    name: "Max Mustermann",
    status: "Onboarding",
    email: "max@example.com",
    github: "maxmustermann",
    discord: "max#1234",
    program: "IT Pro",
    coach: "Sam Dillenburg"
  }
]
```

---

## Visible Fields

Participant

- Name
- Status
- Email
- GitHub
- Discord

Lookups

- Program
- Coach

Actions

- Save
- Reset

---

## Components

```text
src/components/participants/
├── ParticipantForm.tsx
├── ParticipantSelector.tsx
├── ProgramSelect.tsx
└── CoachSelect.tsx
```

---

## Future Salesforce Integration

Objects:

- Participant__c
- Program__c
- Coach_Profile__c

Runtime verified.

Relationship query already validated.

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
Max Mustermann
IT Pro
Sam Dillenburg
```
