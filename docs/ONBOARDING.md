# Onboarding

Kurzer, praxisorientierter Pfad für den ersten Start mit dem Organisator-Monorepo.

## 1. Voraussetzungen

- [Node.js](https://nodejs.org/) **v18+**
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) – installiert & authentifiziert
- Dev Hub verfügbar (Scratch Orgs) oder Zugriff auf Ziel-Sandbox

Prüfen:

```bash
node --version
sf --version
sf org list dev-hub
```

## 2. Repository klonen & Dependencies

```bash
git clone <repo-url> organisator
cd organisator

# Dependencies installieren (beide Projekte)
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

## 3. Target-Org konfigurieren (pro Projekt)

Jede SFDX-Projektkonfiguration speichert die Target-Org **lokal** (`.sf/`, gitignored). Einmalig pro Maschine:

```bash
cd backend
sf config set target-org=<alias-backend>
cd ../frontend
sf config set target-org=<alias-frontend>
```

Kann derselbe Alias sein (beide Projekte deployen in dieselbe Org).

Prüfen:

```bash
sf config get target-org
```

## 4. Org vorbereiten (Setup)

Setup baut UI-Bundles, deployed Metadata und führt Vorbereitungen durch. Am einfachsten mit `--yes`:

```bash
# Backend zuerst (Metadata + internes UI-Bundle)
cd backend
npm run setup -- --target-org <alias> --yes

# Frontend danach (Experience Cloud + Portal UI-Bundle)
cd ../frontend
npm run setup -- --target-org <alias> --yes
```

Interaktiver Modus ohne `--yes`:
```bash
npm run setup -- --target-org <alias>
```

Hilfe zu Optionen:
```bash
npm run setup -- --help
```

> **Hinweis:** `preflight-deploy.mjs` wird automatisch ausgeführt und bricht bei unerwünschten Deploy-Typen ab.

## 5. Schema erstellen (falls noch nicht vorhanden)

**Wichtig:** Neue Custom Fields **niemals per Deploy erstellen**. Nur manuell in Setup anlegen, dann retrieven.

1. In Salesforce Setup → Object Manager die benötigten Custom Objects/Fields anlegen (Orientierung: [`docs/DATA_MODEL.md`](DATA_MODEL.md), [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md)).
2. Ins Source retrieven:

```bash
cd backend
sf project retrieve start --metadata CustomObject:<Object>__c --target-org <alias>
# oder gezielt Fields
sf project retrieve start --metadata CustomField:<Object>__c.<Field>__c --target-org <alias>
```

3. Runtime-Schema prüfen:

```bash
cd backend && npm run schema:check
```

Exit 0 = OK. Bei Exit 1 (Drift) prüfen, ob Case/Existenz korrekt ist. Exit 2 = Prüfungsfehler.

## 6. Demodaten laden (optional)

```bash
cd backend
node scripts/seed-sample-data.mjs
```

Details: [`backend/scripts/seed-sample-data.README.md`](../backend/scripts/seed-sample-data.README.md).

## 7. Lokale Entwicklung starten

**Portal (Frontend UI-Bundle):**
```bash
cd frontend/force-app/main/default/uiBundles/frontend
npm run dev
# http://localhost:5173
```

**Backoffice (Backend UI-Bundle):**
```bash
cd backend/force-app/main/default/uiBundles/backend
npm run dev
# http://localhost:5173 (Vite Standard)
```

## 8. Erstes Deployment (gezielte Varianten)

Komplett:
```bash
sf project deploy start --source-dir force-app --target-org <alias>
```

Nur UI-Bundles:
```bash
sf project deploy start --source-dir force-app/main/default/uiBundles --target-org <alias>
```

Experience Cloud (muss **gemeinsam** deployed werden):
```bash
sf project deploy start \
  --source-dir force-app/main/default/digitalExperienceConfigs \
  --source-dir force-app/main/default/digitalExperiences \
  --source-dir force-app/main/default/networks \
  --source-dir force-app/main/default/sites \
  --target-org <alias>
```

## 9. Quick-Checks nach Setup

- UI-Bundles bauen ohne Fehler (`npm run build` in jeweiligen UI-Bundle-Dirs)
- Vitest grün: `npx vitest run` (je UI-Bundle)
- Schema-Check ok: `cd backend && npm run schema:check`
- Apex Tests grün (falls vorhanden): `sf apex run test --target-org <alias> --test-level RunLocalTests --wait 10`

## Tipps

- **Cache nach `--ignore-conflicts`:** Falls jemals mit `--ignore-conflicts` deployed wurde, kann Source Tracking partiell werden. Reparatur: `rm -rf .sf && sf project deploy start --ignore-conflicts --target-org <alias>` (pro Projekt gezielt). Siehe [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
- **Experience Cloud Scratch Orgs:** In reinen Developer Scratch Orgs kann Communities/Network teils eingeschränkt sein. Details in [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#918-experience-cloud-is-not-available-in-the-organiser-dev-scratch-org).
- **Datenbank-Sharing vs. Deploy:** Runtime-Schema ≠ Deploy-Report. Immer `schema:check` nutzen bei Schema-Arbeit.