# Architecture Decisions — Teilnehmerportal

**Stand:** 2026-10-15
**Status:** ADR-001 bis ADR-012 vom 2026-09-29 bestätigt; ADR-013 bis ADR-015 am
2026-10-14/15 aus einer Messung in der Live-Site entstanden und ebenfalls entschieden
**Umsetzung:** [`portal-access-plan.md`](./portal-access-plan.md)

Fünfzehn Entscheidungen, die den Portal-Aufbau bestimmen. Wer eine ändern will, ändert den
Eintrag hier mit Datum — nicht stillschweigend den Code.

**Manuelle Setup-Schritte, die aus dem Repo nicht deploybar sind** und ohne die ein Deploy
scheitert oder nicht übersetzt:

| Was | Objekte | Nachweis |
| --- | --- | --- |
| Apex Sharing Reason `Portal_Access__c` | `Participant__c`, `Learning_Path__c`, `Appointment__c`, `Coach_Profile__c`, `Program__c` | ADR-013 |
| Validierungsregeln auf `Appointment__c` | drei Regeln, siehe [g1-manual-checklist.md](../g1-manual-checklist.md) | ADR-014 |

Alles Übrige aus [ADR-015](#adr-015--ein-benannter-weg-für-altbestand-der-die-invarianten-verletzt)
— `AppointmentIntegrityService` samt Tests — ist regulär aus dem Repo deploybar.

---

## ADR-001 — Contact ist die Personenakte

**Status:** bestätigt

```text
Contact = Person
Participant__c = Rolle in der Academy
User = Login-Identität
```

`Contact` bleibt die zentrale Personenakte. `Participant__c` enthält ausschließlich
academy-spezifische Daten: Programm, Learning Path, Coach, Termine, Abwesenheiten.
Ein Contact kann existieren, ohne Teilnehmer zu sein — so wie ein Mitarbeiter einen
Contact haben kann, ohne Teilnehmer zu sein.

**Folge:** `Participant__c.Contact__c` wird `required`, 1:1, serverseitig erzwungen.
`Contact.Email` ist die führende E-Mail, `Participant__c.Email__c` wird Snapshot.

**Verworfen:** `Lead → Opportunity → Participant__c` als durchgehende Kette. Eine
Opportunity ist ein Geschäftsvorgang, kein Mensch.

### ADR-001A — Ein Teilnehmer mit Audit-Historie wird nicht hart gelöscht

**Status:** bestätigt (2026-09-29, ursprünglich als Setup-Standard entstanden, bewusst übernommen)

```text
Contact
  └── Participant__c
        └── AuditEvent__c
```

`AuditEvent__c.ParticipantId__c` verwendet `deleteConstraint = Restrict`. Die bevorzugte
Vorgehensweise ist eine Statusänderung — `Dropped`, `Graduated`, `Placed`, `Archived` —
anstelle einer physischen Löschung.

**Begründung:** Ein Audit Event beantwortet _wer, wann, was geändert hat_. `SetNull`
entwertet genau dieses Protokoll dann, wenn es am wichtigsten wäre: beim Löschen der Person.
Ein späteres `ParticipantId__c = null` erzeugt einen Eintrag, der niemandem mehr zugeordnet
werden kann. Da dieses Projekt einen Activity Feed, eine Teilnehmer-Timeline, Reports und
Nachweise baut, ist die Zuordnung Teil des Produkts, nicht Beiwerk.

Damit ist die Kette an allen drei Stellen gleich behandelt: Ein Contact, ein Teilnehmer
und ein Audit Event lassen sich nicht stillschweigend auseinanderlösen.

**Verifiziert (2026-09-29, `organiser-dev`):**

```text
DELETE_PARTICIPANT = blockiert: … could not be completed because it is
                    associated with the following audit events.: AE-000000
EVENT_SURVIVES     = 1
```

**Folge für Werkzeuge:** Ein Aufräumlauf muss die Kette von hinten abbauen —
AuditEvents, dann Learning-Path-Items, dann Participants, dann Contacts, dann Accounts.
`scripts/seed-sample-data.mjs` (`--rebuild`) folgt dieser Reihenfolge.

**Bekannte Lücke:** Der Seed räumt nur Events mit `CorrelationId__c LIKE 'DEV_SEED_%'` ab
plus die Einträge aus seinem Manifest. Audit Events, die aus der App heraus entstehen, fallen
daran vorbei. Im Dev-Org unkritisch, in einem Org mit echten Betriebsdaten wäre ein
Teilnehmer dann nicht mehr löschbar — was genau die gewollte Wirkung ist, aber beim Aufräumen
überraschen kann.

---

## ADR-002 — Participant__c ist die Academy-Rolle

**Status:** bestätigt

Der Portal-Zugriff hängt an `Participant__c`, die Login-Identität hängt an `User`.
`Participant__c` ist das Profil des Teilnehmers innerhalb der Anwendung.

**Folge:** Portal-Daten (`/me`, Termine, Abwesenheiten, Lernpfad) werden immer über
`Participant__c` aufgelöst, nie direkt über den User.

---

## ADR-003 — User ist ausschließlich die Login-Identität

**Status:** bestätigt

`User` trägt keine fachlichen Daten. Es existiert, damit sich jemand anmelden kann.
Apex löst nach dem Login auf:

```apex
User.ContactId → SELECT Participant__c WHERE Contact__c = :contactId
```

**Folge:** `ParticipantPortalData` filtert **nie** nach einer vom Browser übermittelten
`participantId`, sondern löst serverseitig auf. Wer eine fremde ID im Request einsetzt,
ändert nichts an der Auflösung.

---

## ADR-004 — Manuelle Teilnehmeranlage statt pauschalem Closed-Won-Trigger

**Status:** bestätigt

Nicht jede gewonnene Opportunity erzeugt einen Teilnehmer. Testkäufe, falsche
Opportunity-Typen, Firmenkunden ohne Teilnahme und Stornos würden sonst automatisch
Participants erzeugen.

Ablauf:

```text
Lead ─▶ Contact + Opportunity
Opportunity = Closed Won
  ▶ Staff prüft
    ▶ "Teilnehmer erstellen" (manuell, aus der Contact-Seite)
      ▶ Participant__c
        ▶ "Portalzugang aktivieren"
          ▶ Portal User
```

**Folge:** `Initial_Source_Opportunity__c` ist optional und **kein** Trigger. Es
dokumentiert nur die Herkunft des ersten Kurses.

---

## ADR-005 — Experience Cloud Welcome-Einladung statt bekanntem Initialpasswort

**Status:** bestätigt

```text
Contact vorhanden
  ▶ Portal User anlegen
    ▶ Salesforce Welcome-Mail
      ▶ Teilnehmer öffnet den Link
        ▶ Teilnehmer legt das Passwort selbst fest
          ▶ erster Login
```

Salesforce kümmert sich um Passwort-Reset, MFA, Session-Management, Login-Security und
Auditing. Kein eigener Passwort-Stack.

**Verworfen:**

- Admin vergibt Startpasswort — Passwort muss übermittelt werden, Mitarbeiter kennt es,
  Support-Aufwand, „ich habe die Mail gelöscht"
- Eigenes Passwort auf `Participant__c` — man baut Login, Logout, Token, Session-Cookies,
  Reset, Passwort-Richtlinien, MFA, Lockout und Security-Audits selbst
- Zufälliges Passwort + `Site.forgotPassword()` als Hauptweg — erzeugt einen technisch
  künstlichen Zwischenschritt

**Fallback:** Passwort-Reset-Mail nur für „Einladung erneut senden", „Passwort vergessen"
und Supportfälle. Dient als `POST /reset` in Phase 3.

**Offen (Research-Task Phase 2.4):** Welches der konfigurierten Network-Templates löst
tatsächlich eine Set-Passwort-Seite aus? Ergebnis wird als Nachtrag hier festgehalten,
bevor Phase 3 implementiert wird.

---

## ADR-006 — Status zuerst `Invited`, `Active` erst nach abgeschlossenem Portalzugang

**Status:** bestätigt, Auslöser am 2026-09-30 präzisiert (ADR-012) · **Umsetzung: teilweise
(Stand 2026-10-09)** — `Portal_Status__c` ist angelegt, die Zeitpunkte noch nicht. Siehe
„Umsetzungsstand" unten.

```text
None → Invited → Active → Revoked
              ↘ ERROR
```

`Portal_Status__c = Active` direkt nach der User-Erstellung wäre fachlich zu früh: Die
Einladung ist versendet, der Zugang ist nicht abgeschlossen.

Felder, die die Zeitpunkte tragen:

```text
Portal_InvitedAt__c     Einladung versendet
Portal_ActivatedAt__c   Portalzugang abgeschlossen
Portal_RevokedAt__c     gesperrt
Portal_LastError__c     letzter Fehler
```

**Verworfen:** `Portal_GrantedAt__c` — die Bezeichnung ist mehrdeutig. „Einladung
versendet", „User erstellt" und „erstmals angemeldet" sind drei verschiedene Zeitpunkte.

### Umsetzungsstand (2026-10-09)

`Participant__c.Portal_Status__c` existiert: Picklist, restricted, nicht erforderlich,
Werte `None` (Standard), `Invited`, `Active`, `Revoked`, `ERROR`. Wert und Anzeigewert sind
bewusst identisch — dieselbe Vorsicht wie bei `Appointment__c.Location__c`, wo ein
abweichender Anzeigewert den gespeicherten API-Namen verändert und Apex sowie GraphQL zur
Laufzeit bricht.

Der API-Wert heisst `ERROR` und nicht `Error`: API-Namen stehen beim Anlegen in Setup fest
und sind danach unveränderlich.

**Die vier Zeitpunkte fehlen bewusst.** Ohne einen Prozess, der Einladung, Aktivierung und
Sperrung eindeutig auslöst und sie zuverlässig setzt, wären sie leere oder potenziell
irreführende Metadaten. Sie werden mit dem Provisionierungsprozess nachgezogen, nicht vorher.

Der Standardwert hat sich beim Anlegen auf alle 15 bestehenden `Participant__c` ausgewirkt —
bei Picklists wendet Salesforce den Standard rückwirkend an. Damit steht jeder Teilnehmer
korrekt auf `None`; der Zustand „nie bewertet" ist derzeit nicht unterscheidbar von
„bewusst kein Zugang". Das ist bei einem späteren Provisionierungsprozess zu entscheiden.

**Auslöser offen, nicht festgelegt.** `Active` setzt einen abgeschlossenen
Portal-Aktivierungsschritt voraus, nicht einen API-Aufruf. Dieser Schritt wird erst
festgelegt, wenn `Portal_ActivatedAt__c` angelegt ist — das fehlt weiterhin. Feste
Ausschlussregel: **`GET /me` aktiviert nicht**, siehe ADR-011. Wird der Übergang später an
einen serverseitigen Aufruf gebunden, muss dieser eine eigene POST-Route sein und
idempotent laufen, damit ein wiederholter Aufruf keinen Schaden anrichtet.

Die frühere Fassung dieser Entscheidung sah den Auslöser beim ersten erfolgreichen `/me`-Aufruf.
Das ist mit dem Read-only-Endpoint aus ADR-011 nicht mehr vereinbar, siehe ADR-012.

---

## ADR-007 — Eindeutigkeit Contact ↔ Participant serverseitig in Apex

**Status:** bestätigt

```sql
SELECT Contact__c
FROM Participant__c
WHERE Contact__c IN :contactIds
```

Treffer → `DUPLICATE_PARTICIPANT_FOR_CONTACT`.

**Verworfen:** before-save Flow als alleinige Absicherung. Zwei fast zeitgleiche
Transaktionen können beide „noch keiner vorhanden" sehen — das ist eine TOCTOU-Lücke, kein
Feature.

Die UI führt dieselbe Prüfung nur für eine gute Fehlermeldung durch. Die serverseitige
Regel bleibt maßgeblich.

---

## ADR-008 — Sharing-Spike vor der Portalentwicklung

**Status:** bestätigt

Der Zugriffspfad `Participant__c.Contact__r.AccountId` hängt davon ab, welche
Beziehungsfelder für die verwendete externe Lizenz und den Sharing-Mechanismus zur
Auswahl stehen. Das darf nicht erst im vollen E2E-Test auffallen.

Deshalb Phase 1.5 mit **genau einem** Testbenutzer, inklusive explizitem Negativtest
(Zugriff auf einen fremden `Participant__c` muss scheitern).

**Präferenz:** deklarativ (Sharing Set / Sharing Rule) → direktes `Account__c`-Lookup →
kontrolliertes Apex Managed Sharing → ausschließlich `/me`-Endpoint.

Salesforce empfiehlt für externe User das deklarative Modell und nur erforderliche
Apex-Klassen.

Protokoll: [`spike-sharing-1.5.md`](./spike-sharing-1.5.md)

---

## ADR-009 — `Contact.Email` ist die führende E-Mail

**Status:** bestätigt, **umgesetzt in Phase 1.2 (2026-09-29)**

```ts
// src/utils/participantDisplay.ts — die Regel existiert genau einmal
export function participantDisplayEmail(p: Participant) {
  return p.contact?.email?.trim() || p.email;
}
export function participantDisplayName(p: Participant) {
  return p.contact?.name?.trim() || p.name;
}
```

Die Queries holen `Contact__r { Id Name Email }` mit, der Service bildet daraus
`participant.contact`. Sämtliche Anzeigeorte gehen über die beiden Helfer:
`ParticipantStickyHeader`, `ParticipantListCard` (Anzeige **und** Suche),
`ParticipantSummaryCard` sowie die Program-Teilnehmerliste, deren
`ProgramParticipantSummary` den Anzeigenamen bereits im Service auflöst — damit stimmt
jeder Consumer automatisch und die Regel muss nicht pro Komponente neu erfunden werden.

**Was bewusst offen bleibt:**

- `Participant__c.Email__c` wird **nicht** gelöscht und bleibt editierbar, im
  Bearbeiten-Formular aber als „E-Mail (Teilnehmerakte)" mit Herkunftshinweis beschriftet.
- `Participant__c.Name` bleibt der Name des Datensatzes.
- Reports und Automationen sind **nicht** umgestellt.

Der Snapshot ist damit weiterhin eine zweite Quelle, die vom Contact abweichen _kann_.
Genau deswegen ist das Bearbeiten des Feldes als solches gekennzeichnet.

**Abbaufähig, sobald:** alle Datensätze einen Contact haben (in `organiser-dev` per SOQL
verifiziert: `WITHOUT_CONTACT=0`), alle Komponenten umgestellt sind und Reports sowie
Automationen geprüft wurden.

**Begründung:** standardisierte und normalisierte Daten statt Redundanz — Voraussetzung für
belastbares Reporting und Automation.

---

## ADR-010 — Kein generisches System-Mode-Apex ohne explizite Autorisierung

**Status:** bestätigt

Apex läuft im System Mode. Das ist technisch praktisch, aber **kein** Sicherheitsfeature
und wird nicht als solches genutzt.

`ParticipantPortalAccess`:

```text
internal users only
with sharing
explizite Custom-Permission-Prüfung
  → FeatureManagement.checkPermission('Manage_Participant_Portal_Access')
Contact-/Participant-Konsistenzprüfung
keine beliebige User-ID aus dem Request
```

`ParticipantPortalData` löst ausschließlich serverseitig auf:

```text
aktueller User → User.ContactId → Participant__c
```

**Folge:** Ein Request-Parameter `participantId` kann die Auflösung nicht beeinflussen.
Salesforce empfiehlt für externe User, nur unbedingt benötigte Apex-Klassen freizugeben
und möglichst das deklarative Sicherheitsmodell zu verwenden.

**Erledigt am 2026-10-01.** `ParticipantPortalData` läuft jetzt `with sharing` und prüft
zusätzlich `Portal_User__c = UserInfo.getUserId()` (sonst `403
PORTAL_ACCESS_NOT_GRANTED`). System Mode wird weder für die Autorisierung noch für den
Zugriff auf fremde Rows benutzt — die Freigabe liegt in den `Participant__Share`-Zeilen,
die `ParticipantPortalSharingService` verwaltet. Damit ist auch die Empfehlung aus dieser
ADR („deklaratives Sicherheitsmodell") umgesetzt, allerdings über Managed Sharing statt über
eine Rule, weil die Rule-Variante in dieser Org nicht trägt (ADR-012).

---

## Anhang — Opportunity ist keine 1:1-Herkunft

**Status:** festgehalten, nicht umgesetzt

`Initial_Source_Opportunity__c` (Lookup `Opportunity`, `required: false`) dokumentiert nur
die **initiale** Herkunft. Ein Contact kann später mehrere Opportunities haben:

```text
Erster Kurs · Verlängerung · Zweiter Kurs · Coaching · Firmenfinanzierte Teilnahme
```

Dauerhaft ist die Beziehung nicht `Participant__c → genau eine Opportunity`, sondern:

```text
Participant__c
  ▶ Enrollment__c / Participation__c
    ▶ Program__c
      ▶ Initial_Source_Opportunity__c
```

`Enrollment__c` / `Participation__c` ist **nicht** Teil des aktuellen Sprints. Passt zur
internen Prozessarchitektur, die den Weg vom Lead über Beratung und Onboarding bis zur
Kursdurchführung als zusammenhängende Customer Journey beschreibt.

**Befüllung:** Anlage aus der Opportunity → automatisch vorbefüllt. Anlage direkt vom
Contact → leer, oder Staff wählt sie. Die manuelle Teilnehmeranlage bleibt unabhängig von
`Closed Won`, die Herkunft bleibt nachvollziehbar.

---

## ADR-011 — `GET /participant-portal/me`: Antwort-Stil und Testnaht

**Entscheidung.** `ParticipantPortalData` baut die Antwort über die statischen Felder
`responseBody` / `responseStatus` und stellt die Kette `User → User.ContactId → Contact →
Participant__c` in zwei testbare Schritten (`resolveForUser`, `resolveForContact`) bereit.

**Auslöser, der zur Entscheidung führte.** Zwei Eigenschaften dieser Org, beide empirisch
geprüft und nicht aus der Apex-Dokumentation ableitbar:

1. **`RestContext.response.response` existiert hier nicht.** Auch die kanonische Doku-Form
   kompiliert nicht (`Variable does not exist: response`), ebenso wenig `RestContext` als
   Methodenparameter. `RestContext.response.statusCode` und `.addHeader(...)` funktionieren
   dagegen. Deshalb statische Felder für Body und Status, `RestContext` nur für Header.
2. **Statics aus `@TestSetup` sind in den Testmethoden `null`.** Bei Deklaration
   initialisierte Statics überleben. Ein minimaler Testaufbau hat das bestätigt. Das Fixture
   wird deshalb von `ensureData()` lazy gebaut statt per `@TestSetup`.

**Folgen.** `getMe()` ist der einzige echte HTTP-Einstieg und hat keine Parameter; `resolve()`
ruft `resolveForUser(UserInfo.getUserId())`. Die Naht existiert nur für Tests und darf nicht
von `getMe()` verdrahtet werden.

**Nicht abgedeckt — bewusst.** Salesforce erlaubt `User.ContactId` nur bei Portal-Usern, und
das Anlegen solcher User aus Apex verlangt zusätzlich den Setup-Schalter „Allow using standard
external profiles for self-registration, user creation and login". Beides ist aus einem Test
nicht erreichbar. Getestet sind deshalb alle Branches ab `Contact`; der Link `User → Contact`
und ein echter Portal-Login über HTTP bleiben dem Positiv-/Negativtest in
[`spike-sharing-1.5.md`](./spike-sharing-1.5.md) vorbehalten. Ein grüner Testlauf ist **kein**
Nachweis, dass der Endpoint gegen einen echten Portal-User verifiziert wurde.

**Nebenentscheidung — kein Schreibpfad.** `getMe()` liest ausschließlich. Es gibt kein
`Portal_Status__c`-Feld und keinen Aktivierungszweig; der Endpoint behauptet keinen
Portalzustand. Grund ist nicht nur Sauberkeit, sondern Wiederholbarkeit: Ein GET, der beim
ersten Aufruf eine Einladung aktiviert, ist weder idempotent noch aus einem Refetch oder
Health-Check gefahrlos aufrufbar. Die Aktivierung ist Phase 3.2 zugeordnet und wird dort
festgelegt, sobald `Portal_Status__c` und `Portal_ActivatedAt__c` existieren.

**Korrektur zur Historie.** Der Commit, der den Endpoint eingeführt hat, enthält in seiner
Beschreibung den Satz, der Verzicht auf einen Gated-Endpunkt sei „in `portal-access-plan.md`
Phase 5 festgehalten". Das war unbelegt und ist falsch: Phase 5 behandelt Termine,
Abwesenheiten und Lernpfad, nicht das Gating. Die Aussage wurde nicht per Amend entfernt,
sondern im Folge-Commit inhaltlich richtiggestellt — der ursprüngliche Endpoint hat weder
Lade-Regeln noch eine Gating-Entscheidung. Wer die alte Beschreibung liest, findet hier die
Korrektur und den belegten Stand.

---

## ADR-012 — Phase 4.1 als vorläufiger Zugriffspfad vor Phase 1.5

**Status:** bestätigt (Reihenfolgeabweichung); der Zugriffsmechanismus selbst ist **offen**

### Entscheidung

`ParticipantPortalData` und `GET /participant-portal/me` werden als **vorläufiger
Portal-Datenzugriff** genutzt, solange Phase 1.5 nicht abgeschlossen ist. Der Endpoint
autorisiert prozedural ausschließlich über:

```text
aktueller User → User.ContactId → Participant__c WHERE Contact__c = :contactId
```

Ansätze A und B bleiben offen und sind nach vollständiger Experience-Cloud-Konfiguration
erneut zu prüfen.

### Grund

Ansätze A und B waren zum Entscheidungszeitpunkt **nicht verifizierbar**, weil die
erforderliche Experience-Cloud-Infrastruktur im Org nicht bereitstand: `Network` fehlte, und
`SharingRules` wurden vom Schema abgelehnt. Das ist kein Beleg gegen A oder B — der Versuch
wurde nicht wiederholt, nachdem Digital Experiences manuell aktiviert wurde.

Ansatz C war davon unabhängig implementierbar. Er wurde vorgezogen, damit die
Portalentwicklung nicht vollständig auf die Org-Konfiguration warten muss und der
Identity-Pfad technisch abgesichert werden konnte.

### Status von C — ausdrücklich kein Endzustand

C wird nicht als Notlösung und nicht als endgültige Zielarchitektur festgeschrieben. Der
Endpoint liefert einen stabilen DTO- und API-Vertrag für das Frontend, den A oder B später
nicht zwingend ersetzen müssen. Mögliche Zielbilder:

```text
C bleibt + deklaratives Sharing kommt als zusätzliche Schutzschicht dazu
C bleibt + Klasse wechselt nach erfolgreichem Spike auf with sharing
C wird ersetzt, nur wenn der abgeschlossene Spike einen klar besseren Zugriffspfad belegt
```

Kombinationen sind ausdrücklich zulässig; ein Verzicht auf `/me` ist nicht vorgesehen.

### Rückkehrbedingung

Nach Einrichtung der Experience-Cloud-Site, Dokumentation der OWD-Werte und Durchführung der
positiven und negativen Zugriffstests wird Phase 1.5 abgeschlossen. **Dann** wird
entschieden, ob C unverändert bleibt, auf `with sharing` umgestellt wird, von A oder B ergänzt
wird oder ersetzt wird.

Diese Entscheidung nimmt ADR-012 nicht vorweg.

### Erledigt am 2026-10-01

Die Rückkehrbedingung ist eingetreten und die Entscheidung ist gefallen:

- Experience-Cloud-Site steht, beide Portal-User sind angelegt und eingerichtet.
- Die OWD-Werte sind dokumentiert (`sharingModel=ReadWrite`,
  `externalSharingModel=Private`, `enableSharing=true`).
- Positiver und negativer Zugriffstest sind **beide** gelaufen, über echte Portal-Sessions:
  User A sieht nur Participant A, User B nur Participant B, beide auf demselben Account.

**A ist widerlegt, B ist ungeprüft, C wurde um eine Sharing-Ebene ergänzt.**

A ist widerlegt, weil eine Criteria-Based Sharing Rule in dieser Org `$User.UserRecord.Id`
und `$User.Id` zwar speichert und anzeigt, aber nicht ausgewertet — beide Varianten
wurden gemessen und liefern für jeden Portal-User `NO_PARTICIPANT`. Eine statische
User-ID funktioniert, ist aber kein Mechanismus.

Statt B zu prüfen, ist die Autorisierung aus dem Apex-Code in die Datensatzfreigabe
gewandert: `ParticipantPortalData` läuft jetzt `with sharing`, und
`ParticipantPortalSharingService` legt je `Participant__c` mit `Portal_User__c` eine
`Portal_Access__c`-Read-Share auf genau diesen Portal-User an. Isolation ist damit pro
User statt pro Account — der Punkt, an dem Ansatz A gescheitert wäre.

B bleibt offen. Ein Sharing Set wäre prüfbar, bringt aber nichts, was die Share-Zeilen
nicht bereits leisten, und würde eine zweite Autorisierungsquelle eröffnen statt eine
entfernen. Als Entscheidung vorgemerkt, nicht als offene Blockade.

### Folgen

- `with sharing` ist gesetzt, die dokumentierte Rückbaurichtung ist damit eingelöst. Der
  Identity-Filter in `resolveForPortalUser()` bleibt als zweite, unabhängige Schicht.
- Der `/me`-Vertrag besteht unverändert fort.
- Der Portal-User-Verifikationstest ist grün; er war die Bedingung, an der vorher die
  Autorisierung hing.
- Die Gruppenpflege (`Portal_Participants`) ist mit dem Sharing Reason überflüssig
  geworden und wurde entfernt. Offen bleibt nur, **neue** Portal-User anzulegen — eine
  Tätigkeit, kein Mechanismus.

## ADR-013 — `Coach_Profile__c` und `Program__c` beziehungsbasiert freigeben, nicht per `without sharing`

**Status:** entschieden und umgesetzt (2026-10-14), Auslöser war ein gemessener Live-Fehler

### Ausgangslage

Die Terminseite und `/me` konnten verknüpfte Namen grundsätzlich nicht auflösen. Gemessen
gegen die Live-Site mit einer echten Portal-Session:

```text
/me                      coachName: null      programName: null
/me/appointments (4)     coachName: null      (alle vier Termine)
```

Obwohl drei der vier Coaches ein verlinktes `Coach_Profile__c` haben und
`Participant__c.Program__c` gesetzt ist. Beide Objekte sind
`externalSharingModel = Private`, und kein Portal-User hielt einen Share darauf — weder
`ParticipantPortalSharingService` noch ein Trigger gaben sie frei. Das war **kein**
Randfall der neuen Terminseite: `/me` zeigte denselben Defekt, er war nur nie aufgefallen,
weil niemand mit einem echten Portal-Login auf das Feld sah.

### `without sharing` wurde gebaut, gemessen und verworfen

Der naheliegende Fix war eine Aufweitung des Namens-Lookups. Sie ist implementiert,
deployt und gemessen worden:

```text
als Admin,      gleiche Abfrage, gleiche Ids   -> 3 Treffer
als Portal-User, gleiche Abfrage, gleiche Ids   -> 0 Treffer, keine Exception
```

Eine eigene `global without sharing`-Klasse (`ParticipantPortalCoachNames`) lag kurzzeitig
im Org. Sie ist wieder entfernt: eine Klasse, die so tut, als löste sie das Problem, wäre
schlimmer als gar keine.

**Die Lehre daraus steht hier, weil sie wiederholt werden wird:** ein `null` **ohne**
Exception ist in diesem Portal ein Sharing-Symptom und kein Beleg für fehlende
Stammdaten. Genau dieser `null` hat die Entscheidung „Coach nicht verfügbar“ ausgelöst —
sie war ehrlich gemeint und hat trotzdem ein systematisches Berechtigungsproblem
zugedeckt. Erst der Live-Lauf mit echten Zugangsdaten hat es aufgedeckt.

### Entscheidung

Freigabe ausschließlich über die fachliche Beziehung, mit demselben Mechanismus wie bei
`Participant__c`, `Learning_Path__c` und `Appointment__c`:

| Objekt | Freigabe nur, wenn | Zweck |
|---|---|---|
| `Coach_Profile__c` | das Profil zum persönlichen Coach oder zu einem Coach eines eigenen Termins gehört | `coachName` in `/me` und in den Terminen |
| `Program__c` | das Programm aus `Participant__c.Program__c` stammt | `programName` in `/me` |

Beide Pfade laufen über `planForCoachProfiles()` bzw. `planForPrograms()` mit je einem
eigenen Plan-Typ, damit eine Share-Zeile nachvollziehbar der Beziehung zugeordnet bleibt,
die sie begründet hat. Der gemeinsame Eintrag heißt `synchroniseReferences()`.

Nicht getan und bewusst so:

- **Keine globale Freigabe.** Jeder Portal-User sieht nicht jeden Coach und nicht jedes
  Programm, sondern nur die, zu denen eine Beziehung besteht.
- **Kein Zugriff auf `User.Name`.** Der Name läuft weiterhin rückwärts über
  `Coach_Profile__c.User__c`; die Permission-Set-Rechte auf `User` bleiben unangetastet.
- **Keine Sharing-Regel und keine zweite Identitätskette.** Das Programm kommt aus genau
  der Beziehung, aus der `/me` ohnehin liest.

### Widerruf und Neuberechnung

Der Sollzustand wird je Teilnehmer **vollständig neu berechnet**, nicht pro Ereignis
gepatcht. Der Grund ist ein konkretes Fehlverhalten, das ereignisweises Löschen erzeugen
würde: hat ein Teilnehmer zwei Termine mit verschiedenen Coaches und fällt einer weg,
dürfte das Profil des anderen nicht mitgelöscht werden. Der Reconcile betrachtet deshalb
alle Beziehungen und behält, was mindestens eine davon noch begründet.

Ausgelöst wird die Neuberechnung bei: Coach- oder Programmwechsel am Teilnehmer, Coach-
 oder Teilnehmerwechsel am Termin, **Löschen eines Termins**, Widerruf des Portal-Users
sowie Anlegen, Ändern oder Löschen eines `Coach_Profile__c`.

Der Delete-Fall am Termin ist der, der leicht übersehen wird: Salesforce entfernt die
Share-Zeilen des gelöschten Termins von selbst, deshalb kehrte der Trigger ursprünglich
früh zurück — und hätte ein Coach-Profil stehen lassen, das nichts mehr begründet.

Ein Coach ohne Profil bleibt `null`, ohne Fehler. „Coach nicht verfügbar“ bezeichnet damit
endlich das, was es sagen soll: fehlende Stammdaten.

### Voraussetzung, die nicht deploybar ist

`ApexSharingReason` steht nicht im `@salesforce/cli`-Registry. Der Grund `Portal_Access__c`
musste auf `Coach_Profile__c` und `Program__c` in **Salesforce Classic** angelegt werden
(`Setup → Switch to Salesforce Classic → Build → Create → Objects`). Ohne ihn ist
`Schema.Coach_Profile__Share.RowCause.Portal_Access__c` nicht übersetzbar und der Deploy
bricht ab — ein Fehlschlag mit vier `Variable does not exist: Portal_Access__c`-Meldungen,
die wie ein Syntaxproblem aussehen.

### Verifikation

- 41 Sharing-Tests, davon 13 neu: Freigabe, Dedupe über beide Beziehungswege, fremder
  Coach bleibt draußen, Coach ohne Profil, Coach-Wechsel, Programmwechsel, Widerruf,
  Mehrfachberechtigung ohne Doppelshare.
- Live mit echter Session: `/me.coachName` = `Ghaith Saidani`,
  `/me.programName` = `IT Pro Advanced`, Termine mit `Frank Blum`, `Sam Dillenburg`,
  `Sandra Krüger`; nur der Coach ohne Profil bleibt `null`.
- **Gegenprobe im Live-Betrieb:** den Share von `Sandra Krüger` entfernt → ihr Termin
  antwortet `coach=null`; `synchroniseReferencesAll()` stellt ihn wieder her (3 → 4).
  Damit ist belegt, dass der Share die Ursache ist und nicht ein Zufall oder ein
  gecachter Wert.

#### Trigger im echten Betrieb (2026-10-14)

Die Unit-Tests prüfen den Plan, nicht die Trigger. Vier Datenänderungen in der Sandbox,
jede gegen Share-Stand und Live-Endpunkt gemessen:

| Schritt | Änderung | Share-Stand | coachName |
|---|---|---|---|
| S1 | Coach am bestätigten Termin von Frank auf Sam | 4 → **3** | Frank → Sam |
| S2a | zweiter Termin mit Sandra | **3**, Sandra genau 1 | unverändert |
| S2b | diesen zweiten Termin wieder gelöscht | **3**, Sandra weiter **1** | unverändert |
| S2c | letzte Sandra-Beziehung weg, Frank dazu | **3**, Sandra raus, Frank rein | Sandra → Frank |
| S3 | `Coach_Profile__c` für Coach Test angelegt | 3 → **4** | `null` → `Coach Test` |

**S2b ist der eigentliche Nachweis.** Zwei Beziehungen zu Sandra, eine fällt weg, die
Freigabe bleibt bestehen — weil der Sollzustand aus *allen* Beziehungen neu berechnet
wird. Ereignisweises Löschen hätte hier 2 ergeben. Genau das ist die Eigenschaft, die
der Reconcile von einer naiven Triggerlogik unterscheidet, und sie war vorher nur als
Testidee dokumentiert.

S3 zeigt die Gegenrichtung: es wurde **kein Termin angefasst**, nur ein Coach-Profil
angelegt. `CoachProfilePortalSharing` hat daran die Freigabe erteilt und der Termin
zeigt erstmals einen Namen. Dieser Trigger hatte vorher nie ausgelöst.

Bei S1, S2c und S3 wurde vor der Messung **kein** `synchroniseReferencesAll()` aufgerufen.
Hätte man es getan, hätte die Selbstheilung einen fehlenden Share repariert und der
Trigger-Erfolg wäre nicht mehr von ihr zu unterscheiden gewesen.

Zwei Korrekturen an der Planung während der Durchführung:

- Der Ausgangswert für S2 stand in der Planung auf 4, tatsächlich waren es nach S1 noch 3.
  Die Erwartung „4 → 3" war damit falsch; korrekt ist „3 → 3, dafür wechselt die
  Zusammensetzung". Bei S2c bedeutet das sogar Entzug **und** Erteilung in einem Schritt.
- Die Diagnose, ein fehlender Tab sei der Grund für den fehlenden „Records"-Eintrag in
  Object Manager, war **falsch**. Der Tab existierte nach dem Anlegen, „Records" erschien
  trotzdem nicht. In dieser Salesforce-Version führt die Objektseite schlicht keinen
  solchen Eintrag; Datensätze sind über den Tab erreichbar. Der Tab ist trotzdem sinnvoll,
  er macht „Termine" im App Launcher auffindbar.

### Testnähe, die absichtlich eine Schwäche festhält

`planForCoachProfiles()` prüft **nicht** selbst, ob eine Share dem richtigen User gehört —
das erledigt die Query davor (`WHERE UserOrGroupId IN :portalUserIds`). Ein Test dafür
wäre grün, obwohl die Schicht darüber fehlt. Der zugehörige Test ist deshalb ein
Characterisation-Test: er reicht dem Plan eine fremde Share und **erwartet, dass sie
entfernt wird**, damit die Grenze festgenagelt bleibt und eine spätere Änderung auffällt.
Dieselbe Naht besteht beim Appointment-Plan.

## ADR-014 — Genau ein Weg in jeden fachlichen Zustand

**Status:** entschieden und umgesetzt (2026-10-15), Auslöser war ein gemessener Live-Befund

### Ausgangslage

Die Listenansicht „Meine Termine" filtert auf `ConfirmedAt__c` („Bestätigt am"). Gemessen
gegen den Datenbestand, Zeitraum letzte 30 Tage:

| Filter | Treffer |
|---|---|
| `ConfirmedAt__c` | **1** (TERM-0007, *Completed*) |
| `StartTime__c`, gleicher Zeitraum | **3** (TERM-0001 *Confirmed*, TERM-0007, TERM-0008) |

TERM-0001 ist ein regulärer bestätigter Termin und erscheint unter dem Filter **nicht**.
Ein Datumsfilter lässt Datensätze ohne Wert weg, sobald der Zeitraum grenzt — bei „All
Time" sind es noch alle fünf.

### Die erste Erklärung war falsch

Der Befund sah danach aus, als fülle das Feld am falschen Ort: leer bei `Confirmed`,
gesetzt beim `Completed`. **Das ist nicht der Fall.** Die Lifecycle-Mutationen sind
atomar und korrekt:

| Mutation | setzt |
|---|---|
| `ConfirmAppointment` | `Status=Confirmed` **+** `ConfirmedAt__c` |
| `CompleteAppointment` | `Status=Completed` **+** `CompletedAt__c` |
| `CancelAppointment` | `Status=Cancelled` **+** `CancellationReason__c` |

TERM-0007 hat beide Zeitstempel, weil der Termin bestätigt und danach abgeschlossen
wurde. Historische Zeitstempel stehen beim Folgeübergang weiter — das ist gewollt.

### Die eigentliche Ursache

Derselbe fachliche Zustand war über zwei verschieden strenge Wege erreichbar:

1. `CreateAppointment` mit `status: "Confirmed"` — **ohne** jeden Zeitstempel, weil die
   Mutation gar keine Zeitstempel-Felder kennt. Dazu die Oberfläche, die beim Anlegen
   **alle sieben** Status zur freien Auswahl anbot.
2. `ConfirmAppointment` — Status und Zeitstempel zusammen.

Dazu eine dritte Tür, die beim Suchen leicht übersehen wird:
`UpdateAppointmentAttendance` nahm `$status` als **Pflichtparameter** frei entgegen und
setzte keinen Zeitstempel. Der Weg ist aktiv verdrahtet (`handleNoShow`).

### Entscheidung

Ein neu angelegter Termin hat genau einen Initialstatus, `Draft`. Jeder weitere Zustand
wird ausschließlich über die benannte Lifecycle-Aktion erreicht, die ihren Zeitstempel
im selben Aufruf mitsetzt. Umgesetzt als:

- `CreateAppointment`: kein `$status`, `Status__c: "Draft"` fest im Dokument
- `AppointmentFormDialog`: Statusfeld beim Anlegen entfernt
- `UpdateAppointment`: `status`, `confirmedAt`, `completedAt` aus dem allgemeinen Patch
  entfernt — der Patch ändert Termindaten, nicht den Zustand
- `UpdateAppointmentAttendance`: `$status` entfernt, `Status__c: "NoShow"` fest
- `AppointmentStatus`/`APPOINTMENT_STATUSES`: `Documented` entfernt

### Warum `Documented` raus ist

Der Wert hatte **keinen Erzeuger** — nirgends im Repo wurde er gesetzt, außer über die
freie Statusauswahl beim Anlegen —, **kein Datenfeld** und **keinen erklärbaren
Übergang**. `backend/docs/ux-walkthrough.md:218` fragt seit der ersten Ausarbeitung:
*„Was passiert nach ‚Durchgeführt'? Wann folgt `Documented`?"* Er trat gleichwohl in
Filtern und in der Zählung vergangener Termine auf, ohne dass je ein Datensatz entstünde.
Kein einziger Datensatz im Org hatte diesen Status, die Entfernung brauchte keine
Datenmigration.

Wird die Dokumentation der Anwesenheit später gebraucht, gehört sie als Feld **und**
benannte Aktion zurück — nicht als beschrifteter Wert.

### Festgelegte Übergänge

| Status | Erzeuger | Begleitdaten |
|---|---|---|
| `Draft` | Create (Initialstatus) | keine |
| `Finding` | Reschedule | keine |
| `Confirmed` | `ConfirmAppointment` | `ConfirmedAt__c` |
| `Completed` | `CompleteAppointment` | `CompletedAt__c` |
| `Cancelled` | `CancelAppointment` | `CancellationReason__c` |
| `NoShow` | `updateAppointmentAttendance` | keine — der Status hat kein Feld |

Ausdrücklich entschieden:

- **`Completed` verlangt kein `ConfirmedAt__c`.** Die beiden Zeitpunkte sind unabhängige
  historische Ereignisse; TERM-0007 belegt das Muster.
- **`Confirmed → Cancelled` ist erlaubt**, und `ConfirmedAt__c` bleibt stehen.
- **Für `NoShow` gibt es bewusst keine Regel.** Eine Begründung wäre fachlich sinnvoll,
  ist aber ein neues Feld und damit Ausbau, nicht Reparatur.

### Plattformseitige Absicherung: Validierungsregeln, kein Trigger

Die drei Regeln (`Confirmed` braucht `ConfirmedAt__c`, `Completed` braucht
`CompletedAt__c`, `Cancelled` braucht `CancellationReason__c`) stehen in
`backend/docs/g1-manual-checklist.md`, **nicht** im Repo: `CustomValidationRule` fehlt im
Registry des `@salesforce/cli`, und die XML-Dateien im Repo lassen *jeden* Deploy des
Objekts scheitern (`unable to find matching parent xml file for ValidationRule`) — sowohl
über `--source-dir objects/Appointment__c` als auch über ein Manifest mit
`CustomValidationRule`-Membern. Manuell in Classic angelegt, wie die `ApexSharingReason`.

Ein Trigger wäre erst die richtige Wahl, wenn Salesforce den Zeitstempel **selbst** setzen
soll. Das ist hier nicht der Fall — die Mutationen liefern ihn bereits — also wäre er
zusätzliche Logik ohne zusätzliche Absicherung.

#### Nachweis (2026-10-15, Live)

Regeln lassen sich über keine API auslesen; belegt sind sie deshalb nur funktional. Wegwerf-
Termin angelegt, neun DML-Proben, jede einzeln, Ausgangslage danach wiederhergestellt:

| Probe | Erwartung | Ergebnis |
|---|---|---|
| 0 `Notes__c` bei Status Draft | OK | **OK** — Kontrollprobe, sonst wäre eine Abweisung nicht interpretierbar |
| 1 `Confirmed` ohne Zeitstempel | abweisen | **abgewiesen** — `Bestätigter Termin ohne Bestätigungszeitpunkt` |
| 2 `Confirmed` mit Zeitstempel | OK | **OK** |
| 3 zurück auf Draft, Zeitstempel leeren | OK | **OK** |
| 4 `Completed` ohne Zeitstempel | abweisen | **abgewiesen** — `Abgeschlossener Termin ohne Abschlusszeitpunkt` |
| 5 `Completed` mit Zeitstempel | OK | **OK** |
| 6 zurück auf Draft, Zeitstempel leeren | OK | **OK** |
| 7 `Cancelled` ohne Grund | abweisen | **abgewiesen** — `Abgesagter Termin ohne Absagegrund` |
| 8 `Cancelled` mit Grund | OK | **OK** |

Beide Richtungen sind nötig: eine Regel, die auch gültige Speicherungen blockiert, wäre
schlimmer als gar keine, und das zeigt erst der Gegentest.

Probe 9 auf `TERM-0001`: eine Änderung an `Notes__c` wird abgewiesen, das Feld bleibt
`null`. Damit ist der eingefrorene Altbestand belegt und nicht bloß behauptet.

Nach dem Aufräumen: 5 Termine, 4 `Coach_Profile__`-Shares, 1 `Program__`-Share — die
Ausgangslage vor der Messung.

#### Ein Editorfehler, der hier Zeit gekostet hat

Die erste Fassung der Formeln trug das Präfix `$Object.` und wurde mit
`Field $Object.Status__c does not exist. Check spelling.` abgelehnt. Bei einem **Custom
Object** werden die Felder ohne Präfix referenziert; das Präfig gehört in Formeln, die über
einen Lookup auf ein übergeordnetes Objekt gehen. Die korrigierte Fassung steht in der
Checkliste, mit dem Hinweis — sonst schreibt das der nächste nach.

### Was das für bestehende Daten bedeutet

Die Regeln feuern bei jeder Änderung, auch wenn der Status schon gesetzt war. Damit sind
**TERM-0001 und TERM-0002 nicht mehr bearbeitbar** — jede Änderung, auch ein
Coach-Wechsel, scheitert an der Regel. Das war vorher eine Befürchtung und ist jetzt
gemessen: eine Änderung an `TERM-0001.Notes__c` wird abgewiesen, das Feld bleibt `null`
(Probe 9 oben).

Das trifft auch den Testfall, an dem die Trigger aus ADR-013 gemessen wurden — dieser
Termin ist für weitere Probes nicht mehr verwendbar. Für die Messung selbst war es nicht
schlimm, weil der Wegwerf-Termin eigene Statuswechsel durchlaufen hat.

Bewusst in Kauf genommen: beide Datensätze sind ohnehin fachlich ungeklärt, ein
eingefrorener Datensatz blockiert keine produktive Arbeit. **Nicht** rückwirkend
reparieren — ein Bestätigungszeitpunkt ist ein historisches Ereignis, und das
Erstellungsdatum als solchen zu setzen wäre geraten. Diese beiden Sätze gehören zu
„Offene Punkte" unten.

### Tests

- Anlegen sendet keinen Status, und das Dokument setzt `Status__c: "Draft"` — beide Seiten
  werden geprüft, weil eine davon ohne die andere wirkungslos wäre
- Ein mitgeschickter Endstatus kommt nicht durch
- `updateAppointment` reicht `status`/`confirmedAt`/`completedAt` nicht durch und das
  Dokument enthält die Felder nicht
- `updateAppointmentAttendance` setzt `NoShow` fest, ohne Status-Parameter
- Der inverse Audit-Test: `updateAppointment` kann **überhaupt kein** Status-Event mehr
  erzeugen
- `appointmentPicklist.test.ts` hält die Bundle-Liste gegen das Deploy-Metadatum, in beide
  Richtungen — ein einseitiger Eingriff wäre dort aufgefallen

## ADR-015 — Ein benannter Weg für Altbestand, der die Invarianten verletzt

**Status:** Mechanismus entschieden und deployed (2026-10-15). Datenreparatur an
TERM-0001 **steht aus**, bewusst zurückgestellt bis zur Sichtung der Änderungshistorie.

### Der Fehler in der Beschreibung „eingefroren“

Nach dem Anlegen der drei Validierungsregeln galt TERM-0001 und TERM-0002 als
„eingefroren“. Das ist falsch, und die Messung steckt in den eigenen Proben:

| Probe | Ausgangslage | Ergebnis nach dem Speichern | Gegangen? |
|---|---|---|---|
| P2 | `Confirmed` **mit** Zeitstempel | `Confirmed` mit Zeitstempel | ja |
| P8 | `Cancelled` **mit** Grund | `Cancelled` mit Grund | ja |
| P9 | `Confirmed` **ohne** Zeitstempel | nur `Notes__c` geändert → Endzustand weiter verletzt | **nein** |

Die Regel prüft das **Ergebnis** eines Speichervorgangs, nicht dessen Vorgeschichte.
P9 scheitert nicht, weil der Datensatz gesperrt wäre, sondern weil das Ergebnis
weiter verletzt. Präzise heißt es:

> TERM-0001 und TERM-0002 sind änderbar, aber jede Änderung muss den Verstoß im
> selben Speichervorgang beseitigen. Ein isoliertes Ändern eines anderen Feldes ist
> nicht möglich — `Status__c → Draft` dagegen ist eine zulässige Reparatur.

### Warum trotzdem ein Service

Die Reparatur ist technisch ein Update. Der Wert liegt im **benannten,
wiederholbaren und auditierten** Weg — und in `findInconsistent()` für den nächsten
historischen Ausreißer. Ohne das wäre die Bereinigung in drei Wochen wieder ein
Ad-hoc-Skript.

`AppointmentIntegrityService`:

| Methode | Zweck | DML |
|---|---|---|
| `findInconsistent()` | org-weite Suche, **benannte Befunde** | nein |
| `planRepair(ids, reason)` | deterministischer Plan je Datensatz, inkl. Warnungen | nein |
| `repair(ids, reason)` | Ausführung, all-or-none je Datensatz | ja |

### Befund-Vokabular statt „inkonsistent“

| Code | Bedingung | Reparatur |
|---|---|---|
| `CONFIRMED_WITHOUT_CONFIRMED_AT` | `Confirmed` ∧ Zeitstempel leer | `reset_to_draft` |
| `COMPLETED_WITHOUT_COMPLETED_AT` | `Completed` ∧ Zeitstempel leer | `reset_to_draft` |
| `CANCELLED_WITHOUT_REASON` | `Cancelled` ∧ Grund leer | `reset_to_draft` |

`CancellationReason__c` ist ein Long Text Area und **nicht** in WHERE filterbar
(`field 'CancellationReason__c' can not be filtered in a query call`). Cancelled-Sätze
kommen deshalb breit herein und werden in Apex geprüft.

**Nur eine Reparaturart gebaut.** `reset_to_draft` und „Bestätigung aus Belegen
rekonstruieren“ sind verschiedene Vorgänge mit verschiedener Beweislage. Die zweite
Art existiert nicht — und soll auch erst dann entstehen, wenn es einen belastbaren
Zeitpunkt zu rekonstruieren gibt.

### Atomarität — die Stelle, an der Apex überrascht

Ein abgefangener DML-Fehler lässt ein vorher erfolgreiches Update **stehen**. Genau
das ist der Zustand, der nicht entstehen darf: Termin auf `Draft`, kein Audit-Event.
Deshalb je Datensatz ein Savepoint statt `try/catch`:

```apex
Savepoint sp = Database.setSavepoint();
Database.SaveResult updateResult = Database.update(change, false);
if (!updateResult.isSuccess()) { Database.rollback(sp); … }
Database.SaveResult auditResult = Database.insert(audit, false);
if (!auditResult.isSuccess()) { Database.rollback(sp); … }
```

`allOrNone=false` umgeht die Validierungsregeln nicht, es **sammelt** ihre Meldung —
die Fehlermeldung kommt damit programmatisch statt als Ausnahme.

### Wächter

- **Begründung ist Pflicht.** `isBlank` nach `trim` wirft; zusätzlich Mindestlänge
  und Obergrenze von 1 000 (`AuditEvent__c.Reason__c`). Eine zu lange Begründung
  wird **abgelehnt, nicht gekürzt**.
- **Notizanhang, nie Überschreiben.** Format mit Datum, Befund, Ziel und Grund.
  Überschreitet der Anhang 32 768 Zeichen (`Appointment__c.Notes__c`), wird der
  Datensatz aus dem Lauf ausgeschlossen — mit Meldung, ohne Kürzung.
- **Kein impliziter Batch.** `repair(findInconsistent(), …)` existiert nicht.
  TERM-0002 bleibt erkannt und sichtbar, aber unangetastet.
- **TOCTOU.** `repair()` prüft unmittelbar vor dem Update erneut. Zwischen Plan und
  Ausführung wurde zwischenzeitlich korrekt bestätigt, wird **übersprungen**,
  niemals zurückgesetzt.

### Audit-Event

`Action__c` sagt, **was** technisch geschah (`reset_to_draft`), `Reason__c`, **warum**
in diesem Einzelfall. Alle Picklist-Werte existieren bereits — `Source__c =
automation` ist ein erlaubter Wert, es braucht **keinen** manuellen Setup-Schritt.

### Testgrenzen — drei Ebenen, ausdrücklich

1. **Voll testbar:** Begründungswächter, Planstruktur, Notizformatierung als reine
   Funktion, Audit-Payload, No-op-Pfad, Fremd-Id. 19 Tests.
2. **Nur negativ testbar:** `findInconsistent()` an sauberer Fixture beweist *keine*
   Falschpositive — **nicht**, dass echte Verstöße gefunden werden.
3. **Nicht isolierbar:** der End-to-End-Pfad. Die aktive Regel verhindert das Anlegen
   inkonsistenter Sätze — **auch im Testkontext**.

Ebene 3 wird durch den kontrollierten Lauf ersetzt, nicht durch einen Test, der die
Regel umgeht.

### Durchgeführter Lauf (2026-10-15, TERM-0001)

Zehn Schritte, jeder mit Ergebnis — die Reihenfolge ist die aus der Planung.

| # | Schritt | Ergebnis |
|---|---|---|
| 1–4 | Vorherzustand, `findInconsistent()`, `planRepair()`, Gegenprobe | siehe „Erkundung“ unten |
| 5 | Vorherzustand TERM-0001 festgehalten | `Confirmed`, Zeitstempel leer, `Notes__c` leer, `LastModifiedDate == CreatedDate` |
| 6 | **Erster Reparaturversuch** | **FAILED, vollständig zurückgerollt** — siehe Vorfall 1 |
| 7 | Zweiter Versuch nach Korrektur | **REPAIRED** |
| 8 | Audit-Event vollständig geprüft | alle elf Pflichtfelder gesetzt, `Changes__c` mit altem und neuem Wert |
| 9 | Zweiter Aufruf | `SKIPPED_NOT_INCONSISTENT`, Events **1 → 1**, kein zweites Event |
| 10 | TERM-0002 verifiziert | Status, Zeitstempel, `Notes__c`, `LastModifiedDate` und Share **alle unverändert**; `findInconsistent()` meldet nur noch ihn |

Ergebnis TERM-0001: `Status__c = Draft`, `ConfirmedAt__c` leer, `Notes__c` mit dem
Eintrag, ein `appointment.legacy_repaired`-Event mit `Source__c = automation` und
`CorrelationId__c = repair-a0u9X00000RzRbdQAF`.

#### Vorfall 1 — die Atomarität hat sich bezahlt gemacht

Der erste Versuch scheiterte:

```text
FAILED  Audit-Event fehlgeschlagen, Update zurückgerollt:
        INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST:
        Action: bad value for restricted picklist field: reset_to_draft
```

`Action__c` ist eine **restricted** Picklist mit 30 Werten — `reset_to_draft` ist
keiner davon. (Erste Fehldiagnose meinerseits: es sah nach einer Drift zwischen
Repo und Org aus, weil ein abgeschnittenes `grep -A20` nur vier Werte zeigte. Repo
und Org enthalten dieselben 30 Werte.)

Ohne Savepoint wäre jetzt ein Termin auf `Draft` gestanden **ohne** Audit-Event —
genau der Zustand, den die Konstruktion ausschließen soll. Nach dem Fehler waren
`Status__c` weiter `Confirmed`, `Notes__c` leer und `LastModifiedDate` unverändert
01.10.: **der Rollback war vollständig.**

Korrektur: `Action__c = 'updated'`. Die Unterscheidung trägt `EventType__c`, das ein
freies Textfeld ist und `appointment.legacy_repaired` zulässt. Maschinenlesbar bleibt
die Reparatur damit vollständig.

#### Vorfall 2 — ein echter Fehler, den die Verifikation gefunden hat

Der erste erfolgreiche Lauf setzte **nur** `Status__c`. Die berechnete Notiz landete
im `Changes__c` des Audit-Events und **nie am Datensatz** — `Notes__c` blieb leer.

Der Grund ist strukturell: Das Update-Objekt wurde inline in `repair()` gebaut, und
`repair()` ist mit realistischer Fixture **nicht testbar** (Ebene 3 im Testkopf). Ein
Fehler dort hätte ungetestet in die Org gehen können.

Behoben durch `buildUpdate()` — eine reine Funktion ohne DML. Damit war genau das
prüfbar, was vorher nur behauptet werden konnte:

```apex
@Test
static void dasUpdateSchreibtStatusUndNotiz() {
    // Regression auf den Fehler vom 2026-10-15
    Appointment__c change = AppointmentIntegrityService.buildUpdate(row, finding, reason);
    System.assertEquals('Draft', change.Status__c, …);
    System.assertNotEquals(null, change.Notes__c, 'die Notiz wird geschrieben, nicht nur berechnet');
}
```

Die fehlende Notiz an TERM-0001 wurde danach mit `buildNotesEntry()` **aus dem Service
selbst** nachgetragen, nicht von Hand getippt, und mit dem rekonstruierten
Ausgangsstatus, damit der Eintrag korrekt „von Confirmed auf Draft“ lautet.

### Messung (2026-10-15, Live, ohne Datenänderung)

| Schritt | Ergebnis |
|---|---|
| `findInconsistent()` | **genau 2**: TERM-0001 und TERM-0002, beide `CONFIRMED_WITHOUT_CONFIRMED_AT` |
| `planRepair([TERM-0001], …)` | `approved=true`, `executable=true`, Ziel `Draft`, Ereignis `appointment.legacy_repaired` |
| Gegenprobe TERM-0002 | **Warnung greift**: „Portal-Share vorhanden — die Rücksetzung ändert den teilnehmerseitig sichtbaren Status. Ausdrückliche Freigabe nötig.“ |
| Kontrolle nach dem Plan | `LastModifiedDate` beider Datensätze unverändert, **0** `appointment.legacy_repaired`-Events |

Der Wächter gegen die falsche Datenmenge arbeitet damit nachweislich.

### Offen: TERM-0002 bleibt bewusst inkonsistent

Nach dieser Entscheidung ist TERM-0002 unverändert `Confirmed` ohne Zeitstempel und
taucht bei jedem künftigen `findInconsistent()` auf. Das ist Absicht: Der Befund
verschwindet nicht, nur weil er einmal angesehen wurde.

Zu entscheiden, sobald die Änderungshistorie gesichtet ist:

- **A — keine Bestätigung belegbar:** `Draft` wäre die vorsichtigere Aussage, aber
  erst nach ausdrücklicher Freigabe.
- **B — Zeitpunkt belegbar:** `Confirmed` bleibt, `ConfirmedAt__c` bekommt den
  **belegten** Wert, als eigene Reparaturart. Kein Erstellungsdatum als Beweis.
- **C — wahrscheinlich, Zeitpunkt unbekannt:** als dokumentierte Ausnahme stehen
  lassen. **Fall C ist die unangenehme Mitte** — jeder Eingriff erfindet eine
  Aussage.

TERM-0002 ist fachlich plausibel (aktiver Teilnehmer, Portal-Share, Termin am
20.10.2026, eine Stunde Dauer). Eine technische Inkonsistenz rechtfertigt keine
potenziell falsche fachliche Korrektur.

## Umgebungsbefund — `@TestSetup` und statische Variablen

Bei `AppointmentIntegrityServiceTest` waren alle Tests rot, die eine statische Variable
aus `@TestSetup` benutzt haben. Gemessen am 2026-10-15:

| Beobachtung | Ergebnis |
|---|---|
| DML aus `@TestSetup` persistiert | **ja** |
| Statisch gesetzte Variable im Test | **null** |

Unabhängig von Zugriffsstufe und Deklaration. Der Test umging die Datenexistenz über
`MeetingLink__c = MARKER` statt über eine gespeicherte Id.

Die Lehre ist nicht „TestSetup ist kaputt“, sondern: **im Test die Datenexistenz
belegen, nicht eine Variable.** Siehe `backend/docs/AGENTS.md`.
