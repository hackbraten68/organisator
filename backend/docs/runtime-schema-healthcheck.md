# Runtime-Schema-Healthcheck

Ab hier gilt: **dem Runtime-Schema glauben, nicht dem Deploy-Report.**

## Das Problem

Ein erfolgreicher Deploy beweist nicht, dass Custom-Felder das Runtime-Schema erreicht
haben. In diesem Projekt gilt seit 2026-09-24 (siehe
`AGENTS-salesforce-runtime-schema-troubleshooting.md`) folgendes Muster:

```text
sf project deploy start          → Succeeded, 0 Fehler, componentSuccesses mit echten IDs
Tooling API FieldDefinition      → Feld vorhanden
Metadata API                     → Feld vorhanden
sf project retrieve              → "Nothing retrieved"
REST describe                    → Feld fehlt
SOQL / Apex                      → "No such column"
```

Alle Metadaten-APIs sind sich einig, das Feld existiere. Es existiert nur nicht dort, wo
man es benutzt. Ursache ist nicht das Quell-XML: nachweislich funktioniert `Module__c.Program__c`
und `Learning_Path__c.Program__c` ist strukturell identisch, funktioniert aber nicht. Ein
frisch deploytes Text-Feld verschwindet genauso wie ein Picklist.

## Das Werkzeug

```bash
cd /home/sam/github/organisator/backend
npm run schema:check
```

Zwei Dateien dahinter:

| Datei                       | Rolle                                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| `scripts/schema-check.apex` | Läuft per `execute-anonymous` im Org und liest das echte Runtime-Schema aus   |
| `scripts/schema-check.mjs`  | Führt den Probe aus, liest `objects/*/fields/*.field-meta.xml` und vergleicht |

### Was der Apex-Probe prüft

Für jedes der 11 Objekte vier Ebenen:

| Prüfung                       | Beweist                                         |
| ----------------------------- | ----------------------------------------------- |
| `fields.getMap()`             | Das Feld existiert im Runtime-Schema            |
| `SELECT <alle Custom-Felder>` | Das Feld ist in einer Abfrage benutzbar         |
| `newSObject()`                | Das Objekt ist mit seinen Feldern konstruierbar |
| `insert` / `delete`           | Das Feld ist tatsächlich schreibbar             |

`insert` ist **beratend**: Ein Fehler, dessen Meldung `no such column`, `invalid field`,
`unknown field` oder `does not exist` enthält, ist die Fehlersignatur und zählt als Fehler.
Jeder andere Fehler wird als `SKIPPED` gemeldet, weil er meist eine Fachregel ist
(Pflichtfeld, Picklist-Standard) und kein Schema-Defekt.

> Der SOQL-Check im Apex-Probe selektiert nur die Felder, die `describe` auch gemeldet hat —
> er kann also konstruktionsbedingt nicht an einem Feld scheitern, das er nie gesehen hat.
> Der interessante Vergleich ist Org gegen Repo, und den macht `schema-check.mjs`.

### Geistfelder

Zusätzlich fragt `schema-check.mjs` die Tooling-API, um fehlende Felder zu klassifizieren:

| Markierung         | Bedeutung                                                       |
| ------------------ | --------------------------------------------------------------- |
| `[Geistfeld]`      | In `FieldDefinition` vorhanden, aber nie ins Runtime kompiliert |
| `[fehlt ueberall]` | Gar nicht erst angelegt                                         |

Aktuell sind **alle 24 verbleibenden Felder Geistfelder**. Sie sind also angelegt; es fehlt
der Nachweis, dass ein Neuanlegen etwas ändert.

### Belegt: manuelles Anlegen funktioniert, Deploy nicht

Kontrollversuch E1 am 2026-09-29 (`Program__c.Status__c`, siehe
[`schema-repair-checklist.md`](./schema-repair-checklist.md)):

| Art der Erzeugung         | `FieldDefinition` | Runtime-Schema | Retrieve    |
| ------------------------- | ----------------- | -------------- | ----------- |
| `sf project deploy start` | vorhanden         | **fehlt**      | leer        |
| manuell in Setup          | vorhanden         | **vorhanden**  | vollständig |

Der Retrieve des manuell angelegten Feldes war byte-identisch (988 Bytes) mit der
Repo-Fassung von vorher. Die Reparatur erzeugt also null Diff.

**Konsequenz für künftige Deploys:** die im Repo gehaltenen Objekt-Metadaten sind nicht
zuverlässig deployfähig. Wer ein **neues** Custom-Feld braucht, legt es in Setup an und
retrievt es — `sf project deploy start` für Custom-Felder nicht verwenden. Jeder Deploy in
eine frische Org erzeugt die Lücke erneut.

### Belegt: Änderungen an bestehenden Feldern deployen normal

Kontrollversuch E2 am 2026-09-29 (`Participant__c.Contact__c` →
`required=false`→`true`, `deleteConstraint` `SetNull`→`Restrict`):

| Prüfung                              | Ergebnis                   |
| ------------------------------------ | -------------------------- |
| Insert `Participant__c` ohne Contact | `REQUIRED_FIELD_MISSING`   |
| Contact mit Teilnehmer löschen       | `DELETE_FAILED`, bleibt da |
| `sf project retrieve`                | liefert `required=true`    |
| `npm run schema:check`               | Exit 0                     |

**Die Regel aus E1 gilt damit nur für das Anlegen neuer Felder.** Eine Änderung an einem
Feld, das sauber im Runtime-Schema liegt, wird ganz normal deployed und ist sofort wirksam.

Praktische Folge: Nach der Reparatur ist die normale Deployment-Workload wieder verfügbar.
Nur für **neue** Custom-Felder braucht es den Umweg über Setup. Phase 1 besteht deshalb aus
Änderungen an bestehenden Feldern plus neuen Apex-Klassen — beides normal deploybar.

> Einschränkung: der Vergleich ist symmetrisch. Fehlt ein Feld aus **beiden** Seiten
> (Repo und Org), meldet der Healthcheck `ok` — er kann nicht unterscheiden, ob ein Feld
> absichtlich entfernt wurde oder kaputt ist.

### Exit-Codes

| Code | Bedeutung                                                            |
| ---- | -------------------------------------------------------------------- |
| 0    | Runtime-Schema entspricht dem Repository                             |
| 1    | Drift zwischen Runtime-Schema und Repository                         |
| 2    | Der Probe selbst ist fehlgeschlagen (Auth, Compile-Fehler, Netzwerk) |

### Standardobjekte

`Account` ist mit auf der Liste und erscheint mit `0 / 0 ok`. Das ist korrekt:
`objects/Account/` enthält 31 **Standard**-Salesforce-Felder, die zum Referenzzweck
retrieviert wurden. Sie tragen kein `__c`-Suffix und gehören nicht ins Custom-Schema.
Der Vergleich wertet deshalb auf beiden Seiten nur `__c`-Felder.

---

## Stand 2026-09-29 nach der Reparatur, Org `organiser-dev` (00D9b00000dO8XR)

```text
Objekt               Repo  Org  Status
Absence__c             11   11  ok
Account                 0    0  ok
Appointment__c         13   13  ok
AuditEvent__c          22   22  ok
AuditOutbox__c          9    9  ok
AvailabilitySlot__c     8    8  ok
Coach_Profile__c        6    6  ok
Learning_Path__c        6    6  ok
Module__c               3    3  ok
Participant__c          9    9  ok
Program__c              3    3  ok
```

**90 von 90 Custom-Feldern im Runtime-Schema. `npm run schema:check` → Exit 0.**

Ausgangslapse war 25 fehlende Felder in fünf Objekten, darunter 11 von 22 in `AuditEvent__c`
— das Audit-Subsystem war in einem frischen Org funktionsunfähig, obwohl
`AbsenceStatusAuditTest` grün lief (die Tests decken `Absence__c` und `Participant__c` ab,
nicht `AuditEvent__c`).

Die vollständige Anlage-Liste mit Settings steht in
[`schema-repair-checklist.md`](./schema-repair-checklist.md).

## Praxis: ein neuer Org ohne manuelle Vorarbeit

```bash
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias organiser-dev --set-default --target-dev-hub test

sf project deploy start --target-org organiser-dev   # nur Code, keine Custom-Felder
node scripts/seed-sample-data.mjs --target-org organiser-dev
npm run schema:check
```

Damit ist ein Org **startklar für die Daten**. Für das **Schema** gilt das nicht — siehe
unten. Zwei Voraussetzungen, bevor der Ablauf trägt:

- Das Schema muss einmalig in Setup angelegt und abgerufen worden sein (Regel 2).
- Der Deploy darf **keine Profile** enthalten. Siehe unten.

## Grenze: ein frischer Org bekommt sein Schema nicht deployed

Kontrollversuch E3 am 2026-09-29. Neuer Scratch-Org, vollständiger
`sf project deploy start`, danach gemessen:

```text
Objjekt               Repo  Org  Status
Absence__c             11    5  FEHLT IM ORG
Appointment__c         13    5  FEHLT IM ORG
AuditEvent__c          22   11  FEHLT IM ORG
AuditOutbox__c          9    3  FEHLT IM ORG
AvailabilitySlot__c     8    8  ok
Coach_Profile__c        6    4  FEHLT IM ORG
Learning_Path__c        6    2  FEHLT IM ORG
Module__c               3    1  FEHLT IM ORG
Participant__c          9    9  ok
Program__c              3    3  ok

DRIFT: 59 von 90 Custom-Feldern fehlen im Runtime-Schema
```

**Ein Deploy kann dieses Schema nicht erzeugen.** Die Objekte existieren danach, aber 59
ihrer Felder sind Geistfelder. Das ist dieselbe Lücke wie in E1, nur über alle Objekte
statt über einzelne Felder.

Für Phase 2 heißt das: ein neuer Org braucht **einen** manuellen Schritt — das Schema
einmalig in Setup anlegen und abrufen. Alles andere ist automatisierbar.

### Nebenbefund E3: Profile brechen den ganzen Deploy

Der erste Deploy in den frischen Org schlug fehl und hat wegen `rollbackOnError`
**alle 480 Komponenten zurückgerollt**, saemtliche CustomObjects inklusive:

```text
FAIL Admin                              Sie können kein Pflichtfeld bereitstellen: Participant__c.Contact__c
FAIL B2B Reordering Portal Buyer Profile Sie können kein Pflichtfeld bereitstellen: Participant__c.Contact__c
```

Ein Profile-Deploy darf kein Pflichtfeld provisionieren. Beide Profile waren Template-Reste
und wurden nirgends zugewiesen — zugewiesen wird nur das Permset `backend_Access`. Sie
sind seit dem 2026-09-29 aus Source entfernt; danach laeuft der vollstaendige Deploy
durch.

Die Lehre ist allgemeiner als dieses Projekt: **ein fehlgeschlagener Komponenten-Deploy
ist bei `rollbackOnError` ein Null-Deploy.** Wer nur auf die Fehlerliste schaut und nicht
auf den Gesamtstatus, glaubt, es sei fast alles drin.

## Regeln für Schema-Arbeit

1. **Nach jedem Deploy `npm run schema:check` laufen lassen.** Ein grüner Deploy ist kein
   Beweis.
2. **Custom-Felder niemals deployen. In Setup anlegen, dann `sf project retrieve`.** Ein
   deploytes Feld erscheint in `FieldDefinition`, aber nie im Runtime-Schema. Belegt durch
   Kontrollversuch E1. Gilt für neue Felder auf bestehenden Objekten wie für neue Objekte.
3. **Nach dem Retrieve `git diff` prüfen.** Ziel ist ein leerer Diff. Jede Abweichung
   gehört bewusst ins Repo oder zurück ins Setup.
4. **Nie `sf schema generate` benutzen** — Generierung, manuelles Anlegen in Setup, dann
   Retrieve. Siehe Finding 9 in `AGENTS.md`.
5. **Basisdaten kommen aus dem Seed**, nicht aus Setup. `seed-sample-data.mjs` legt
   Account, Programme, Coaches und Contacts selbst an und legt vorhandene Datensätze
   wiederverwendend, statt zu scheitern.

---

## Offen: `Admin.profile-meta.xml` ist im Org ein No-Op

Beim Aufräumen von `Student_Test__c` (2026-09-29) fiel auf, dass Profile-Deploys hier
nicht das tun, was sie zu tun scheinen:

```text
force-app/main/default/profiles/Admin.profile-meta.xml
  fullName: Admin
  userLicense: Salesforce

Im Org (Developer Edition, deutsche Locale):
  Systemadministrator
  Standardbenutzer
  ...
  → kein Profil namens "Admin"
```

`sf project deploy start --source-dir force-app/main/default/profiles` meldet
`Admin | success: True | changed: True`, aber im Org existiert danach weiterhin kein
Profil `Admin`. `B2B Reordering Portal Buyer Profile` dagegen **existiert** im Org und
wird vermutlich korrekt aktualisiert.

**Konsequenz:** Die in `Admin.profile-meta.xml` gepflegten Objekt- und Feld-Berechtigungen
sind in diesem Org **nicht angewendet**. Der laufende User hat sie über
`Systemadministrator`, nicht über dieses Profil.

Verifiziert wurde das Gegenstück: `Schema.isAccessible/isCreateable/isUpdateable` ist für
alle 11 Objekte `true`, der Org ist also intakt. Offen bleibt, _wohin_ Salesforce den
Deploy schreibt.

**Für Phase 2 relevant:** Die Portal-Berechtigungen laufen über Permission Sets, nicht
über Profile. Ob ein Permission-Set-Deploy in diesem Org tatsächlich greift, muss vor
Phase 2 explizit verifiziert werden und darf nicht aus dem Deploy-Report abgeleitet
werden.
