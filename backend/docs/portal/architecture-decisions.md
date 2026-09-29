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

## ADR-006 — Status zuerst `Invited`, `Active` erst nach Erstzugriff

**Status:** bestätigt

```text
None → Invited → Active → Revoked
              ↘ Error
```

`Portal_Status__c = Active` direkt nach der User-Erstellung wäre fachlich zu früh: Die
Einladung ist versendet, der Zugang ist nicht abgeschlossen.

Felder, die die Zeitpunkte trennen:

```text
Portal_InvitedAt__c     Einladung versendet
Portal_ActivatedAt__c   erster Portalzugriff
Portal_RevokedAt__c     gesperrt
Portal_LastError__c     letzter Fehler
```

**Verworfen:** `Portal_GrantedAt__c` — die Bezeichnung ist mehrdeutig. „Einladung
versendet", „User erstellt" und „erstmals angemeldet" sind drei verschiedene Zeitpunkte.

**MVP:** Aktivierung `Invited → Active` beim ersten erfolgreichen `/me`-Aufruf. Kein
vollständiger Login-Audit, aber deutlich präziser als `Active` nach dem Anlegen.

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

**Status:** bestätigt

```ts
const displayedEmail = participant.contact?.email ?? participant.email ?? null;
```

`Participant__c.Email__c` bleibt als Legacy-/Snapshot-Fallback, ist aber **nicht mehr
manuell editierbar** und erscheint nicht als zweite unabhängige Quelle in der UI.
Beim Anlegen bzw. Synchronisieren aus `Contact.Email` übernehmen.

Langfristig wird das Feld entfernt, sobald alle Datensätze einen Contact haben, alle
Komponenten umgestellt sind und Reports sowie Automationen geprüft wurden.

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
