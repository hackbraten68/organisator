# Spike 1.5 — Sharing und Lizenz für externe Portal-User

**Stand:** 2026-09-29
**Zweck:** Vor der Portalentwicklung klären, **welcher** Mechanismus einem externen
Portal-User Zugriff auf seinen eigenen `Participant__c` gibt.
**Aufwand:** ein Testbenutzer, ein Test-Account, ein Test-Contact, zwei Participants.
**Gate:** Phase 3 startet nicht, bevor dieses Protokoll ausgefüllt ist.

Hintergrund: `Participant__c` hat `externalSharingModel=Private` und `enableSharing=true`.
Externe User sehen ohne zusätzliche Regel **gar nichts**. Der geplante Pfad
`Participant__c.Contact__r.AccountId` ist nicht garantiert als Mapping-Quelle wählbar —
das hängt von der tatsächlich verwendeten externen Lizenz und dem Sharing-Mechanismus ab.

Ergebnis fließt nach [`architecture-decisions.md`](./architecture-decisions.md) (ADR-008)
und [`portal-access-plan.md`](./portal-access-plan.md) (Phase 1.5 / 2.3).

---

## Voraussetzungen

- [ ] Experience-Cloud-Lizenz (Customer/Partner User) im Org vorhanden und zugewiesen
- [ ] Portal-Profil in Setup angelegt und Lizenz zugewiesen (nicht deploybar)
- [ ] Sharing-Regeln aus Phase 1 sind deployed (`Participant__c.Contact__c` required)
- [ ] Ein interner User mit `Manage_Participant_Portal_Access`-Berechtigung

---

## Schritte

### 1. Test-Account

```bash
sf data create record --target-org backendtest \
  --sobject Account \
  --values "Name='SPIKE Portal Test Account'"

sf data query --target-org backendtest \
  --query "SELECT Id, Name FROM Account WHERE Name='SPIKE Portal Test Account'"
```

Ergebnis: `Account-Id` notieren → `ACC_ID`

### 2. Test-Contact

```bash
sf data create record --target-org backendtest \
  --sobject Contact \
  --values "AccountId=ACC_ID FirstName=Spike LastName=Portal Email=spike.portal@example.invalid"

sf data query --target-org backendtest \
  --query "SELECT Id, Email, AccountId FROM Contact WHERE Email='spike.portal@example.invalid'"
```

Ergebnis: `Contact-Id` → `CONTACT_ID`

### 3. Eigener Participant

```bash
sf data create record --target-org backendtest \
  --sobject Participant__c \
  --values "Name='Spike Portal' Contact__c=CONTACT_ID Status__c=Onboarding"
```

### 4. Fremder Participant (für den Negativtest)

Zweiter Contact **ohne** Portal-User, eigener Account:

```bash
sf data create record --target-org backendtest \
  --sobject Account \
  --values "Name='SPIKE Fremder Account'"

sf data create record --target-org backendtest \
  --sobject Contact \
  --values "AccountId=ACC2_ID FirstName=Fremd LastName=Person Email=fremd.portal@example.invalid"

sf data create record --target-org backendtest \
  --sobject Participant__c \
  --values "Name='Spike Fremd' Contact__c=CONTACT2_ID Status__c=Onboarding"
```

### 5. Portal-User anlegen

Über den späteren `POST /grant`-Pfad, falls Phase 3 schon steht — sonst manuell:

```bash
sf data create record --target-org backendtest \
  --sobject User \
  --values "Username=spike.portal@example.invalid Email=spike.portal@example.invalid \
LastName=Portal ContactId=CONTACT_ID ProfileId=PORTAL_PROFILE_ID"
```

Danach den Portalset auf `/frontendvforcesite` öffnen.

- [ ] Login als Portal-User erfolgreich
- [ ] Kontakt ist `spike.portal@example.invalid`, kein interner User

### 6. Sharing-Mechanismus bewerten

Für jeden Kandidaten einzeln prüfen und das Ergebnis notieren.

| # | Kandidat | Konfigurierbar? | Funktioniert? | Aufwand |
|---|----------|-----------------|--------------|---------|
| 6.1 | **Sharing Set** auf `Participant__c` über Contact-Account | ☐ | ☐ | |
| 6.2 | **Sharing Rule** (Account Sharing) über `Contact__r.AccountId` | ☐ | ☐ | |
| 6.3 | **Direktes `Account__c`-Lookup** auf `Participant__c`, aus Contact befüllt | ☐ | ☐ | |
| 6.4 | **Apex Managed Sharing**, kontrolliert | ☐ | ☐ | |
| 6.5 | **Ausschließlich `/me`-Endpoint**, serverseitig aufgelöst | ☐ | ☐ | |

**Fragen, die der Spike beantworten muss:**

- [ ] Welche Beziehungsfelder werden für die konkrete Lizenz tatsächlich angeboten?
- [ ] Ist `Contact__r.AccountId` als Mapping-Quelle wählbar?
- [ ] Funktioniert der Zugriff über UI-API-GraphQL oder nur über Apex?
- [ ] Was passiert ohne jede Konfiguration? (erwartet: nichts sichtbar)

### 7. Positivtest

Als Portal-User einloggen:

- [ ] Eigenen `Participant__c` sichtbar
- [ ] `Contact.Email` lesbar
- [ ] Programm und Coach lesbar, sofern zugewiesen
- [ ] Nicht zugewiesene Felder verhalten sich wie erwartet (kein Datenleck)

### 8. Negativtest — Pflicht

- [ ] Fremder `Participant__c` **nicht** sichtbar
- [ ] Fremder `Contact` **nicht** sichtbar
- [ ] Direkter Aufruf der Record-URL mit der fremden Id → kein Zugriff
- [ ] SOQL mit `Contact__c = <fremde ContactId>` → keine Datensätze
- [ ] Apex-Endpunkt, der eine `participantId` aus dem Request übernimmt → **muss** auf
      den eigenen Datensatz auflösen oder ablehnen

> Punkt 8.5 ist der Grund für ADR-010. Wenn dieser Test fehlschlägt, ist die Autorisierung
> kaputt und darf nicht durch Phase 4 verdeckt werden.

### 9. Aufräumen

- [ ] Portal-User deaktiviert oder gelöscht
- [ ] Test-Contact und Test-Participants gelöscht
- [ ] Test-Account gelöscht
- [ ] Temporäre Sharing-Konfiguration zurückgebaut, sofern nicht übernommen

---

## Ergebnis

**Gewählter Mechanismus:** <!-- Kandidat-Nr. -->

**Begründung:**

**Abweichungen vom Plan:**

**Folge für Phase 2.3:**

**Folge für Phase 4** (`/me`-Endpoint):

- [ ] Spikes abgeschlossen
- [ ] Negativtest bestanden
- [ ] Ergebnis in ADR-008 nachgetragen
- [ ] Aufräumen erledigt

---

## Testergebnis

| Datum | Tester | Ergebnis |
|-------|--------|----------|
| — | — | ⏳ |
