# Architektur

Überblick über Aufbau, Ownership und Kernprinzipien des Organisator-Monorepos.

## 1. Monorepo-Struktur

Zwei separate **SFDX-Projekte** deployen in **dieselbe Salesforce-Org**:

```text
organisator/
├── backend/      # Salesforce-Metadata (Academy) + internes Backoffice UI-Bundle
├── frontend/     # Experience Cloud (Portal) + participant-facing UI-Bundle
└── docs/         # Projekt-Dokumentation
```

### Ownership (Trennung der Verantwortlichkeiten)

Jedes Metadata-Type gehört genau einem Projekt, um Deploy-Konflikte zu vermeiden.

| Owned by `backend` | Owned by `frontend` |
|---|---|
| `CustomObject` (Academy Objects: Program, Participant, Coach_Profile, Learning_Path, Module, Appointment, Absence, AvailabilitySlot, AuditEvent, AuditOutbox) | `Network`, `CustomSite`, `DigitalExperienceConfig`, `DigitalExperienceBundle`, `DigitalExperience` |
| Apex: Portal Access Services (`ParticipantPortalAccess` etc.), Trigger (`ParticipantContactUniqueness`) | Apex: Portal Read-Endpoints (`ParticipantPortalData`, `ParticipantPortalLearningPath`), Auth (`UIBundleLogin`, `UIBundleAuthUtils`, ...) |
| `CustomPermission` `Manage_Participant_Portal_Access` | Experience Cloud Templates, Portal Profiles/Permission Sets, Member Setup |
| Internes Backoffice UI-Bundle (`uiBundles/backend`) | Participant UI-Bundle (`uiBundles/frontend`) |

Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#metadata-ownership).

## 2. Domänenmodell (Academy Layer)

Trennung zwischen **CRM (Salesforce Standard)** und **Academy Layer**. Kontaktpunkt ist `Contact`.

```text
CRM Layer (Standard)
Lead ──convert──▶ Contact + Account + Opportunity

Academy Layer (Custom)
Contact
└── Participant__c            (Academy-Rolle, 1:1, Contact__c required)
    ├── Program__c
    ├── Coach_Profile__c
    └── Learning_Path__c
        └── Module__c
```

**Prinzipien:**
- Kein automatischer Lead→Participant durch Stage-Change. Participant wird manuell aus Contact erstellt (nach Prüfung).
- `Project__c` existiert nicht im Datenmodell.
- Identity ist getrennt vom Business-Key (siehe Abschnitt 3).

Details: [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#project-context), [`docs/DATA_MODEL.md`](DATA_MODEL.md).

## 3. Identity & Authentifizierung (Experience Cloud Portal)

Portal löst Identität **serverseitig** über Contact/User:

```text
User.ContactId → Contact → Participant__c
WHERE Contact__c = :contactId
```

**Wichtige Regeln:**
- Kein clientseitiges Übergeben einer Participant-Id. Filter immer serverseitig.
- Interner Admin hat keinen `ContactId` → `/me` liefert erwartungsgemäß Fehler (korrektes Verhalten, kein Bug).
- Apex REST-Endpunkte laufen mit expliziter Identity-Resolution (z. B. `resolveForPortalUser()`), zusätzlich `with sharing`.
- Sharing wird über Apex Sharing Reason (`Portal_Access__c`) + `Participant__Share` (Read) gesteuert.

REST-Pfade (Portal):
- `GET /services/apexrest/participant-portal/me` (Picasso-Prefix `/organisatorv1/sf/api/...`)
- `GET /services/apexrest/participant-portal/me/learning-path`

Auth/Login/Logout: siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#login-and-logout-paths).

## 4. Experience Cloud – URL-Architektur

Experience Cloud nutzt **3 Komponenten, 2 unterschiedliche URLs** (kritisch für Login/Logout/Data):

| Komponente | Metadata | URL-Prefix | Zweck |
|---|---|---|---|
| **Picasso Site** | `DigitalExperienceConfig` + `DigitalExperienceBundle` | `/organisatorv1` | Primäre SPA (React UI Bundle), Customer-facing Pages |
| **ChatterNetwork Site** | `Network` + `CustomSite` | `/organisatorv1vforcesite` | Legacy Auth-Endpunkte |

**Mapping (verified):**
```text
Network Organisator:     <site>Organisator</site>, <picassoSite>Organisator1</picassoSite>, <urlPathPrefix>organisatorv1vforcesite</urlPathPrefix>
CustomSite Organisator:  <urlPathPrefix>organisatorv1vforcesite</urlPathPrefix>
DEC Organisator1:        <urlPathPrefix>organisatorv1</urlPathPrefix>, <space>site/Organisator1</space>
```

**Regeln:**
- `Network.urlPathPrefix` == `CustomSite.urlPathPrefix`
- Picasso-Site immer `{siteName}1`
- Primary URL lebt in `DigitalExperienceConfig`, **nicht** in `Network`
- Cross-References erzwingen **gemeinsamen Deploy** (Abschnitt 5)

Details: [`frontend/AGENTS.md`](../frontend/AGENTS.md#the-three-component-url-architecture-read-this-before-touching-any-url).

## 5. Deployment-Architektur

### Ein-Deploy-Pflicht (Experience Cloud)

`Network.site`, `Network.picassoSite`, DEC-References werden gegen **aktuellen Org-Zustand** validiert (nicht gegen Dateien im selben Deploy). Deshalb müssen betroffene Komponenten **atomar** deployed werden (siehe Troubleshooting #4).

### Preflight & Guards

- `scripts/preflight-deploy.mjs` (Backend/Frontend) läuft vor Deploy-Pfaden und verhindert unerwünschte Typen (z. B. `Profile`, `SharingRule`, `SharingSet`).
- `.forceignore` als zusätzlicher Layer (kein vollständiger Ersatz).
- Target-Org-Auflösung zentral über [`backend/scripts/target-org.mjs`](../backend/scripts/target-org.mjs) (explicit `--target-org` > `.sf/config.json` > Abort).

### Schema-Erstellung (kritisch)

**Regel:** Neue Custom Fields **nie per `sf project deploy`** anlegen. Manuell in Setup → Object Manager anlegen, dann per `sf project retrieve` ins Source holen. Bereits bestehende Fields dürfen normal deployed werden.

**Grund:** Runtime-Schema (SOQL/REST/UI API GraphQL) ≠ Metadata/Tooling API-Report nach reinem Deploy. Prüfung via `npm run schema:check`.

Details: [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#12-verify-the-runtime-schema-never-the-deploy-report).

## 6. Frontend-Architektur (UI Bundles)

Beide UI-Bundles sind React-SPAs (Vite, TypeScript), eingebunden als **Salesforce Experience Cloud UI Bundles**.

### Datenzugriff (UI API GraphQL)

Architektur (Pflicht: Service-Layer, keine direkte SDK-Nutzung in Komponenten):

```text
Component
  → src/api/<domain>/<domain>Service.ts
    → src/api/<domain>/query/*.graphql  (?raw)
      → src/api/graphqlClient.ts  (executeGraphQL)
        → Salesforce Data SDK (uiapi GraphQL)
```

**Wesentliche Punkte:**
- Reads: `uiapi { query { Object__c(first, orderBy, where) { edges { node } } } }`
- Mutations direkt unter `uiapi` (z. B. `Program__cCreate`, `Program__cUpdate`, `Program__cDelete`) – **kein** `mutation {}` Wrapper
- Lookup-Equality via `IdOrRef!`, Picklists als Strings
- GraphQL ist **case-sensitive** (Field-Names exakt)
- Cache: Queries mit `cacheControl: "no-cache"` (verhindert OneStore-Stale-After-Mutation ohne `refresh()`-Handles). Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#10-ui-bundle-reads-and-writes-salesforce-through-uiapi-graphql).

### Routing & Base Path

React Router läuft innerhalb Experience Cloud. `SITE_PATH_PREFIX` in `src/config/site.ts` ist **Source of Truth** (wichtig für Absolute Paths, Session/Logout). Test validiert gegen DEC.

### Testing (UI Bundles)

- **Vitest:** Unit/Component-Tests (run im UI-Bundle-Verzeichnis)
- **Playwright (static):** Serviert `dist/` – testet gebauten Bundle, Build-Vergessen vermeiden
- **Playwright (live):** Gegen reale Org (`playwright.live.config.ts`), benötigt `PORTAL_USER`/`PORTAL_PASSWORD` – maßgeblich für Login/Logout/Session

## 7. Backend/Sharing (Apex)

### Sharing-Modell

- `Participant__c` ist `externalSharingModel = Private`, Org erzwingt Apex Record Sharing.
- Zugriff über **`Participant__Share`** (Read) pro Portal-User, RowCause **`Portal_Access__c`** (Apex Sharing Reason).
- Services laufen wo sinnvoll `with sharing`, zusätzlich **Identity-Filter** (z. B. `Portal_User__c = UserInfo.getUserId()`), sonst `403 PORTAL_ACCESS_NOT_GRANTED`.
- **Keine** breite `viewAllRecords`-Vergabe für Portal (Least Privilege).

### REST-Endpoints (Trennung)

`@RestResource` pro Klasse (nicht Dispatcher mit Fallback), um Response-Shapes sauber getrennt zu halten:
- `ParticipantPortalData` → `/participant-portal/me`
- `ParticipantPortalLearningPath` → `/participant-portal/me/learning-path`

Return-Type: explizite Response-Klassen (kein `Object` bei `@HttpGet`), Body wird über Return serialisiert.

Details: [`frontend/AGENTS.md`](../frontend/AGENTS.md#three-bugs-that-kept-me-unreachable-found-2026-10-01), [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#portal-access-managed-sharing-not-a-sharing-rule-2026-10-01).

## 8. Sicherheit

- **Profiles nie deployen** (Rollback-Risiko). Nur Permission Sets.
- Portal-Zugriff über Sharing + Identity-Filter (Defense-in-Depth).
- Keine Secrets committen. Environment nur lokal (`.env` nie committet).
- GraphQL Guest Access org-weit konfigurierbar (Security Setting) – siehe Frontend-README/Setup-Hinweise.
- Apex `with sharing` dort wo Daten gelesen werden, explizite Autorisierungsprüfungen zusätzlich.

## 9. Tooling & Scripts

Zentrale Skripte:

| Skript | Zweck | Projekt |
|---|---|---|
| `scripts/org-setup.mjs` | Vollständiges Setup (UI-Bundle Build, Deploy, GraphQL Codegen etc.) | backend/frontend |
| `scripts/preflight-deploy.mjs` | Deploy-Preflight (verbietet unerwünschte Typen) | backend/frontend |
| `scripts/schema-check.mjs` (+ `.apex`, `.test.mjs`) | Prüft Runtime-Schema vs. Source (`schema:check`) | backend |
| `scripts/seed-sample-data.mjs` | Demo-Daten anlegen | backend |
| `scripts/target-org.mjs` | Target-Org-Auflösung (zentral) | backend/frontend |
| `scripts/gen-setup-worklist.py` | Generiert Setup-Worklist aus Metadata (nie manuell editieren) | backend |

## 10. Design-Prinzipien

- **Ownership klar trennen** (zwei Projekte, keine Typ-Überlappung).
- **Source of Truth = Metadata im Repo** (nach Retrieve). Generators vermeiden, wo sie kaputte Strukturen erzeugen (siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#9-never-use-sf-schema-generate--create-schema-manually-then-retrieve)).
- **Verify, don't assume** – Deployment-Report reicht nicht. Runtime prüfen (`schema:check`), Live-Tests dort wo statisch nicht ausreicht.
- **Least Privilege & Defense-in-Depth** (Sharing + Identity-Filter).
- **Explicit over implicit** – gemeinsame Deploys bei Cross-Refs, getrennte REST-Endpoints, Service-Layer für UI-API.
- **Docs trennen:** `AGENTS.md` (Deep-Dive/Troubleshooting, Agent-orientiert), `docs/*.md` (Developer-Onboarding & pragmatische Referenz).