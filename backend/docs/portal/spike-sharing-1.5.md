# Spike-Protokoll: Sharing und Experience-User-Zugriff

**Stand:** 2026-09-29
**Zweck:** Nachweisen, dass ein externer Portal-User **seinen eigenen** `Participant__c` sieht
und **nicht** den eines anderen.

> **Ergebnis Teil A (2026-09-29):** abgeschlossen — siehe
> [`sharing-spike-ergebnis.md`](./sharing-spike-ergebnis.md).
> **Ergebnis Teil B:** blockiert. Die externen Lizenzen sind vorhanden, aber Experience Cloud
> ist in diesem Org nicht aktiviert (`Network` fehlt im Schema, Network-Deploy wird mit
> _„Communities must be enabled"_ abgewiesen). Teil B ist der **Abschlussnachweis** und
> bleibt offen, bis das geklärt ist.
>
> Dieser Teil des Protokolls ist deshalb **nur** der Abschlussnachweis. Er ist
> vorbereitet, aber derzeit nicht ausführbar.

---

## Voraussetzungen für Teil B

- [ ] Experience Cloud im Org aktiviert — **aktuell offen**, siehe Ergebnisdokument
- [ ] Experience-Cloud-Lizenz zugewiesen — **erledigt**, im Org vorhanden und ungenutzt
      (Gold Partner 0/3, Partner Community 0/5, Customer Community Plus 0/5, …)
- [ ] Portal-Profil angelegt und Lizenz zugewiesen — offen
- [ ] `Participant__c.Contact__c` ist `required` — **erledigt** (Kontrollversuch E2)
- [ ] `ParticipantContactUniqueness` ist aktiv — **erledigt**, 13 Apex-Tests grün

## Vorbedingung, die man kennen muss

Alle Portal-Objekte stehen auf `externalSharingModel = Private`. Ein externer User sieht
**nichts**, solange keine Sharing-Regel greift. Der Test unten würde also im negativen Fall
auch dann „bestehen", wenn der User gar nichts sieht — deshalb wird in Schritt 7 zusätzlich
der **positive** Fall geprüft.

---

## Schritt 1 — Test-Account

```bash
sf data create record --target-org <org> --sobject Account \
  --values "Name='SPIKE Portal Test Account'"
```

Erwartet: `Account-Id` → `ACC_ID`

## Schritt 2 — Test-Contact A und B

```bash
sf data create record --target-org <org> --sobject Contact \
  --values "AccountId=ACC_ID FirstName=Spike LastName=Alpha Email=spike.alpha@example.invalid"
sf data create record --target-org <org> --sobject Contact \
  --values "AccountId=ACC_ID FirstName=Spike LastName=Beta Email=spike.beta@example.invalid"
```

Zwei Contacts, **am selben Account**. Der gleiche Account ist der harte Fall: Eine
Account-basierte Sharing Regel (Ansatz A) würde beiden Nutzern dann **beide** Participants
sehen. Deshalb gehören die Test-Contacts auf **verschiedene** Accounts, sonst kann der
Negativtest Ansatz A nicht von einem Fehler unterscheiden.

```bash
# Deshalb: zwei Accounts
sf data create record --target-org <org> --sobject Account \
  --values "Name='SPIKE Portal Test Account B'"
```

Erwartet: `Contact-Id` → `CONTACT_A`, `CONTACT_B`

## Schritt 3 — Participants

```bash
sf data create record --target-org <org> --sobject Participant__c \
  --values "Name='Spike Alpha' Contact__c=CONTACT_A"
sf data create record --target-org <org> --sobject Participant__c \
  --values "Name='Spike Beta' Contact__c=CONTACT_B"
```

## Schritt 4 — OWD prüfen

Setup → Sharing → Organisationsweite Standardfreigaben. Werte für `Contact` und `Account`
notieren.

Die Werte lassen sich weder per SOQL noch per Tooling-API auslesen (`OrgSettings` ist
nicht abfragbar) — dieser Schritt muss über Setup erfolgen.

**Warum das entscheidend ist:** Ist `Contact` org-weit `Private`, braucht ein externer User
zusätzlich zur Sharing-Regel auch Lesezugriff auf den Contact und dessen Account. Ist
`Contact` `ReadWrite`, genügt die Regel auf `Participant__c`.

## Schritt 5 — Portal-User anlegen

**Vorher in Setup nötig:** Digital Experiences → Settings → **„Allow using standard external
profiles for self-registration, user creation, and login" aktivieren.** Ohne diesen Schalter
lehnt Salesforce das Anlegen eines Users mit `ContactId` ab, auch wenn das Profil ein
Portal-Profil ist:

```
FIELD_INTEGRITY_EXCEPTION: To create or update users for this profile, go to
Setup > Digital Experiences > Settings and select Allow using standard external
profiles for self-registration, user creation, and login.
```

Der Schalter ist weder per API noch aus Apex setzbar. Er ist der Grund, warum der
`User → Contact`-Link der Identitätskette nicht in Apex-Tests abgedeckt werden kann
(siehe [ADR-011](./architecture-decisions.md)).

Über den späteren `POST /grant`-Pfad, falls Phase 3 steht. Sonst manuell:

```bash
sf data create record --target-org <org> --sobject User \
  --values "Username=spike.alpha@example.invalid Email=spike.alpha@example.invalid \
LastName=Alpha ContactId=CONTACT_A ProfileId=PORTAL_PROFILE_ID"
```

Ein zweiter User für `spike.beta@example.invalid` / `CONTACT_B`.

- [ ] Setup-Schalter für externe Standardprofile aktiviert
- [ ] Login als Portal-User erfolgreich
- [ ] `User.ContactId` zeigt auf den richtigen Contact
- [ ] `Portal_Status__c` steht auf `Invited`, nicht auf `Active`

## Schritt 6 — Sharing-Mechanismus konfigurieren

Nur einer, je nach Ergebnis des Abschnitts 3 im Ergebnisdokument:

| Kandidat                                    | Konfigurierbar? | Funktioniert? | Aufwand |
| ------------------------------------------- | --------------- | ------------- | ------- |
| A) Sharing Rule, account-basiert            | ☐               | ☐             |         |
| B) Sharing Set `Contact` ↔ `Participant__c` | ☐               | ☐             |         |
| C) ausschließlich `/me`-Endpoint            | ☐               | ☐             |         |

**Fragen, die der Spike beantworten muss:**

- [ ] Welche Beziehungsfelder werden für die konkrete Lizenz angeboten?
- [ ] Ist `Contact__r.AccountId` als Mapping-Quelle wählbar?
- [ ] Funktioniert der Zugriff über UI-API-GraphQL oder nur über Apex?
- [ ] Was passiert ohne jede Konfiguration? (erwartet: nichts sichtbar)

## Schritt 7 — Positivtest

Als Portal-User A einloggen:

- [ ] Eigenen `Participant__c` sichtbar
- [ ] `Contact` lesbar
- [ ] Programm, Coach und Termine lesbar, sofern zugewiesen
- [ ] Nicht zugewiesene Felder verhalten sich wie erwartet (kein Datenleck)

**Dieser Schritt ist Pflicht.** Ohne ihn ist Schritt 8 aussagefrei: Ein User, der nichts
sieht, besteht auch den Negativtest.

## Schritt 8 — Negativtest

- [ ] Fremder `Participant__c` **nicht** sichtbar
- [ ] Fremder `Contact` **nicht** sichtbar
- [ ] Direkter Aufruf der Record-URL mit der fremden Id → kein Zugriff
- [ ] SOQL mit `Contact__c = <fremde ContactId>` → keine Datensätze
- [ ] Apex-Endpunkt, der eine `participantId` aus dem Request übernimmt → **muss** auf den
      eigenen Datensatz auflösen oder ablehnen

> Punkt 8.5 ist der Grund für ADR-010. Schlägt er fehl, ist die Autorisierung kaputt und darf
> nicht durch Phase 4 verdeckt werden.

## Schritt 9 — Aufräumen

- [ ] Portal-User deaktiviert oder gelöscht
- [ ] Test-Contacts und Test-Participants gelöscht
- [ ] Test-Accounts gelöscht
- [ ] Temporäre Sharing-Konfiguration zurückgebaut, sofern nicht übernommen

---

## Ergebnis

**Gewählter Mechanismus:** <!-- A / B / C -->

**Belege:**

**Folge für Phase 2.3:**

**Folge für Phase 4** (`/me`-Endpoint):

- [ ] Spike abgeschlossen
- [ ] Negativtest bestanden
- [ ] Ergebnis in `sharing-spike-ergebnis.md` nachgetragen
- [ ] Aufräumen erledigt

---

## Testergebnis

| Datum | Tester | Ergebnis                                 |
| ----- | ------ | ---------------------------------------- |
| —     | —      | ⏳ offen — blockiert an Experience Cloud |
