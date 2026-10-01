# Architecture Decisions — Teilnehmerportal

**Stand:** 2026-09-29
**Status:** Alle Entscheidungen vom 2026-09-29 bestätigt
**Umsetzung:** [`portal-access-plan.md`](./portal-access-plan.md)

Zehn Entscheidungen, die den Portal-Aufbau bestimmen. Wer eine ändern will, ändert den
Eintrag hier mit Datum — nicht stillschweigend den Code.

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

**Status:** bestätigt, Auslöser am 2026-09-30 präzisiert (ADR-012)

```text
None → Invited → Active → Revoked
              ↘ Error
```

`Portal_Status__c = Active` direkt nach der User-Erstellung wäre fachlich zu früh: Die
Einladung ist versendet, der Zugang ist nicht abgeschlossen.

Felder, die die Zeitpunkte trennen:

```text
Portal_InvitedAt__c     Einladung versendet
Portal_ActivatedAt__c   Portalzugang abgeschlossen
Portal_RevokedAt__c     gesperrt
Portal_LastError__c     letzter Fehler
```

**Verworfen:** `Portal_GrantedAt__c` — die Bezeichnung ist mehrdeutig. „Einladung
versendet", „User erstellt" und „erstmals angemeldet" sind drei verschiedene Zeitpunkte.

**Auslöser offen, nicht festgelegt.** `Active` setzt einen abgeschlossenen
Portal-Aktivierungsschritt voraus, nicht einen API-Aufruf. Dieser Schritt wird erst
festgelegt, wenn `Portal_Status__c` und `Portal_ActivatedAt__c` angelegt sind — beide fehlen
bisher in Repo und Org. Feste Ausschlussregel: **`GET /me` aktiviert nicht**, siehe ADR-011.
Wird der Übergang später an einen serverseitigen Aufruf gebunden, muss dieser eine eigene
POST-Route sein und idempotent laufen, damit ein wiederholter Aufruf keinen Schaden
anrichtet.

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
