# Plan Audit — Organisator (B2E + B2X starters)

**Date:** 2026-11-09 · **Verdict:** NOT READY

## Principles Alignment

| Check | Status | Note |
|---|---|---|
| Vertical slices | ⚠️ | PRDs describe features (Account search example, sign-in) but no story-level vertical slices with acceptance criteria |
| Scope bounded | ✅ | Each PRD has explicit Non-Goals |
| Success criteria defined | ❌ | No "how do we know done" beyond feature lists; no testable acceptance criteria |
| HARD GATE candidates identifiable | ❌ | No critical decision points flagged (e.g. OWD sharing, Experience Cloud enablement) |
| Domain language / ubiquitous terminology | ✅ | backend/docs/AGENTS.md defines binding terms (backend, frontend, Contact, Participant__c, Portal User) |

## Conventions Completeness

| Check | Status | Note |
|---|---|---|
| CLAUDE.md or AGENTS.md exists | ✅ | backend/docs/AGENTS.md, frontend/AGENTS.md (no root-level CLAUDE.md) |
| CONVENTIONS.md exists | ❌ | Absent — security conventions live inside AGENTS.md, not a dedicated file |
| specs/ directory layout | ❌ | Absent — created now for this audit only |
| Commit conventions documented | ⚠️ | CONTRIBUTING.md exists but Conventional Commits not explicitly confirmed as binding |
| Git workflow mode identified | ⚠️ | Branches main + dev exist; solo vs team-pr not documented |

## Pre-flight Answers

| Command | Value |
|---|---|
| test | `npm run test:unit` (per project: backend/frontend) |
| build | `echo 'No build required'` (SFDX metadata project; UI bundles built separately) |
| lint | `npm run lint` (ESLint on LWC) |
| typecheck | Not documented — UI bundles use TypeScript but no `tsc --noEmit` script |
| CI platform | Not identified |
| Solo or team | Not documented (dev + main branches suggest team-pr) |
| Primary language + framework | TypeScript + React (Vite) + Apex + SFDX |
| Greenfield or existing | Existing codebase (substantial metadata + UI) |

## Open Gaps

- [ ] Add story-level vertical slices with acceptance criteria (run slice-tasks)
- [ ] Define success criteria / testable acceptance (run plan-work)
- [ ] Identify HARD GATE candidates (OWD sharing, Experience Cloud enablement) (run model-domain)
- [ ] Create root CLAUDE.md (run seed-conventions)
- [ ] Create CONVENTIONS.md consolidating security conventions (run seed-conventions)
- [ ] Establish specs/ layout (run seed-conventions)
- [ ] Confirm Conventional Commits as binding (run seed-conventions)
- [ ] Document solo vs team-pr workflow (run seed-conventions)
- [ ] Add typecheck command (`tsc --noEmit`) to package.json scripts
- [ ] Identify CI platform and wire-ci config

## Verdict

NOT READY — 10 gaps remain; close before proceeding. Recommended next skill: `seed-conventions` (bootstrapping conventions + specs layout), then `elaborate-spec` for story slicing.
