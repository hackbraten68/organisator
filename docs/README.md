# Dokumentation

Zentrale Übersicht aller Projekt-Dokumentationen.

## Für Entwickler (Onboarding & Alltag)

| Dokument | Beschreibung |
|---|---|
| [ONBOARDING.md](ONBOARDING.md) | Erster Setup-Pfad Schritt-für-Schritt (Repo, Dependencies, Org, Setup, Dev-Server) |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Git-Workflow, Code-Style, Tests, Lint, Commit-Regeln, Salesforce-Guidelines |
| [ARCHITECTURE.md](ARCHITECTURE.md) | High-Level-Architektur, Ownership, Identity, Sharing, Experience Cloud, UI-Bundles, Deployment |
| [DATA_MODEL.md](DATA_MODEL.md) | Datenmodell, Objekte, Felder, Relationen, Kardinalitäten |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Häufige Stolperfallen & Lösungen (Runtime-Schema, Deploy, Experience Cloud, Playwright, Cache) |

## Tiefgreifende Referenz (Agent/Deep-Dive)

| Dokument | Beschreibung |
|---|---|
| [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md) | Sehr detailliert: Architektur, Naming, Schema-Regeln, Troubleshooting, Messungen, Learnings (zwingend bei Salesforce-Arbeiten) |
| [`frontend/AGENTS.md`](../frontend/AGENTS.md) | Experience Cloud 3-Component-URL-Architektur, React UI-Bundle, Login/Logout, Live-Tests, Bugs/Measurements |

## Skripte & Details

| Dokument | Beschreibung |
|---|---|
| [`backend/scripts/seed-sample-data.README.md`](../backend/scripts/seed-sample-data.README.md) | Details zum Seed-Script (Demodaten) |

## Tipp

- **Neuer Entwickler:** Start mit [ONBOARDING.md](ONBOARDING.md), dann [ARCHITECTURE.md](ARCHITECTURE.md) + [DATA_MODEL.md](DATA_MODEL.md).
- **Salesforce-Problem:** Erst [TROUBLESHOOTING.md](TROUBLESHOOTING.md), bei Tiefe zusätzlich [backend/docs/AGENTS.md](../backend/docs/AGENTS.md) bzw. [frontend/AGENTS.md](../frontend/AGENTS.md).
- **Beitrag leisten:** [CONTRIBUTING.md](../CONTRIBUTING.md) lesen.