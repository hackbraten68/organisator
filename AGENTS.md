<!-- BEGIN bigpowers:project -->
# Organisator — AI Agent Conventions

Salesforce monorepo: two SFDX projects (backend + frontend) deploying into one org for academy participant management.

## Stack

TypeScript + React 18 (Vite) for UI bundles; Apex + SFDX for Salesforce metadata; Node 18+.

## Commands

- Test: `cd backend && npm run test:unit` / `cd frontend && npm run test:unit` (also `npm run test:scripts`, `npm run test:schema`)
- Build: `npm run build` (no-op for SFDX; UI bundles built via Vite)
- Lint: `npm run lint`
- Typecheck: not yet wired — add `tsc --noEmit` to UI bundle scripts
- Preflight: Test + Lint (+ typecheck once wired)

## Architecture

`backend/` = Salesforce metadata + backoffice React SPA; `frontend/` = Experience Cloud site + portal React SPA; both deploy to the same org. Metadata ownership per `backend/docs/AGENTS.md`.

## Conventions

- Follow `backend/docs/AGENTS.md` naming + security conventions (binding).
- Conventional Commits.
- Two-project metadata ownership: each metadata type has exactly one owning project.
- Never edit generated `dist/` or `tsbuildinfo`.
- Never commit secrets.
- Never trust org-wide defaults from a green deploy (OWD set by hand in Setup).
- All login paths go through `UIBundleAuthUtils.getSanitizedStartUrl`.
<!-- END bigpowers:project -->

<!-- BEGIN bigpowers:context-routing -->
## Context routing

- `backend/` changes → read `backend/docs/AGENTS.md`.
- `frontend/` changes → read `frontend/AGENTS.md`.
<!-- END bigpowers:context-routing -->

<!-- BEGIN bigpowers:learned-preferences -->
## Learned preferences

(none yet)
<!-- END bigpowers:learned-preferences -->

<!-- BEGIN bigpowers:tooling -->
## Tooling

(none wired yet)
<!-- END bigpowers:tooling -->
