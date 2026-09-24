# Current UI Structure

> Status note (2026-09-24): this was a pre-implementation planning snapshot.
> Actual structure diverged — see below. The app now reads/writes live
> Salesforce data (no mocks); details in `docs/AGENTS.md` finding 10.
>
> Actual pages: `Home`, `AccountObjectDetailPage`, `NotFound`,
> `ParticipantPage`, `programs/ProgramsPage`, `programs/ProgramDetailPage`.
> Actual API layers: `src/api/program/` (programService + `query/*.graphql`),
> `src/api/participant/` (participantService + `query/*.graphql`),
> `src/api/coach/` (coachService + `query/*.graphql`),
> `src/api/account/` + `src/api/graphqlClient.ts` (executeGraphQL).
> Actual types: `src/types/participant.ts`, `src/types/program.ts`,
> `src/types/navigation.ts`. Navigation derives from route handles
> (`showInNavigation`, `label`, `icon`) via `src/router-utils.tsx`.

## Existing Application Architecture

The Salesforce UI Bundle already contains a modern React application.

Current structure:

```text
src/
├── api/
├── components/
├── features/
├── hooks/
├── pages/
├── routes.tsx
├── app.tsx
└── types/
```

---

## Existing Technology

Validated from current project structure:

- React
- TypeScript
- Vite
- shadcn/ui
- Tailwind CSS
- Vitest
- Playwright

---

## Existing Pages

```text
Home.tsx
AccountObjectDetailPage.tsx
NotFound.tsx
```

---

## Existing Reusable UI Components

```text
Button
Card
Input
Label
Select
Table
Dialog
Tabs
Alert
Badge
Avatar
```

No additional shadcn installation is required.

---

## New Participant Feature

### New Page

```text
src/pages/ParticipantPage.tsx
```

Purpose:

Manage Academy participants.

---

### New Components

```text
src/components/participants/
├── ParticipantForm.tsx
├── ParticipantSelector.tsx
├── ProgramSelect.tsx
└── CoachSelect.tsx
```

---

### New API Layer

```text
src/api/participant/
├── participantApi.ts
└── query/
```

Responsibilities:

- load Participants
- load Programs
- load Coaches
- update Participant

---

### New Types

```text
src/types/participant.ts
```

---

## Initial Screen

```text
Participant Management

Participant:
[ Max Mustermann ▼ ]

Name
Status
Email
GitHub
Discord

Program:
[ IT Pro ▼ ]

Coach:
[ Sam Dillenburg ▼ ]

[ Save ]
```

---

## Data Source

Salesforce Objects:

- Participant__c
- Program__c
- Coach_Profile__c

---

## Verified Test Data

Participant:

Max Mustermann

Program:

IT Pro

Coach:

Sam Dillenburg

---

## Next Implementation

Done — routing uses `react-router` object routes with typed handles
(`NavigationHandle`: `showInNavigation`, `label`, `icon`); the sidebar in
`src/appLayout.tsx` renders them automatically. Open roadmap:
`docs/frontend/certification-roadmap-proposal.md`.
