# Contributing

Guidelines for contributing to the Organisator monorepo.

## Grundprinzipien

- Dieses Repo besteht aus **zwei separaten SFDX-Projekten** (`backend/`, `frontend/`), die in **derselben Salesforce-Org** deployen.
- Jedes Projekt besitzt eigene Metadata-Typen (siehe [`backend/docs/AGENTS.md`](backend/docs/AGENTS.md#metadata-ownership)).
- **Änderungen nie direkt ohne Verständnis des bestehenden Stils** umsetzen. Vorhandene Patterns, Naming-Conventions und Ordnerstrukturen beibehalten.

## Entwicklungsvoraussetzungen

- Node.js **v18+**
- Salesforce CLI (`sf`) installiert und authentifiziert
- Dev Hub verfügbar
- Ziel-Org (Scratch Org oder Sandbox) pro Projekt konfiguriert

## Workflow

### 1. Branch erstellen

```bash
git checkout -b feat/<kurzer-name>
# oder
git checkout -b fix/<kurzer-name>
```

### 2. Dependencies installieren

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 3. Target-Org setzen (falls noch nicht)

```bash
cd backend && sf config set target-org=<alias>
cd ../frontend && sf config set target-org=<alias>
```

### 4. Änderungen umsetzen

- Salesforce-Metadata nur dort ändern, wo sie ownership hat (Backend vs. Frontend).
- UI-Logik ausschließlich in den jeweiligen UI-Bundles (`*/force-app/main/default/uiBundles/*`).
- Keine Secrets/Keys committen. Niemals Credentials ins Repo.

### 5. Lint & Format

```bash
# UI-Bundles (Vite/TS)
cd frontend/force-app/main/default/uiBundles/frontend && npx eslint .
cd backend/force-app/main/default/uiBundles/backend && npx eslint .

# Prettier (Root/Projekte)
npx prettier --check .
npx prettier --write .  # bei Formatierungsfehlern
```

> Prettier wird projektweit genutzt (`.prettierrc`). Generierte Worklists (`docs/*.md`-Worklists, `scripts/gen-setup-worklist.py` Output) können in `.prettierignore` liegen – dort nicht erzwingen.

### 6. Tests ausführen

**Vitest (UI-Bundles):**

```bash
cd frontend/force-app/main/default/uiBundles/frontend && npx vitest run
cd backend/force-app/main/default/uiBundles/backend && npx vitest run
```

**Playwright (Frontend-Portal):** Statische Tests lokal, Live-Tests nur bei Bedarf mit echten Credentials.

```bash
cd frontend/force-app/main/default/uiBundles/frontend && npx playwright test
```

**Apex Tests:**

```bash
sf apex run test --target-org <alias> --test-level RunLocalTests --wait 10
```

### 7. Build prüfen

UI-Bundles müssen bauen:

```bash
cd frontend/force-app/main/default/uiBundles/frontend && npm run build
cd backend/force-app/main/default/uiBundles/backend && npm run build
```

### 8. Metadata-Validierung (bei Schema-Änderungen)

Nach Änderungen an Custom Objects/Fields **unbedingt** Runtime-Schema prüfen:

```bash
cd backend && npm run schema:check
```

Exit 0 = ok, Exit 1 = Drift, Exit 2 = Prüfungsfehler. **Deployment-Erfolg allein reicht nicht als Beweis.**

## Wichtige Regeln (Salesforce)

### Custom Fields niemals per Deploy erstellen

Neue Custom Fields **immer manuell in Setup anlegen**, danach ins Source **retrieven**:

```bash
sf project retrieve start \
  --metadata CustomField:<Object>.<Field>__c \
  --target-org <alias>
```

**Warum:** Durch reines Deploy landen neue Fields zuverlässig in Metadata/Tooling API, aber nicht immer in der Runtime-Schema (SOQL/REST/UI API GraphQL). Bereits bestehende, gesunde Fields können dagegen normal verändert/deployt werden. Details siehe [`backend/docs/AGENTS.md`](backend/docs/AGENTS.md#12-verify-the-runtime-schema-never-the-deploy-report).

### Experience Cloud – ein gemeinsamer Deploy

Network + CustomSite + DigitalExperienceConfig haben Cross-References, die gegen den **aktuellen Org-Zustand** validiert werden. Deshalb **alle betroffenen Komponenten in einem Deploy** übergeben (nicht stufenweise). Siehe [`frontend/AGENTS.md`](frontend/AGENTS.md#deploy-in-one-call-all-five-types-together).

### Keine Profiles deployen

Profiles werden **nicht** deployt (Rollback-Risiko bei Required Fields). Nur Permission Sets verwenden.

### Preflight beachten

`preflight-deploy.mjs` wird von Setup-Skripten geprüft. Ungewollte Typen (z. B. Profile/SharingRules in bestimmten Pfaden) führen zum Abbruch. `.forceignore` ist zusätzlich, kein vollständiger Ersatz.

## Commits

- Kurze, prägnante Commit-Messages (imperativ, englisch oder deutsch – konsistent zum Repo-Stil).
- Nur beabsichtigte Dateien committen (keine Build-Artefakte, keine `.sf/`, `.sfdx/`, `node_modules/`, lokale `.env`).
- Reviews/PRs: Fokus auf Verständlichkeit, Tests, Build, Lint, `schema:check` (falls Schema betroffen).

## Hilfe

- Architektur & Troubleshooting: [`backend/docs/AGENTS.md`](backend/docs/AGENTS.md)
- Experience Cloud: [`frontend/AGENTS.md`](frontend/AGENTS.md)
- Onboarding: [`docs/ONBOARDING.md`](docs/ONBOARDING.md)
- Troubleshooting: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- Architektur: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Datenmodell: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
