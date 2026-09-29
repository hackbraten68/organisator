# Spike 1.5 — Sharing und Lizenz für externe Portal-User

**Stand:** 2026-09-29
**Org bei der Messung:** `organiser-dev` (`00D9b00000dO8XREA0`)
**Protokoll:** [`spike-sharing-1.5.md`](./spike-sharing-1.5.md)
**Ergebnis:** Teil A abgeschlossen, **Teil B ist durch die Org blockiert** — nicht durch eine
fehlende Lizenz. Details und Beweise unten.

---

## 1. Ist-Zustand der Sharing-Konfiguration

Alle Objekte, die das Portal später liest, stehen auf `externalSharingModel = Private`:

| Objekt             | `sharingModel` | `externalSharingModel` | `enableSharing` |
| ------------------ | -------------- | ---------------------- | --------------- |
| `Participant__c`   | ReadWrite      | **Private**            | true            |
| `Appointment__c`   | ReadWrite      | **Private**            | true            |
| `Absence__c`       | ReadWrite      | **Private**            | true            |
| `Learning_Path__c` | ReadWrite      | **Private**            | true            |
| `Module__c`        | ReadWrite      | **Private**            | true            |
| `Program__c`       | ReadWrite      | **Private**            | true            |
| `Coach_Profile__c` | ReadWrite      | **Private**            | true            |
| `AuditEvent__c`    | Private        | **Private**            | true            |

**Folge:** Ein externer User sieht von diesen Objekten **gar nichts**, solange keine Sharing
Regel greift. `enableSharing=true` heißt nur, dass Sharing überhaupt erlaubt ist — es
konfiguriert nichts.

`Account__c` steht auf `sharingModel = ReadWrite` (aus dem retrievelten
`Account.object-meta.xml`).

### Noch offen: die org-weiten Standardfreigaben (OWD)

Die OWD für `Contact` und `Account` ließen sich weder per SOQL noch per Tooling-API
auslesen — `OrgSettings` ist in dieser Umgebung nicht abfragbar (`SELECT ... FROM OrgSettings`
scheitert an `Id`, Apex hat keinen Zugriff darauf). Das muss in **Setup → Sharing →
Organisationsweite Standardfreigaben** gelesen werden und entscheidet, ob überhaupt ein
Account-basierter Weg trägt. Steht als Schritt 6 im Protokoll.

---

## 2. Das echte Gate: Experience Cloud fehlt, nicht die Lizenz

### 2.1 Die Lizenzen sind da

Die Gegenteil-Erwartung war falsch. Im Org sind externe Lizenzen vorhanden und ungenutzt:

```text
Gold Partner                       0/3    Active
Partner Community                  0/5    Active
Partner Community Login            0/5    Active
Customer Community                 0/5    Active
Customer Community Plus            0/5    Active
Customer Community Plus Login      0/5    Active
Customer Portal Manager Standard   0/5    Active
High Volume Customer Portal        0/10   Active
External Identity                  0/7    Active
```

Eine Lizenz muss also **nicht** gekauft werden. Der Scratch-Org bringt sie mit.

### 2.2 Aber die Experience-Cloud-Infrastruktur fehlt

```text
Network              present=false
NetworkMember        present=false
NetworkMemberGroup   present=false
Site                 (Objekt vorhanden, 0 Records)
UserProvisioningRequest  (Objekt vorhanden)
```

Und der entscheidende Deploy-Versuch mit den Network-Metadaten aus dem frontend-Projekt:

```text
FAIL frontend   Communities must be enabled before deploying a Chatter Network Site
```

### 2.3 Auch die Sharing-Regel-Metadaten sind nicht deploybar

Eine Account-basierte Sharing-Regel auf `Participant__c` wurde gebaut und abgelehnt:

```xml
<SharingRules>
  <SharingRule>
    <fullName>ParticipantViaContactAccount</fullName>
    <sharedObject>Participant__c</sharedObject>
    <accessLevel>Read</accessLevel>
    <accountBasedSharing>
      <basedOnField>Contact__c.Contact.AccountId</basedOnField>
    </accountBasedSharing>
  </SharingRule>
</SharingRules>
```

```text
Error parsing file: Element SharingRule invalid at this location in type SharingRules
```

Zwei Erkenntnisse daraus:

- `SharingRules` ist ein **Top-Level-Typ**, kein Kind von `CustomObject`. Der erste Versuch
  unter `objects/Participant__c/` scheiterte mit `TypeInferenceError`. Korrekt ist
  `force-app/main/default/sharingRules/<Object>.sharingRules-meta.xml`.
- Das Schema lehnt **sämtliche** Child-Elemente ab, auch `<SharingRules>` als Child. Der Typ
  lässt sich gegen diesen Org nicht validieren — konsistent damit, dass Communities fehlen.

Die Datei wurde **nicht** ins Repo übernommen, weil sie dort nichts bewirken würde.

### 2.4 Das Scratch-Def-Feature greift nicht

`"features": ["EnableSetPasswordInApi", "Communities"]` wird vom CLI **akzeptiert** (keine
Validierungswarnung) und erzeugt trotzdem einen Org ohne `Network`. Ein zweiter Versuch mit
`PartnerCommunity` / `CustomerPortal` wurde vom CLI abgewiesen:

```text
Warning: Scratch org definition validation issues in orgConfig:
  features.1: Invalid input
  features.2: Invalid input
```

Heißt: `Communities` ist ein gültiger Feature-Name, aktiviert in diesem
Developer-Edition-Scratch-Org aber keine Chatter Network Site. Beide Test-Orgs wurden
wieder gelöscht.

**Konsequenz für Phase 2:** Es braucht entweder eine andere Edition bzw. ein anderes
Org-Setup, oder die Network-Metadaten aus `frontend/` müssen neu geschnitten werden
(Site-Container in Richtung klassische Community). Das ist eine offene Design-Entscheidung,
keine Deploy-Konfiguration.

---

## 3. Bewertung der drei Sharing-Ansätze

### A) Sharing Rule, account-basiert (`Contact__c.Contact.AccountId`)

|                       |                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Vorteile              | Deklarativ, kein Apex, für externe User der empfohlene Weg, erscheint in Sharing-Übersichten                                   |
| Nachteile             | Braucht OWD auf `Contact`/`Account` passend; `Participant__c.externalSharingModel=Private` muss bleiben, die Regel ergänzt sie |
| Lizenz                | **Keine zusätzliche** — die Lizenzen sind vorhanden                                                                            |
| org                   | **Blockiert.** Regel nicht deploybar, solange Communities fehlen                                                               |
| Aufwand nach Freigabe | gering: eine Regel pro Objekt, plus Sharing-Set für `Contact` → `Participant__c`                                               |

Ansatz A bleibt die **Zielvariante**, sobald das Org-Problem gelöst ist.

### B) Sharing Set (`Contact` ↔ `Participant__c`)

|           |                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Vorteile  | Expliziter als eine Rule, gut dokumentierbar, mehr Kontrolle über Master-Detail                          |
| Nachteile | Ein Sharing Set pro Objektpaar; `Contact` ist im Portal der Anker, das Set muss von dort aus greifen     |
| Lizenz    | keine zusätzliche                                                                                        |
| org       | **Nicht verifizierbar**, solange Communities fehlen                                                      |
| Aufwand   | höher als A, weil mehrere Objekte (Participant, Appointment, Absence, Learning_Path) je ein Set brauchen |

### C) Ausschließlich ein serverseitiger `/me`-Endpoint

|           |                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vorteile  | Braucht **kein** Sharing für den eigenen Datensatz; funktioniert auch bei `externalSharingModel=Private`; eng begrenzter Angriffsbereich; der Filter wird serverseitig erzwungen |
| Nachteile | Listenzugriff fehlt vollständig — ein Portal ohne geteilte Listen; jede neue Abfrage braucht Apex; kein Weg für Reports im Portal                                                |
| Lizenz    | **Immer** benötigt, unabhängig von A/B                                                                                                                                           |
| org       | **Sofort umsetzbar** — Apex-Klassen deployen im Gegensatz zu Sharing-Metadaten zuverlässig                                                                                       |
| Aufwand   | gering, dafür dauerhaft mehr Code                                                                                                                                                |

**Bewertung:** C ist der einzige Ansatz, der heute umsetzbar ist. Er deckt jedoch nur den
Falle „ein Nutzer, sein eigener Datensatz" ab — genau das reicht für die geplante erste
Portalversion (`/me` in Phase 4). Die Entscheidung A-vs-C fällt damit nicht „welcher ist
besser", sondern „wann ist der Org bereit".

**Empfehlung:** Phase 4 mit C bauen, ohne C als endgültige Architektur zu verbuchen. Der
`/me`-Endpoint ist die kleinste Einheit, die mit dem Portal startet; A kommt als Ergänzung
dazu, sobald Communities im Org laufen. Wichtig: der Endpoint muss seine Autorisierung
**bewusst** treiben und darf sich nicht auf System Mode verlassen (ADR-010).

---

## 4. Der Portal-Datenfluss, formal festgehalten

Der Identity-Pfad, den der Spike absichern soll:

```text
Experience Cloud User
  → User.ContactId
    → SELECT Id FROM Participant__c WHERE Contact__c = :userContactId
```

Bedingungen, die in Phase 1 bereits erfüllt sind:

| Bedingung                                      | Stand | Beleg                                                   |
| ---------------------------------------------- | ----- | ------------------------------------------------------- |
| `Participant__c.Contact__c` ist `required`     | ✅    | `required=true`, Runtime erzwungen (Kontrollversuch E2) |
| `Contact__c` ist `deleteConstraint = Restrict` | ✅    | Löschen mit Teilnehmer wird blockiert                   |
| Genau ein `Participant__c` pro `Contact`       | ✅    | `ParticipantContactUniqueness`, 13 Apex-Tests grün      |
| Kein `Participant__c` ohne `Contact`           | ✅    | SOQL `WITHOUT_CONTACT = 0`                              |
| `Contact.Email` konsistent mit dem Snapshot    | ✅    | SOQL `EMAIL_DRIFT = 0`                                  |

Damit ist die Lookup-Kette eindeutig: `User.ContactId` liefert **höchstens** ein Ergebnis,
und wenn `Contact__c` `required` ist, gibt es keine Teilnehmer ohne Contact. Der einzige
offene Punkt ist die **Berechtigung** — ob der externe User diesen einen Datensatz sehen
darf. Genau das ist Teil B.

### Zuordnung: schreibende Portal-Aktionen

Alle Schreibpfade im Portal (Termin bestätigen, Abwesenheit beantragen) laufen über Apex
mit demselben serverseitigen Filter:

```apex
Id contactId = [SELECT ContactId FROM User WHERE Id = :UserInfo.getUserId()].ContactId;
Participant__c participant = [SELECT ... FROM Participant__c WHERE Contact__c = :contactId];
```

Kein Schreibpfad nimmt eine `participantId` aus dem Request entgegen.

---

## 5. Was als Nächstes nötig ist

> Diese Liste ist der Sharing-spezifische Teil. Die konsolidierte Liste aller offenen
> Punkte mit Prioritäten steht in [Abschnitt 6](#6-offene-punkte-nach-phase-4); dort
> liegen Priorität 1 bis 4. Diese Tabelle bleibt als die ursprüngliche Spike-Reihenfolge
> unverändert stehen und wird nicht dupliziert.

| #   | Schritt                                                                                                                     | Wer         | Blockiert               |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------- |
| 1   | OWD für `Contact` und `Account` in Setup nachlesen                                                                          | Team        | Bewertung von Ansatz A  |
| 2   | Entscheiden, wie Experience Cloud im Org bereitgestellt wird (Edition / Org-Setup **oder** Network-Metadaten neu schneiden) | Architektur | Teil B, Ansätze A und B |
| 3   | `Contact__c`-Sharing und Portal-User-Login mit zwei Testusern                                                               | Team        | Abschlussnachweis       |
| 4   | Negativtest: User A sieht **nicht** Participant B                                                                           | Team        | Abschlussnachweis       |

Der Abschlussnachweis ist bewusst kurz gehalten: Test-User A sieht Participant A, Test-User
B sieht Participant B, User A sieht Participant B **nicht**. Er ist in
[`spike-sharing-1.5.md`](./spike-sharing-1.5.md), Schritte 7–9, vorbereitet.

---

## 6. Offene Punkte nach Phase 4

Priorität 1 bis 4 sind Portal- und Experience-Themen. Priorität 5 ist ein Aufräumticket und
blockiert nichts.

> **Stand zu Experience Cloud:** [Abschnitt 2](#2-das-echte-gate-experience-cloud-fehlt-nicht-die-lizenz)
> ist eine Momentaufnahme vom 2026-09-29 und hält fest, dass Digital Experiences im Org fehlten.
> Inzwischen wurde Digital Experiences in `organiser-dev` **manuell in Setup aktiviert**;
> `Network`, `NetworkMember` und `NetworkMemberGroup` sind seitdem vorhanden und die externen
> Lizenzen sind zugewiesen. Abschnitt 2 bleibt unverändert als historische Aufzeichnung
> stehen. Was seitdem **nicht** erneut geprüft wurde, ist die Ablehnung der Sharing-Regel
> (Abschnitt 2.3) — sie wurde nach der Aktivierung nicht erneut getestet.

| #   | Punkt                                                                                                                                                                                                                                               | Wer         | Blockiert                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------- |
| 1   | Experience-Cloud-Infrastruktur validieren: `CustomSite frontend` und `Network frontend` referenzieren sich gegenseitig; ein Site muss in Setup → Digital Experiences → All Sites → **Create Site** angelegt werden, sonst deployt keiner der beiden | Architektur | Priorität 3, `/me`-Abnahme          |
| 2   | OWD für `Account`, `Contact` und `Participant__c` in Setup auslesen und hier dokumentieren                                                                                                                                                          | Team        | Bewertung Ansatz A, Sharing-Regel   |
| 3   | Sharing-Spike abschließen: `Contact__c`-Sharing, zwei externe Portal-User, Negativtest User A sieht **nicht** Participant B                                                                                                                         | Team        | Abschlussnachweis Ansatz A und B    |
| 4   | `/me`-Endpoint gegen einen echten Portal-User verifizieren. Die Apex-Tests decken **alle Branches ab `Contact`** ab, nicht den Link `User → Contact` — siehe [ADR-011](./architecture-decisions.md)                                                 | Team        | Produktive Nutzung des Portals      |
| 5   | Test-Runner konsolidieren (siehe unten)                                                                                                                                                                                                             | Team        | **Nichts** — Low Risk, kein Blocker |

### Priorität 5 — Test-Runner konsolidieren (Low Risk / Nicht Blocker)

**Befund**

- `npm run setup` ✅
- `npx vitest run` ✅ (247/247)
- `npm test` ❌

**Präzisierung**

- Das UIBundle verwendet bereits **korrekt** Vitest
  (`force-app/main/default/uiBundles/backend/package.json`, `"test": "vitest"`).
- Der Fehler liegt **ausschließlich auf Root-Ebene**.
- In der Root-`package.json` zeigen `test` und `test:unit` weiterhin auf `sfdx-lwc-jest`.
- Zusätzlich werden über den Root-Testpfad noch die Playwright-`e2e/`-Specs mit
  beeinflusst (`Test suite failed to run: Playwright Test did not expect test.describe()`).
  Wer nur `test:unit` umstellt, muss diesen zweiten Effekt mitbeheben.

**Ursache**

- Unvollständig abgeschlossene Migration von Jest auf Vitest.
- Jest-Reste auf Repository-Ebene: vier Script-Einträge in der Root-`package.json`,
  die Dev-Dependency `@salesforce/sfdx-lwc-jest` und die Datei `jest.config.js`.

**Risiko**

- `npm test` erscheint als fehlgeschlagenes Qualitäts-Gate.
- Der Zustand kann als echter Blocker missverstanden werden — oder, schlimmer, dauerhaft
  ignoriert werden. Beides führt dazu, dass rote Checks irgendwann generell nicht mehr
  ernst genommen werden.

**Temporäre Gegenmaßnahme**

- Bis zur Bereinigung gilt `npx vitest run` im UIBundle `backend` als maßgebliches
  Test-Gate.

**Aufgabe**

- Root-`package.json` bereinigen
- Jest-Reste vollständig identifizieren
- `npm test` auf Vitest umstellen
- Einfluss auf die Playwright-Testpfade prüfen
- Dokumentation aktualisieren

Das rote Gate ist hier bewusst dokumentiert: **rot = bekannt, rot = kein Produktfehler,
rot = noch aufzuräumen. Grün = Vitest.** Wer in zwei Monaten `npm test` laufen lässt und
rot sieht, soll hier fündig werden statt einen halben Tag zu suchen.
