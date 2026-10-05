# Troubleshooting

Kompakte Sammlung der häufigsten Stolperfallen (extrahiert aus [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md) und [`frontend/AGENTS.md`](../frontend/AGENTS.md)).

## 1. Custom Fields landen nicht in Runtime-Schema

**Symptom:** Deployment meldet „Created“, `FieldDefinition` (Tooling API) zeigt Feld, aber SOQL/REST `sobject describe` kennt das Feld nicht (`No such column ...`).

**Ursache:** Neues Custom Field wird über reinen Metadata-Deploy nicht zuverlässig in Runtime-Schema aktiviert.

**Lösung (zwingend):**

1. **Nie per Deploy erstellen.** Feld **manuell in Setup → Object Manager** anlegen.
2. **Ins Source retrieven:**

```bash
sf project retrieve start --metadata CustomField:<Object>__c.<Field>__c --target-org <alias>
```

3. **Prüfen:**

```bash
cd backend && npm run schema:check
```

**Hinweis:** Bereits existierende, gesunde Fields können normal geändert und deployed werden. Nur **neue** Custom Fields benötigen den Setup-Umweg.

Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#12-verify-the-runtime-schema-never-the-deploy-report), [Finding 9](../backend/docs/AGENTS.md#9-never-use-sf-schema-generate--create-schema-manually-then-retrieve).

## 2. Case-Sensitivity (UI API GraphQL)

**Symptom:** UI API GraphQL wirft `FieldUndefined`, obwohl Feld laut Describe existiert.

**Ursache:** GraphQL ist **case-sensitive**. Apex/SOQL sind teilweise case-insensitiv (Map Keys lowercased). API-Name muss exakt stimmen.

**Lösung:** Immer exakten API-Name (`QualifiedApiName`) nutzen (z. B. `Estimated_Weeks__c` nicht falsch case). `schema:check` prüft Case-Sensitivity für die Schreibweise.

Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#12-verify-the-runtime-schema-never-the-deploy-report) (Case-Abschnitt).

## 3. Stales Source Tracking nach `--ignore-conflicts`

**Symptom:** Nach Deploy mit `--ignore-conflicts` schlägt nächster Full-Deploy mit `ExpectedSourceFilesError` (z. B. UI Bundle) fehl.

**Ursache:** Partieller Cache in `.sf/`.

**Lösung (pro Projekt):**

```bash
rm -rf .sf
sf project deploy start --source-dir force-app --target-org <alias> --ignore-conflicts
```

Danach normaler Deploy wieder möglich. `--ignore-conflicts` nur als Reparaturwerkzeug, nicht als Normalfall nutzen.

Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#full-deploys-need-a-clean-source-tracking-after-an-ignore-conflicts-deploy-2026-09-29).

## 4. Experience Cloud – Cross-References erfordern gemeinsamen Deploy

**Symptom:** Deploy von `Network`, `CustomSite`, `DigitalExperienceConfig` getrennt schlägt mit Fehlern wie `no Network named ...`, `PicassoSite ... is not of type ChatterNetworkPicasso` o. ä. fehl.

**Ursache:** Cross-References (`Network.site`, `Network.picassoSite`, DEC.space) werden gegen **Org-Zustand** (nicht gegen gleichzeitig deployte Dateien) validiert.

**Lösung:** **Alle betroffenen Typen in einem einzigen Deploy-Aufruf** übergeben.

```bash
cd frontend
sf project deploy start \
  --source-dir force-app/main/default/networks/Organisator.network-meta.xml \
  --source-dir force-app/main/default/sites/Organisator.site-meta.xml \
  --source-dir force-app/main/default/digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml \
  --source-dir force-app/main/default/digitalExperiences/site/Organisator1
```

Anschließend publishen:
```bash
sf community publish --name Organisator --target-org <alias>
```

Siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#deploy-in-one-call-all-five-types-together).

## 5. React UI Bundle – `appContainer` read-only

**Symptom:** Versuch, bestehende LWR-Site zu React-Container umzuwandeln schlägt mit `Der Wert für die Eigenschaft "$.appContainer" ist schreibgeschützt` fehl.

**Lösung:** React-Site **net-new** anlegen. `appSpace` bei Erstellung leer lassen, in **Phase 2** setzen (ist beschreibbar).

Siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#appcontainer-is-read-only--appspace-is-not).

## 6. `sfdc_cms__languageSettings` nicht deploybar

**Symptom:** Fehler `An unexpected error occurred ... NullPointerException: "value.isAuthoringOnly" is null`.

**Lösung:** Dieses Feld **nicht** ins Source aufnehmen (Platform-Fehler in dieser Org/API-Version). Für Single-Locale-Sites nicht nötig.

Siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#sfdc_cmslanguageSettings-is-not-deployable-here).

## 7. Login/Logout – falsche URL prüfen

**Logout:** Nur `<origin>/organisatorv1vforcesite/secur/logout.jsp` beendet Member-Session zuverlässig in dieser Site. Picasso-Pfad (`/organisatorv1/...`) oder `sfsites/s/logout` funktionieren hier nicht korrekt.

**Login/Data:** Auf Picasso-Prefix `/organisatorv1`, Logout auf ChatterNetwork-Prefix `...vforcesite`. Siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#login-and-logout-paths), [Where logout has to go](../frontend/AGENTS.md#where-logout-has-to-go-and-where-it-must-not-measured-2026-10-02).

## 8. UI-Bundle liest falsche Site-URL

`src/config/site.ts` enthält `SITE_PATH_PREFIX` (Source of Truth). Test `site.test.ts` vergleicht mit `digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml` (**nicht** Network). Bei URL-Änderung DEC + Konstante + Rebuild anpassen.

Siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#SITE_PATH_PREFIX-and-its-source-of-truth).

## 9. Portal: Admin hat keinen Kontakt → erwarteter Fehler

**Symptom:** Eingeloggter Admin sieht App-Shell + `Daten konnten nicht geladen werden. Bitte versuche es später noch einmal.`

**Erklärung:** Korrektes Verhalten. `/me` löst Identity via `User.ContactId → Participant__c`. Interner Admin hat **keinen `ContactId`**, daher keine Participant-Zuordnung. Echtes Portal-Verhalten nur mit User auf externem Profile + Contact + Participant__c testen.

Siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#testing-the-portal-as-an-actual-participant).

## 10. Schema-Check Exit-Codes

| Exit | Bedeutung | Aktion |
|---|---|---|
| `0` | Runtime-Schema entspricht Source | OK |
| `1` | Drift (Existenz/Case unterschiedlich) | Ursache prüfen (Case, fehlendes Field manuell in Setup angelegt? dann retrieven) |
| `2` | Prüf-Skript selbst fehlgeschlagen (Probe/Org) | Org-Check, Target-Org, Apex-Probe prüfen |

## 11. Playwright – Static vs. Live

- **Static (`playwright.config.ts`):** Serviert existierenden `dist/` (`npx serve`). Testet **alten** Build (nie vergessen `npm run build` vor Run). Kann flakier sein.
- **Live (`playwright.live.config.ts`):** Testet gegen echte Site (Credentials nötig: `PORTAL_USER`, `PORTAL_PASSWORD`). Für Login/Logout/Session maßgeblich.

Siehe [`frontend/AGENTS.md`](../frontend/AGENTS.md#the-static-playwright-harness-cannot-verify-logout).

## 12. `.sf`-Cache, CLI-Verhalten, .forceignore

- `.forceignore` deckt nicht alle Fälle ab (CLI-Verhalten variiert). `preflight-deploy.mjs` ist der aktive Guard für kritische Pfade.
- Nach Reparaturen mit `--ignore-conflicts` immer Source-Tracking bereinigen (`rm -rf .sf`).
- Target-Org wird pro Projekt aus `sf config get target-org` (oder `--target-org`) bestimmt, **nicht** hartcodiert.

Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#14-every-deploy-path-runs-a-preflight-forceignore-does-not-count).

## 13. Profile/SharingRules nie deployen

- **Keine Profiles deployen.** Kann Required Fields nicht provisionieren → gesamter Deploy rolled back (Default `rollbackOnError`).
- SharingRules/SharingSets/Profiles werden vom Preflight abgefangen, wenn sie im Deploy-Pfad auftauchen.

Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#never-deploy-profiles-e3), [14](../backend/docs/AGENTS.md#14-every-deploy-path-runs-a-preflight-forceignore-does-not-count).

## 14. Scratch Org vs. Sandbox (Communities)

Experience Cloud/Networks sind in reinen Developer Scratch Orgs teilweise nicht verfügbar. Verhalten unterscheidet sich teils zu Sandboxes. Bei Deploy-Fehlern rund um Network/Communities Org-Typ prüfen.

Siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#918-experience-cloud-is-not-available-in-the-organiser-dev-scratch-org).

## Nützlichste Kommandos (Quick Reference)

```bash
# Schema-Check
cd backend && npm run schema:check

# UI-Bundles bauen
(cd frontend/force-app/main/default/uiBundles/frontend && npm run build)
(cd backend/force-app/main/default/uiBundles/backend && npm run build)

# Vitest
(cd frontend/force-app/main/default/uiBundles/frontend && npx vitest run)
(cd backend/force-app/main/default/uiBundles/backend && npx vitest run)

# Playwright statisch
(cd frontend/force-app/main/default/uiBundles/frontend && npx playwright test)

# Apex Tests
sf apex run test --target-org <alias> --test-level RunLocalTests --wait 10

# Source Tracking bereinigen (nach ignore-conflicts)
rm -rf .sf
```