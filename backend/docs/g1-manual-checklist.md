# Gate G1 — was in Salesforce manuell zu erledigen ist

Stand 2026-10-07. Zielorg `hubSandbox` (`https://techandteach--devhub.sandbox.my.salesforce.com`).

> ### ✅ Gate G1 ist durchgelaufen — Ergebnis vom 2026-10-07
>
> Diese Liste ist als Arbeitsanleitung geschrieben worden und wurde danach vollständig
> abgearbeitet. Die Ergebnisse sind in `security-audit-report.md` **Abschnitt 4** festgehalten.
> Kurzfassung, damit niemand die Liste erneut von vorn abarbeitet:
>
> | Punkt | Ergebnis |
> |---|---|
> | Sharing Reason `Portal_Access__c` | vorhanden auf `Participant__c` **und** `Learning_Path__c` |
> | OWD `Participant__c` | intern **Public Read/Write**, extern Private — *nicht* Private, siehe S6 |
> | OWD `Audit-Event` | intern **Private** — einziges Sonderfall, `viewAllRecords` ist dort tragend |
> | OWD `Contact` / `Account` | Controlled by Parent / intern Public Read/Write — siehe S7 |
> | Sharing Rule `Participant__c` | **existiert und wirkt** (`Portal User = $User.Id` → `Portal_Participants`, Read Only) |
> | Sharing Rule `Account` | keine |
> | Coach-Profil | **existiert nicht** — Coaches hängen an `Standardbenutzer AM` (S8) |
> | Transaktionssicherheitsrichtlinie | in dieser Org nicht vorhanden |
> | Clickjack / CSRF | Werkseinstellung, aktiv, nicht änderbar |
> | Externe Weiterleitungen | „With user's permission" — Konvention in `AGENTS.md` hinterlegt |
> | `npm run schema:check` | grün, 92 Felder in 10 Objekten |
>
> **Vier Fehlwege, die Zeit gekostet haben und im Bericht unter 4b stehen:** Im Lightning
> Object Manager gibt es keinen OWD-Abschnitt (nur „Edit Custom Object"); ein Objektfilter mit
> App-Präfix existiert nur in Classic; Sharing Rules auf `Contact` sind bei „Controlled by
> Parent" nicht anlegbar; Transaktionssicherheitsrichtlinien fehlen komplett, wenn die Funktion
> in der Org nicht aktiviert ist.

Gate G1 steht vor zwei Dingen: Paket P3 (`defaultSharing`/`AppointmentRequest__c`) aus
`.opencode/plans/security-fixes-plan.md` und Plan-Schritt 1 aus
`.opencode/plans/appointment-request-plan.md`. Beide setzen Organ-Wissen voraus, das nicht
im Repo steht.

**Zwei Korrekturen an der Planung, die dieser Schritt zutage fördert:**

1. **`<sharingModel>` ist nicht der OWD.** In allen 11 `*.object-meta.xml` steht
   `sharingModel` — das ist das *interne Default-Level* (bei Standard-Lookups `ReadWrite`),
   nicht die org-weite Freigabe. Ein `<defaultSharing>`-Element gibt es im Repo **nirgends**,
   und der OWD ist über die Metadata API **nicht deploybar**. P3 ist damit **kein Commit**,
   sondern ein Setup-Schritt in dieser Liste. Genau deshalb konnte die Aussage in
   `frontend/.../participantApi.ts:9-13` („Participant__c has an external org-wide default of
   `Private`") nicht aus dem Repo belegt werden.
2. **⚠️ Nachtrag 2026-10-07: die erste Fassung dieser Notiz war falsch.** Sie lautete
   „die Sharing Rule existiert nicht, weil die Org `$User…` nicht auswertet". Das war eine
   Verwechslung zweier Mechanismen, und Gate G1 hat sie aufgedeckt:

   - **Formelfelder** werten `$User` tatsächlich nicht aus. `portal-deploy-status.md` ist
     korrekt: beide Varianten (`$User.Id`, `$User.UserRecord.Id`) liefern 404, statische
     User-ID 200.
   - **Sharing-Rule-Kriterien** auf einem Lookup-Feld werten zur Laufzeit aus. Die Regel
     existiert, heisst nur anders als der Kommentar in
     `Participant_Portal_Access.permissionset-meta.xml:65` behauptet:
     `Portal User = $User.Id` → Gruppe `Portal_Participants`, **Read Only**.

   Der Portal-Zugang ist damit dreifach abgesichert: OWD Private + Sharing Rule + Apex
   Managed Sharing (`Portal_Access__c`). **Der Kommentar im Permission Set bleibt trotzdem
   irreführend und sollte korrigiert werden** — er nennt einen Regelnamen, den es nicht
   gibt, und legt damit einen falschen Reparaturpfad nahe.

---

## Teil A — Teilnehmer-Isolation (G1b)

### A1 · Apex Sharing Reason auf `Participant__c` prüfen

**Muss** existieren, sonst kompiliert `ParticipantPortalSharingService` nicht
(`Schema.Participant__Share.RowCause.Portal_Access__c`).

```text
Setup → Switch to Salesforce Classic   (oben rechts im Profilmenü)
     → Build → Create → Objects
     → Participant  (den Objektnamen anklicken, nicht „Edit")
     → Related List „Apex Sharing Reasons"
```

Erwartet: Label `Portal Access`, Name `Portal_Access`.

Zwei Dinge, die dabei regelmäßig falsch eingeschätzt werden:

- Der Eintrag **fehlt im Lightning Object Manager vollständig**. Ein leerer Object Manager
  ist kein Hinweis auf einen Org-Defekt — die Oberfläche muss wirklich wechseln.
- `ApexSharingReason` fehlt in der Registry des `@salesforce/cli`, der Grund ist also
  **nicht deploybar**. Er muss einmalig von Hand entstehen.

Berechtigung: *Author Apex*. *Modify All Data* betrifft nur das Anlegen der
Share-Datensätze, nicht das Definieren des Grundes.

### A2 · Apex Sharing Reason auf `Learning_Path__c` prüfen  ← **neu, im Repo nicht dokumentiert**

`ParticipantPortalSharingService` verwendet `Portal_Access__c` **auch** für
`Learning_Path__Share` (`LEARNING_PATH_ROW_CAUSE`) und referenziert
`Schema.Learning_Path__Share.RowCause.Portal_Access__c`. Ein Sharing Reason gilt aber
**pro Objekt** — der Grund auf `Participant__c` gilt auf `Learning_Path__c` nicht.

```text
Classic → Setup → Build → Create → Objects
        → Learning Path (Objektnamen anklicken)
        → Related List „Apex Sharing Reasons" → New
            Label: Portal Access
            Name:  Portal_Access
```

`portal-deploy-status.md` dokumentiert nur den Grund auf `Participant__c`, listet aber
vier `Learning_Path__c`-Shares mit `RowCause = Portal_Access__c` — der Grund **existiert in
der Org also bereits**. Diese Prüfung bestätigt ihn nur und schließt die Dokumentationslücke.

**Repo-Lücke, die ich unabhängig davon beheben kann:** Nur `Participant__c.object-meta.xml`
enthält ein `<sharingReasons>`-Element. `<sharingReasons>` ist gültiges, deploybares
`CustomObject`-Metadatum — der Eintrag für `Learning_Path__c` fehlt also nur im Manifest.
Ein Deploy ohne ihn entfernt den Org-Zustand nicht, aber der Auszug aus der Org ist dann
unvollständig und ein späteres `sf project retrieve` würde den Eintrag als „lokal fehlend"
zurückschreiben.

### A3 · Portal-User-Zuordnung prüfen (G6 aus dem Security-Report)

```text
Setup → Users → mehmet.kaya.portal@codingschule.de.devhub
     → ContactId gesetzt?  0039X000023sDyWQAU
     → Permission Set „Participant Portal Access" zugewiesen?
```

Dann je Teilnehmerzeile:

```text
Participant__c.Portal_User__c  =  0059X00000rOHULQA4   (Mehmet)
Participant__c.Portal_User__c  =  0059X00000qeMkQQAU   (Probe)
```

Und die Share-Zeile daneben. Fehlt eine Share, ist `synchroniseAll()` der richtige
Reparaturweg (siehe A4), nicht ein manueller Share.

### A4 · `synchroniseAll()` — wann und warum

```text
Setup → Developer Console → Execute Anonymous
→ ParticipantPortalSharingService.synchroniseAll();
```

Aufrufen, wenn: Shares fehlen oder hängen (Import über Setup/Data Loader, Trigger war
inaktiv), oder wenn `PORTAL_ROW_CAUSE` jemals geändert wurde. `RowCause` ist kein
schreibbares Feld (`Field is not writeable: Participant__Share.RowCause`), Shares lassen
sich also **nicht** in-place umstellen — alte Zeilen müssen gelöscht und neu angelegt
werden, das erledigt dieser Aufruf in beide Richtungen.

Der Aufruf berührt ausschließlich Shares mit `Portal_Access__c`; eine manuelle
Admin-Freigabe (`RowCause = Manual`) bleibt unangetastet.

**Misch-DML-Falle:** Getrennte Execute-Anonymous-Läufe für Setup-Objekte und
`Participant__c`, sonst `MIXED_DML_OPERATION`.

### A5 · Negativtest, der beweist, dass die Isolation trägt

```text
Probe-Share entziehen  →  Mehmet 200, Probe-User 404
Probe-Share wiederherstellen → beide 200 mit eigener Zeile
```

Beide User teilen sich **denselben** Account (`0019X00002OOmgDQAT`). Die Isolation ist
also nachweislich pro User und nicht zufällig pro Account — das ist der Punkt des Tests.

Geprüft wird über `GET /organisatorv1/sf/api/services/apexrest/participant-portal/me` mit
echter Portal-Session **im Browser-Kontext**. Über die REST-Daten-API mit
`Authorization: Bearer` funktioniert es **nicht** (`INVALID_SESSION_ID: This session is not
valid for use with the REST API`) — Experience-Cloud-Sessions sind dort ungültig, man bekommt
also immer `NO_CONTACT_IDENTITY` und damit ein falsches grün.

---

## Teil B — org-weite Freigaben (G1a)

### B1 · Teil A der Tabelle auslesen

```text
Setup → Sharing → Sharing Settings → Object filter „Organisator"
```

Für **alle 11 Objekte** notieren: *Default Internal* und *Default External*.

| Objekt | Erwartung laut Repo-Befund | Bemerkung |
|---|---|---|
| `Participant__c` | intern **Public Read/Write**, extern **Private** | `externalSharingModel=Private` steht im Metadatum |
| `Account` | Public Read/Write | Coaches lesen heute alle Standardfelder, 0 Feldrechte im Set |
| `Appointment__c`, `Absence__c`, `Program__c`, `Module__c`, `Learning_Path__c`, `AvailabilitySlot__c`, `Coach_Profile__c`, `AuditOutbox__c` | Public Read/Write | |
| `AuditEvent__c` | **intern Private** | einziges Objekt mit Private; `backend_Coach` umgeht das mit `viewAllRecords` |

Die Evidenz für „intern Edit" ist keine Vermutung, sie steht im Org-Fehlertext:

```text
FIELD_INTEGRITY_EXCEPTION: AccessLevel (trivial share level Read,
                            for organization with default level Edit)
```

Der auftauchte, als ein **interner** Admin als Release-Ziel getestet wurde. Externe
Portal-User bekommen `Read` korrekt. **Bitte in Setup gegenlesen**, nicht diese Zeile
abschreiben.

### B2 · Was danach zu entscheiden ist

Der Security-Report (S6) nennt als fehlende Härtung: **kein Objekt hat `Private`**, und
`viewAllRecords` in `backend_Coach` macht den OWD ohnehin bedeutungslos für Coaches. Ein
OWD-Wechsel auf `Private` ist eine **globale, dauerhafte** Freigabe und würde Coach-Zugriffe
über das Permission Set ersetzen — das ist E1 und damit die Entscheidung des Chefs
(`.opencode/plans/refactor-security-plan.md`), **nicht** Teil dieses Gates.

Für G1 zählt nur: **Ist der Ist-Zustand das, was die Doku behauptet?** Ein „Private", wo die
Doku „Public Read/Write" erwartet, wäre ein eigener Befund.

### B3 · Was ausdrücklich nicht zu tun ist

- **Kein OWD per Deploy.** Org-weite Freigaben sind über die Metadata API nicht
  deploybar. Ein Versuch über `<defaultSharing>` im `object-meta.xml` ist nicht möglich —
  im Repo steht deshalb bewusst keins.
- **Keine Sharing Rule bauen.** Siehe Einleitung, Punkt 2 — sie wurde gemessen und
  verworfen.

---

## Teil C — was sonst noch in der Org liegt (G1c)

### C1 · Profile

```text
Setup → Users → Profiles
```

Zu prüfen:

1. **Welche Profile existieren überhaupt?** Bekannt sind aus dem Repo nur System Administrator
   und `Customer Community Plus User` (Portal). `coach-fls-checkliste.md` empfiehlt ein
   eigenes Profil `Coach`, es ist aber **nicht deployt** (`.forceignore` plus
   `scripts/preflight-deploy.mjs`, Kontrolltest E3) — es existiert möglicherweise gar nicht.
2. **Welches Profil trägt die Coaches?** Davon hängt ab, ob A2 (FLS) überhaupt jemanden trifft.
3. **Enthält das Coach-Profil `viewAllRecords`?** Falls das aus einem Altbestand kommt, ist
   A1 teilweise doppelt belegt.
4. **App-Zugriff:** Setup → Profiles → dein Profil → *App Settings* → *App Access* →
   `backend` auf **Visible**. Ohne das ist die Backend-App für das Profil unsichtbar.
   `org-setup.config.json` weist nur `backend_Access` an `currentUser` zu — **`backend_Coach`
   wird nirgends automatisch zugewiesen**, das ist Handarbeit pro Coach.

### C2 · Fremde Sharing Rules und Criteria

```text
Setup → Sharing → Sharing Settings → Suche nach „Rule"
```

Jede Regel auflisten, die auf unseren Objekten liegt. Zu erwarten ist **keine** — jede
existierende Fremdregel ist ein Kanal, den die `viewAllRecords`-Diskussion (E1) nicht
berührt, weil sie hinter dem Permission Set liegt.

### C3 · Transaktionssicherheitsrichtlinien

Im Repo liegt
`transactionSecurityPolicies/sfdc_default_ReportExport_Protection.transactionSecurityPolicy-meta.xml`
mit `twoFactorAuthentication=true`, `useStepUp=true`, `block=false`. `block=false` heißt:
die Richtlinie **erzwingt nichts**, sie fragt nur nach. In der Org prüfen, ob sie aktiv ist —
ein wirksamer Export-Schutz wäre ein kostenloser Teilsieg gegen A1.

### C4 · Apex-Tests

```text
sf apex run test --target-org hubSandbox --code-coverage --result-format human --wait 10
```

Vor allem `ParticipantPortalSharingServiceTest` (21 Tests) und `ParticipantPortalDataTest`
(10 Tests). Vor **jedem** Deploy, weil beide Projekte in dieselbe Org deployen und ein
Fehlschlag des einen das andere zurückrollt.

> `TMPDIR=/home/sam/tmp` setzen — `/tmp` ist ein 16G-tmpfs, das von einem fremden
> Windows-VM-Image gefüllt ist, sonst `ENOSPC`.

---

## Teil D — Voraussetzung für P3, die beim manuellen Anlegen gleich auffällt

**In dieser Sandbox schlägt das Anlegen neuer Custom-Felder über die Metadata API still
fehl.** Der Deploy meldet `Created`, `describe` zeigt das Feld nicht, SOQL sagt
`No such column`. Betroffen waren `Participant__c.Portal_User__c` und `Portal_User_Id__c`.
`schema-repair-checklist.md` hat das gegen einen Mythos geprüft und den manuellen Weg als
einzigen funktionierenden bestätigt.

Konsequenz für `AppointmentRequest__c`: **das Objekt und seine Felder müssen in Setup
angelegt werden, nicht deployed.** Ein erfolgreicher Deploy ist hier kein Nachweis.

Prüfwerkzeug danach:

```bash
cd backend && npm run schema:check
```

Liest das echte Runtime-Schema per Apex-Probe und vergleicht es gegen
`objects/*/fields/*.field-meta.xml` — vier Ebenen je Objekt (`fields.getMap()`,
`describe`, Tooling-API-`FieldDefinition`, SOQL). Ein Objekt ohne Custom-Felder bekommt
trotz eine Zeile, damit es nicht stillschweigend übersprungen wird.

---

## Checkliste zum Abhaken

| # | Punkt | Wo | Erwartung |
|---|---|---|---|
| A1 | Sharing Reason `Portal_Access__c` auf `Participant__c` | Classic Setup | vorhanden, Label „Portal Access" |
| A2 | Sharing Reason `Portal_Access__c` auf `Learning_Path__c` | Classic Setup | vorhanden (bisher nirgends dokumentiert) |
| A3 | Portal-User: `ContactId`, Permission Set, `Portal_User__c` | Setup → Users | 2 User vollständig |
| A4 | `synchroniseAll()` nur bei Abweichung | Execute Anonymous | 4 Shares, alle `Portal_Access__c` |
| A5 | Negativtest: Probe-Share entziehen | Browser-Session | Probe-User 404, Mehmet 200 |
| B1 | OWD aller 11 Objekte | Sharing Settings | Tabelle in B1, insbesondere `AuditEvent__c` = Private |
| C1 | Profile + `backend`-App-Zugriff | Setup → Profiles | Liste der Profile zurückmelden |
| C2 | Fremde Sharing Rules | Sharing Settings | vermutlich keine |
| C3 | Report-Export-Richtlinie aktiv? | Setup | `block=false` heißt: nur Step-Up |
| C4 | `sf apex run test` | CLI | 100 % oder dokumentierte Ausnahmen |

## Was ich danach im Repo machen kann

- `<sharingReasons>` für `Learning_Path__c` ergänzen (deploybares Metadatum, Org-Zustand
  bleibt unberührt).
- Den irreführenden Kommentar in `Participant_Portal_Access.permissionset-meta.xml:65`
  korrigieren — er beschreibt die Sharing Rule als wirksam, sie ist es nachweislich nicht.
- P3 in `security-fixes-plan.md` von „Commit" auf „Setup-Schritt, Liste hier" umschreiben und
  `defaultSharing` als nicht deploybarstreichen.
