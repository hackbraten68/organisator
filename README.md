# Organisator

Salesforce + React Monorepo für das Teilnehmer-Management der Academy.

Das Repository besteht aus zwei separaten SFDX-Projekten, die in **derselben Salesforce-Org** deployt werden. Jedes Projekt enthält sowohl Salesforce-Metadata als auch ein React-UI-Bundle (Experience Cloud).

## Projektaufteilung

| Projekt | Zweck | Enthält |
|---|---|---|
| **`backend/`** | Backend & internes Backoffice | Salesforce-Metadata (Custom Objects, Apex, Trigger, Permission Sets) + internes React-UI-Bundle (Backoffice/Admin) |
| **`frontend/`** | Experience Cloud Portal | Salesforce-Metadata (Network, Site, DigitalExperienceConfig, DigitalExperiences) + participant-facing React-UI-Bundle (Portal) |

> **Hinweis zur Namensgebung:** In diesem Repo bedeutet _„Backend“_ nicht einen Webserver, sondern den Salesforce-Metadaten-Teil + internes Backoffice. Details siehe [`backend/docs/AGENTS.md`](backend/docs/AGENTS.md).

## Tech-Stack

**Frontend/UI-Bundles:**
- React 18+ (Functional Components, Hooks, Strict Mode)
- TypeScript, Vite
- React Router v6 (Lazy Loading, Nested Routes)
- Tailwind CSS / shadcn (je UI-Bundle)
- Salesforce UI API GraphQL (via Salesforce Data SDK)

**Salesforce:**
- Apex (REST Services, Sharing, Triggers)
- Experience Cloud (Digital Experiences/LWR + React UI Bundle)
- Custom Objects, Permission Sets

**Testing:**
- **UI-Bundles:** [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) (E2E/Live-Tests)
- **Apex:** Salesforce Apex Tests
- **Scripts:** Node.js (`node --test`)

## Voraussetzungen

- [Node.js](https://nodejs.org/) **v18+**
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`)
- Dev Hub + Zugriff auf eine Salesforce-Org (Scratch Org oder Sandbox)

## Quick Start

### 1. Dependencies installieren

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. Target Org setzen (pro Projekt)

Jedes Projekt speichert seine Target-Org lokal (nicht versioniert). Einmalig pro Maschine:

```bash
cd backend && sf config set target-org=<alias>
cd ../frontend && sf config set target-org=<alias>
```

### 3. Setup & Deploy

```bash
# Backend
cd backend
npm run setup -- --target-org <alias> --yes

# Frontend
cd ../frontend
npm run setup -- --target-org <alias> --yes
```

Ohne `--yes` startet der interaktive Step-Picker. Optionen: `npm run setup -- --help`.

## Entwicklung

### Lokaler Dev-Server

**Frontend (Portal):**
```bash
cd frontend/force-app/main/default/uiBundles/frontend
npm run dev
```

**Backend (Backoffice):**
```bash
cd backend/force-app/main/default/uiBundles/backend
npm run dev
```

## Testing

Tests laufen **im jeweiligen UI-Bundle-Verzeichnis**, nicht im Projekt-Root.

### Vitest (Unit/Component-Tests)

```bash
cd frontend/force-app/main/default/uiBundles/frontend && npx vitest run
cd backend/force-app/main/default/uiBundles/backend && npx vitest run
```

Watch-Mode:
```bash
npx vitest
```

### Playwright (E2E)

```bash
cd frontend/force-app/main/default/uiBundles/frontend && npx playwright test
```

**Live-Tests gegen echte Org (Portal):**

```bash
cd frontend/force-app/main/default/uiBundles/frontend
npm run build
PORTAL_USER=<username> PORTAL_PASSWORD=<password> \
  npx playwright test --config=playwright.live.config.ts
```

> Die statischen Playwright-Tests sind primär Smoke-Checks. Für Login/Logout/Session-Verhalten sind die Live-Tests maßgeblich.

### Apex Tests

```bash
sf apex run test --target-org <alias> --test-level RunLocalTests --wait 10
```

## Build & Deploy

### UI-Bundles bauen

```bash
cd frontend/force-app/main/default/uiBundles/frontend && npm run build
cd backend/force-app/main/default/uiBundles/backend && npm run build
```

### Selektiv deployen

**Nur UI-Bundles:**
```bash
sf project deploy start --source-dir force-app/main/default/uiBundles --target-org <alias>
```

**Nur Experience Cloud (Frontend):**
```bash
sf project deploy start \
  --source-dir force-app/main/default/digitalExperienceConfigs \
  --source-dir force-app/main/default/digitalExperiences \
  --source-dir force-app/main/default/networks \
  --source-dir force-app/main/default/sites \
  --target-org <alias>
```

**Nur Apex/Metadata (Backend):**
```bash
sf project deploy start --source-dir force-app/main/default/classes --target-org <alias>
```

**Vollständiger Deploy (Metadata + UI-Bundles):**
```bash
sf project deploy start --source-dir force-app --target-org <alias>
```

> **Wichtig:** Für Experience Cloud (Network + CustomSite + DigitalExperienceConfig) **müssen** alle betroffenen Komponenten **in einem gemeinsamen Deploy** übergeben werden (Cross-References werden gegen den Org-Zustand validiert). Siehe [`frontend/AGENTS.md`](frontend/AGENTS.md) für Details.

## Schema & Daten

- **Schema-Check (Runtime vs. Source):** Prüft, ob deployte Custom Fields tatsächlich in der Runtime-Schema sichtbar sind.  
  ```bash
  cd backend && npm run schema:check
  ```
- **Seed Sample Data:** Erstellt Demo-Daten (Programme, Coaches, Teilnehmer, Learning Paths, Module).  
  ```bash
  cd backend && node scripts/seed-sample-data.mjs
  ```
- **Worklist für manuelle Schema-Erstellung:** Wird via `scripts/gen-setup-worklist.py` erzeugt. Nicht manuell editieren.

> **Wichtig (Salesforce-Schema):** Neue Custom Fields **niemals** per `sf project deploy` erstellen – immer **manuell in Setup anlegen**, dann per `sf project retrieve` ins Source holen. Hintergrund in [`backend/docs/AGENTS.md`](backend/docs/AGENTS.md) (Finding 9, 12).

## Wichtige Dokumentation

- [`backend/docs/AGENTS.md`](backend/docs/AGENTS.md) – Architektur, Namenskonventionen, Schema-Regeln, Troubleshooting
- [`frontend/AGENTS.md`](frontend/AGENTS.md) – Experience Cloud URL-Architektur, React-UI-Bundle, Login/Logout, Live-Tests
- [`frontend/README.md`](frontend/README.md) – Detaillierte UI-Bundle-Features & Deploy-Varianten
- [`backend/scripts/seed-sample-data.README.md`](backend/scripts/seed-sample-data.README.md) – Seed-Script Details

## Hinweise

- `.sf/` und `.sfdx/` sind gitignored (Target-Orgs werden nicht committet).
- `preflight-deploy.mjs` prüft Deploy-Pfade (verhindert u. a. versehentliches Deployen von Profiles/SharingRules).
- Experience Cloud ist in reinen Developer-Scratch-Orgs teilweise eingeschränkt – siehe [`backend/docs/AGENTS.md`](backend/docs/AGENTS.md).
