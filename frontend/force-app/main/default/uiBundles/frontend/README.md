# React External App

The participant-facing portal for **Organisator**, served as an Experience Cloud site container. Today it provides the authentication stack (login, forgot/reset password, profile, session timeout) and nothing else — the participant pages are built in the phases of [`docs/portal/portal-access-plan.md`](../../../../../../backend/docs/portal/portal-access-plan.md).

There is **no self-service registration**. Portal accounts are provisioned by staff in the internal backend: `Contact` → `Participant__c` → portal user, with a Salesforce welcome email for setting the first password. See [`architecture-decisions.md`](../../../../../../backend/docs/portal/architecture-decisions.md) (ADR-004, ADR-005).

Built with React, Vite, TypeScript, and Tailwind/shadcn.

For project-level details (metadata, deploy), see the [project README](../../../../../../README.md).

## Prerequisites

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Starts the Vite dev server (default: http://localhost:5173).

## Build

```bash
npm run build
```

Writes the production bundle to `dist/` inside the UI Bundle folder.

## Test

```bash
npm test
```

Runs the unit test suite (Vitest).
