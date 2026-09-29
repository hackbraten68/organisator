# Portal Access Plan (Participant Portal)

**Stand:** 2026-09-30
**Status:** Phasen 1 bis 3 sind noch nicht vollständig abgeschlossen. Phase 4.1 wurde als
**vorläufiger Zugriffspfad vorgezogen**, weil die deklarativen Sharing-Ansätze der Phase 1.5
ohne aktivierte Experience-Cloud-Infrastruktur nicht verifizierbar waren. **Phase 1.5 bleibt
als Architektur- und Berechtigungsentscheidung offen.** Siehe
[ADR-012](./architecture-decisions.md).
**Gilt für:** `frontend/` (Experience Cloud Portal) + `backend/` (Metadaten, Portal-Apex, Aktivierungs-UI)

Dieser Plan setzt die Entscheidungen aus [`architecture-decisions.md`](./architecture-decisions.md) um.
Er ist die verbindliche Reihenfolge. Abweichungen brauchen eine neue Entscheidung, keine stille
Abweichung im Code.

---

## 1. Ausgangslage

| Bereich                          | Ist-Zustand                                                                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/`                       | Salesforce-Metadaten (Academy-Objekte, Audit, 1 Trigger) + interne Backoffice-SPA. **Keine** `@RestResource`-Klassen. Identity = ambivalente Salesforce-Session, keine eigene Anmeldung.                                                      |
| `frontend/`                      | SFDX-Projekt, Experience Cloud Site + React UI Bundle. Praktisch leer: Stock-Auth aus dem Salesforce-Template (`UIBundleLogin/Registration/ForgotPassword/ChangePassword`) + eine Accounte-Suche. **Kein** Participant-/Program-/Termin-Code. |
| Lead → Opportunity → Participant | Existiert nicht. Nur in `AGENTS.md` als Zielbild dokumentiert.                                                                                                                                                                                |

Beide SFDX-Projekte deployen in **denselben Org** (aktuell `organiser-dev`, siehe
`../AGENTS.md` → scratch org alias).
Die Ownership-Aufteilung steht in `../AGENTS.md` → „Projektstruktur & Naming".

---

## 2. Zielbild

Drei getrennte Schichten, verbunden über den Contact, nicht ineinander überführt:

```text
Sales      Lead ──convert──▶ Contact + Opportunity        (Vertrieb; für das Portal irrelevant)
Academy    Contact ──1:1──▶ Participant__c                (Rolle in der Academy)
Identity   Contact ──1:1──▶ User (Experience Cloud)       (ausschließlich Login)
```

Login-Pfad im Portal:

```text
UserInfo.getUserId() ─▶ User.ContactId ─▶ Participant__c WHERE Contact__c = :contactId
```

`Opportunity` ist **kein** Mensch. Aus ihr entsteht kein Participant — ein Staff-Mitglied
legt den Teilnehmer an, nachdem der Vorgang fachlich geprüft ist.

### Begriffe, die in diesem Plan eine feste Bedeutung haben

| Begriff            | Bedeutung                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **backend**        | `backend/` — Salesforce-Metadaten (Datenmodell, Apex, Trigger) + interne Backoffice-React-SPA |
| **frontend**       | `frontend/` — Experience Cloud Site + Teilnehmer-React-SPA (das Portal)                       |
| **Contact**        | Die reale Person. Stammdatenquelle für Name und E-Mail.                                       |
| **Participant__c** | Die Rolle dieser Person in der Academy: Programm, Coach, Lernpfad, Termine, Abwesenheiten     |
| **Portal User**    | Login-Identität. Experience-Cloud-Kunden-/Partner-User mit `ContactId`                        |

---

## 3. Phasen

### Phase 0 — Security, Template-Bereinigung, Ownership ✅

Ziel: keine offene Selbstregistrierung, kein fremder Scope im Portal, Ownership schriftlich.
**Erledigt am 2026-09-29.**

| #   | Aufgabe                                                       | Dateien                                                                                                                | Status |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| 0.1 | Naming-Konvention + Ownership-Matrix dokumentieren            | `backend/docs/AGENTS.md`                                                                                               | ✅     |
| 0.2 | `/register` aus den Routen entfernen, `Register.tsx` löschen  | `frontend/.../src/routes.tsx`, `.../pages/Register.tsx`                                                                | ✅     |
| 0.3 | `UIBundleRegistration` samt `-meta.xml` und Test löschen      | `frontend/.../classes/UIBundleRegistration.*`                                                                          | ✅     |
| 0.4 | `UIBundleRegistration`-Zugriff aus dem Gast-Permset entfernen | `frontend/.../permissionsets/frontend_Guest_User_Api_Access.permissionset-meta.xml`                                    | ✅     |
| 0.5 | Portal-fremde Template-Reste entfernen                        | `TestChatPage`, `AccountObjectDetailPage`, `CustomerWebClientChat`, `features/search/` (54 Dateien) + verwaiste Helfer | ✅     |

Bei 0.5 mitentfernt, weil sie ohne ihren einzigen Aufrufer nicht mehr erreichbar waren:
`src/types/chat.ts`, `src/api/account/`, `src/utils/accountFields.ts`,
`src/hooks/useAsyncData.ts`.

Drei Stellen hingen an den gelöschten Routen und sind mitgezogen:

- `appLayout.tsx` mountete `CustomerWebClientChat` auf **jeder** Seite — entfernt
- `Home.tsx` rendert `GlobalSearchBox` — durch einen Platzhalter ersetzt
- `AuthMenu.tsx` und `Login.tsx` verlinkten auf `/register` — beide Verweise entfernt,
  sonst hätte es zwei lebende Links auf eine 404 gegeben

Aus `authenticationConfig.ts` sind zusätzlich vier Platzhalter verschwunden, die nur
`Register.tsx` benutzte (`PASSWORD_CREATE`, `PASSWORD_CONFIRM`, `FIRST_NAME`, `LAST_NAME`).

**Kein `package.json`-Eintrag wurde dadurch ungenutzt.**

**Akzeptanz:** ✅ Kein registrierbarer Zugang im Portal. `/register` liefert 404. Keine Route
zeigt Accounte, Opportunities oder Chatter. Abgesichert durch vier neue Playwright-Tests
(`/register`, `/search`, `/test-chat`, `/accounts/001` sind nicht erreichbar; die Login-Seite
hat keinen Registrierungslink). `npm run build`, `npm run lint` und die E2E-Suite laufen grün.

> **Nebenbefund:** Die beiden bisherigen E2E-Tests waren schon rot, bevor hier etwas geändert
> wurde — sie prüften einen Text (`Welcome to your React application.`), den es im Bundle
> nie gab, und liefen ohne `npm run build:e2e`, also ohne SPA-Fallback, wodurch `serve`
> statt der App seine eigene 404-Seite auslieferte. Beides ist mitgefixt.

---

### Phase 1 — Contact-basierte Teilnehmeranlage

Ziel: `Contact` ist die Personenakte, `Participant__c` die Academy-Rolle, Eindeutigkeit
serverseitig erzwungen.

**1.1 `Participant__c.Contact__c` scharf machen**

Das Feld existiert bereits, wird aber weder gelesen noch geschrieben.

- `required = true`
- 1 Contact → maximal 1 `Participant__c`, serverseitig über die Trigger-/Service-Schicht:

```sql
SELECT Contact__c
FROM Participant__c
WHERE Contact__c IN :contactIds
```

Bei Treffer: `DUPLICATE_PARTICIPANT_FOR_CONTACT`. Kein before-save Flow — zwei fast
zeitgleiche Transaktionen können beide „noch keiner vorhanden" sehen. Die UI-Prüfung ist
nur Ladehinweis für eine gute Fehlermeldung, die maßgebliche Absicherung ist serverseitig.

**1.2 Neue Felder auf `Participant__c`**

| Feld                            | Typ                                                                    | Zweck                            |
| ------------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| `Portal_Status__c`              | Picklist `None` (default) / `Invited` / `Active` / `Revoked` / `Error` | Portalzugang-Status              |
| `Portal_InvitedAt__c`           | DateTime                                                               | Einladung versendet              |
| `Portal_ActivatedAt__c`         | DateTime                                                               | Portalaktivierung abgeschlossen  |
| `Portal_RevokedAt__c`           | DateTime                                                               | Zugang gesperrt                  |
| `Portal_LastError__c`           | Text(255)                                                              | letzter Fehler der Portal-Aktion |
| `Initial_Source_Opportunity__c` | Lookup `Opportunity`, **required: false**                              | optionale initiale Herkunft      |

Kein `Portal_GrantedAt__c` — „Einladung versendet", „User erstellt" und „erstmals
angemeldet" sind drei verschiedene Zeitpunkte und werden nicht vermischt.

`Initial_Source_Opportunity__c` ist **keine** dauerhafte Bindung eines Participants an
einen Deal. Ein Contact kann mehrere Opportunities haben (Erster Kurs, Verlängerung,
zweiter Kurs, Coaching, firmenfinanzierte Teilnahme). Langfristiges Zielbild:

```text
Participant__c ─▶ Enrollment__c / Participation__c ─▶ Program__c ─▶ Initial_Source_Opportunity__c
```

Das wird **jetzt nicht** umgesetzt, nur als Entscheidung festgehalten.

**1.3 E-Mail-Hierarchie**

`Contact.Email` ist führend. `Participant__c.Email__c` bleibt als Legacy-/Snapshot-Feld,
ist aber **nicht mehr manuell editierbar**.

```ts
const displayedEmail = participant.contact?.email ?? participant.email ?? null;
```

Beim Anlegen bzw. Synchronisieren aus `Contact.Email` übernehmen. Abbau-Kriterien für das
Feld (spätere eigene Phase):

- [ ] alle bestehenden Datensätze haben einen Contact
- [ ] alle Komponenten lesen `Contact.Email`
- [ ] Reports und Automationen geprüft
- [ ] keine Integration verwendet das Feld mehr

**1.4 Backend: Teilnehmer aus Contact anlegen**

`createParticipant` (`backend/.../src/api/participant/participantService.ts:286`) akzeptiert
heute freie Felder → umstellen auf `contactId` als Pflichtparameter, Name/E-Mail aus dem
Contact.

Neue `contactService.ts` + Contacts-Bereich im backend:

```text
/contacts              Liste mit Suche
/contacts/:contactId   Detail mit Aktionsbereich
```

Der Aktionsbereich folgt dem Zustand:

| Zustand                    | Aktion                          |
| -------------------------- | ------------------------------- |
| Kein `Participant__c`      | „Als Teilnehmer anlegen"        |
| `Participant__c` vorhanden | „Teilnehmer öffnen"             |
| Portal User vorhanden      | aktuellen Portalstatus anzeigen |

**1.5 Bestehende Daten migrieren**

`Participant__c`-Datensätze ohne `Contact__c` brauchen einen Contact, bevor `required = true`
gesetzt werden kann. Reihenfolge: erst migrieren (manuell/Script über `scripts/`), dann
`required` setzen. Der Field-Constraint darf die Migration nicht blockieren.

**Akzeptanz:** Ein Contact kann nie zwei Participants haben. Der Kontakt-Versuch wird
serverseitig abgewiesen. Anzeige aller E-Mail-Adressen kommt aus dem Contact.

---

### Phase 1.5 — Sharing- und Lizenz-Spike

> **Status: offen.** Teil A ist protokolliert, der Mechanismus ist **nicht** entschieden.
> Kandidat 4 ist als vorläufiger Zugriffspfad umgesetzt ([ADR-012](./architecture-decisions.md)),
> die Ansätze A und B sind nach Aktivierung von Digital Experiences **nicht** erneut getestet
> worden. „Nicht verifizierbar" ist damit nicht „gescheitert". Die Entscheidung zwischen A, B
> und C sowie möglichen Kombinationen steht aus.

Steht **vor** der Portalentwicklung, weil der Zugriffspfad über
`Participant__c.Contact__r.AccountId` nicht garantiert verfügbar ist. Die Auswahl hängt
von der tatsächlichen externen Lizenz und dem Sharing-Mechanismus ab.

Protokoll: [`spike-sharing-1.5.md`](./spike-sharing-1.5.md).

Ergebnis muss vor Phase 3 vorliegen: **welcher** Mechanismus den Zugriff abbildet.

Kandidaten, in dieser Präferenz:

1. **Deklarativ** — Sharing Set / Sharing Rule auf `Participant__c` über den Contact-Account.
   Salesforce empfiehlt für externe User das deklarative Modell und nur erforderliche Apex-Klassen.
2. **Direktes `Account__c`-Lookup** auf `Participant__c`, automatisch aus dem Contact gesetzt,
   falls der Beziehungspfad nicht wählbar ist.
3. **Kontrolliertes Apex Managed Sharing**.
4. **Ausschließlich `/me`-Endpoint** — Zugriff nur über den serverseitig aufgelösten
   eigenen Datensatz. MVP-tauglich, aber der Endpoint muss Objekt-, Feld- und
   Datensatzberechtigungen bewusst behandeln. „Apex läuft im System Mode" darf nicht die
   eigentliche Autorisierung ersetzen. → **vorläufig umgesetzt, siehe ADR-012**

**Akzeptanz:** Spike abgeschlossen, Negativtest dokumentiert (fremder `Participant__c`
muss unerreichbar sein), Mechanismus entschieden. **Noch nicht erfüllt.**

---

### Phase 2 — Experience Cloud: Mitgliedschaft, Profil, Welcome-Mail

Ziel: der Portal-User existiert als technische Voraussetzung, kann sich aber noch niemand
anmelden, weil die Aktivierung in Phase 3 sitzt.

**2.1 Blocker, die nicht im Code liegen**

- Experience-Cloud-Lizenzen (Customer/Partner User) müssen beschafft und zugewiesen sein.
- Das Portal-Profil muss in Setup angelegt und die Lizenz zugewiesen werden — beides ist
  **nicht deploybar**.
- E-Mail-Versand für Site und Einladungs-Mails: Absenderadresse, Single Sender oder Email
  Relay. `frontend/.../networks/frontend.network-meta.xml` zeigt aktuell auf
  `admin@company.com`.

**2.2 Permission Set `Participant_Portal_Access`** (deploybar)

- `objectPermissions` read: `Participant__c`, `Program__c`, `Learning_Path__c`, `Module__c`,
  `Appointment__c`, `Absence__c`
- `fieldPermissions` read passend zu den Portal-Tabs
- `classAccesses`: **nur** die Portal-Lese-Klassen aus Phase 4/5 — keine Schreiboperationen
  im MVP

**2.3 Sharing** gemäß Spike-Ergebnis aus Phase 1.5. Ausgangslage: `Participant__c` hat
`externalSharingModel=Private` und `enableSharing=true` — externe User sehen ohne
zusätzliche Regel **gar nichts**.

**2.4 Network-Templates klären — Research-Task vor Phase 3**

Aktuell konfiguriert:

```xml
<changePasswordTemplate>unfiled$public/CommunityChangePasswordEmailTemplate</changePasswordTemplate>
<forgotPasswordTemplate>unfiled$public/CommunityForgotPasswordEmailTemplate</forgotPasswordTemplate>
<headlessForgotPasswordTemplate>unfiled$public/CommunityHeadlessForgotPasswordTemplate</headlessForgotPasswordTemplate>
<welcomeTemplate>unfiled$public/CommunityWelcomeEmailTemplate</welcomeTemplate>
```

Zu klären und als Ergebnis festzuhalten:

1. Löst das konfigurierte Welcome-Template tatsächlich eine **Set-Passwort-Seite** aus?
2. Welche Kombination aus `enableInvitation` und Network-Member-Gruppen ist nötig, damit die
   Welcome-Mail mit gültigem Link versendet wird?
3. Zeigen die Links auf unsere Site (`/frontendvforcesite`), nicht auf einen Default?

Ergebnis wird in `architecture-decisions.md` als Nachtrag festgehalten, **bevor** Phase 3
implementiert wird.

**2.5 Eigene Templates** statt `unfiled$public/*`, sobald 2.4 geklärt ist.

**Akzeptanz:** Ein Portal-User kann sich technisch anmelden und sieht **leere** Seiten
(wegen `Invited`, siehe Phase 3). Profil, Permset, Templates und Sharing stehen.

---

### Phase 3 — Portalzugang aktivieren, sperren, Einladung erneut senden

Ziel: der Knopf im Backend, mit klar getrennten Zuständen.

**3.1 Neue Apex-Klassen im `backend`-Projekt**

Das backend hat heute keine `@RestResource`-Klassen — das ist neu.

`backend/force-app/main/default/classes/ParticipantPortalAccess.cls`

| Route          | Wirkung                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `POST /grant`  | Portal User anlegen → `Portal_Status__c = Invited`, `Portal_InvitedAt__c = now`, Welcome-Mail                      |
| `POST /revoke` | User deaktivieren → `Portal_Status__c = Revoked`, `Portal_RevokedAt__c = now`                                      |
| `POST /reset`  | Passwort-Reset-Mail neu senden — **nur** Fallback für „Einladung erneut senden", „Passwort vergessen", Supportfall |

**Sicherheitsregeln für diese Klasse (bindend):**

- `with sharing` — kein generisches System-Mode-Gateway
- **interne User only** — externe User werden abgewiesen
- Custom Permission `Manage_Participant_Portal_Access` erforderlich:

```apex
if (!FeatureManagement.checkPermission('Manage_Participant_Portal_Access')) {
    throw new PortalAccessException(403, 'FORBIDDEN');
}
```

- Contact-/Participant-Konsistenzprüfung vor jeder Mutation
- **keine beliebige User-ID aus dem Request akzeptieren** — der aufrufende interne User
  übergibt `contactId` bzw. `participantId`, der Portal User wird serverseitig aufgelöst
- Profilname aus **Custom Metadata Type** (`Portal_User_Settings__mdc`), nicht hardcoded
- `ParticipantPortalAccessTest.cls` mit Testdaten

System-Mode-Verhalten des Apex wird **nicht** als Sicherheitsfeature genutzt. Der Autorisierungs-
Pfad ist `FeatureManagement` + `with sharing` + serverseitige Auflösung.

**3.2 Statusübergänge**

```text
Portalzugang aktivieren
  ▶ User erfolgreich erstellt
    ▶ Portal_Status__c = Invited
      ▶ Salesforce Welcome-Mail
        ▶ Teilnehmer setzt Passwort und schließt das Portal-Onboarding ab
          ▶ Portal_Status__c = Active, Portal_ActivatedAt__c = now

Fehler beim Anlegen
  ▶ Portal_Status__c = Error, Portal_LastError__c = <Meldung>
```

`Active` wird **nicht** nach der User-Erstellung gesetzt. Der Übergang hängt an einem
abgeschlossenen Portal-Onboarding-Schritt, nicht an einem API-Aufruf.

**Der Auslöser ist bewusst noch nicht festgelegt.** Er wird erst verbindlich, wenn
`Portal_Status__c` und `Portal_ActivatedAt__c` angelegt sind — beide fehlen bisher in Repo
und Org. Fest steht nur das Ausschlusskriterium: **`GET /me` aktiviert nicht.** Ein
Lesezugriff verändert keinen Zustand; die Gründe stehen in Phase 4.1. Wird der Übergang
später an einen serverseitigen Aufruf gebunden, muss dieser eine eigene POST-Route sein und
idempotent laufen, damit ein wiederholter Aufruf keinen Schaden anrichtet.

**3.3 Backend-UI**

Neue `ParticipantPortalCard.tsx`, eingehängt in den Tab „Übersicht" des
`ParticipantPage.tsx` (Tab-Liste `:333-338`):

- Zustand aus `Participant__c.Portal_Status__c` + Existenzprüfung Portal User
- Knopf **„Portalzugang aktivieren"** → Bestätigungsdialog (Programm, Coach, Startdatum)
- Knöpfe „Zugang sperren" / „Einladung erneut senden"
- schreibgeschützt, wenn keine `Manage_Participant_Portal_Access`-Berechtigung

Neue Dateien:

```text
backend/.../src/api/portal/portalService.ts   (fetch gegen /services/apexrest/...)
backend/.../src/components/participants/ParticipantPortalCard.tsx
```

Felder in `backend/.../src/types/participant.ts` und den `.graphql`-Queries ergänzen.

**3.4 Audit-Events**

```text
participant.portal_access.granted
participant.portal_access.revoked
participant.portal_access.reset_requested
participant.portal_access.failed
```

Domain `authentication` (Anbindung an den Contact) — Matrix in
`../activity-coverage.md` fortschreiben.

**Akzeptanz:** Staff aktiviert den Zugang, Zustand ist `Invited`, Welcome-Mail ist raus.
Weder ein Passwort noch ein Startpasswort ist im System bekannt. `Active` entsteht erst mit
dem Abschluss des Portal-Onboardings, nicht durch einen Leseaufruf.

---

### Phase 4 — `/me`-Endpoint und eine einzige Portalseite

Ziel: **vertikaler Schnitt**. Ein Testbenutzer validiert damit gleichzeitig
User → Contact → Participant → Sharing → Apex → React, bevor der Portalumfang wächst.

> **Reihenfolgeabweichung.** Diese Teilphase wurde **vor Abschluss von Phase 1.5** umgesetzt.
> Grund und Rückkehrbedingung sind in [ADR-012](./architecture-decisions.md) dokumentiert.
> Phase 1.5 ist damit **nicht** erledigt: Kandidat 4 des Spike ist implementiert, die
> Mechanismen-Entscheidung A/B/C steht aus.

**4.1 `ParticipantPortalData.cls`** im `frontend`-Projekt

```apex
@RestResource(urlMapping='/participant-portal')
global without sharing class ParticipantPortalData {
  @HttpGet
  global static void getMe() {
    /* ... */
  }
}
```

Der öffentliche Pfad ist damit `GET /services/apexrest/participant-portal/me`. Das Mapping
liegt bewusst auf dem Präfix und nicht auf `/me`: der Endpoint ist damit erweiterbar, ohne
das Routing umzubauen, und `@HttpGet` ist die einzige zugelassene Methode. Die Verifikation
läuft über `responseBody` / `responseStatus` statt `RestContext.response.response` — diese
Property existiert in dieser Org nicht (ADR-011).

Serverseitige Auflösung, **kein** Filter nach einer vom Browser übermittelten ID:

```text
UserInfo.getUserId()
  ▶ User.ContactId
    ▶ Participant__c WHERE Contact__c = :contactId
```

Damit kann niemand durch Einsetzen einer fremden `participantId` Daten erlangen. Der Request
akzeptiert weder `participantId` noch `contactId`; `getMe()` hat keine Parameter.

**Warum `without sharing` — und was es nicht bedeutet**

`Participant__c` hat `externalSharingModel = Private`. Ein `with sharing`-Endpoint gäbe dem
externen Portal-User darum **gar nichts** zurück: der positiv aufgelöste Datensatz wäre für
ihn unsichtbar. Solange das deklarative Sharing (Ansatz A oder B aus Phase 1.5) nicht
verifiziert ist, bleibt `without sharing` die einzige Variante, in der der Endpoint
überhaupt antwortet.

Das ist **keine** Autorisierung und keine Legitimation einer allgemeinen Ausnahme. Die
Autorisierung bleibt prozedural und ausschließlich die Einzeilen-Kette oben:

```text
aktueller User ▶ User.ContactId ▶ WHERE Participant__c.Contact__c = :contactId
```

Die Ausgabe ist eine explizite DTO-Whitelist mit zehn Feldern, einzeln kopiert — keine
sObject-Serialisierung. Ein neuer Filter darf die Kette nicht erweitern. Siehe
[ADR-010](./architecture-decisions.md) und [ADR-011](./architecture-decisions.md).

Sobald Ansatz A oder B live ist **und** der Spike-Nachweis vorliegt, wird auf
`with sharing` umgestellt und diese Ausnahme entfällt.

Ablauf:

1. `User.ContactId` auflösen — existiert keiner, `401 NO_CONTACT_IDENTITY`
2. `Participant__c` laden — existiert keiner, `404 NO_PARTICIPANT`; mehr als einer,
   `500 AMBIGUOUS_PARTICIPANT` statt willkürlich einen zu wählen
3. Programm, Coach, Start-/Enddatum sowie Name und E-Mail aus dem `Contact` zurückgeben
4. Fehlerantworten tragen HTTP-Status und stabilen Code; die rohe Exception wird nie
   ausgegeben, sie würde Feldnamen und Ids leaken

**`GET` ohne Schreibnebenwirkung — verbindlich**

Der Endpoint liest ausschließlich. Er aktiviert **keine** Einladung und schreibt **keinen**
Datensatz. Ein Lesezugriff darf keinen fachlichen Zustand verändern, sonst ändert bereits
eines dieser Ereignisse die Daten:

- die Seite wird vor dem Login geladen
- ein fehlgeschlagener Request wird vom Client wiederholt
- ein Refetch nach einer Mutation läuft erneut
- ein Health-Check oder Monitoring ruft den Endpoint auf
- der Anwender öffnet die Seite in einem zweiten Tab

Ohne diese Regel ist der Endpoint nicht wiederholbar und aus einem Refetch nicht gefahrlos
aufrufbar. Aktivierung gehört in einen expliziten Schritt des Portal-Lebenszyklus — siehe
Phase 3.2.

**Vor Produktivfreigabe zu verifizieren**

Die DTO-Whitelist begrenzt die Ausgabe, ersetzt aber keine der folgenden Prüfungen:

- [ ] Objektzugriff: welche Objekte der externe User überhaupt sehen darf
- [ ] Feldzugriff: die Whitelist ersetzt keine Feldprüfung
- [ ] Datensatzbegrenzung: ausschließlich der eigene `Participant__c`
- [ ] Verhalten mit einem **echten** externen User, nicht nur im Apex-Test
- [ ] Positivtest: User A sieht Participant A
- [ ] Negativtest: User A sieht Participant B **nicht**

Offen und nicht automatisierbar: Salesforce lässt `User.ContactId` nur bei Portal-Usern zu,
und deren Anlage verlangt zusätzlich den Setup-Schalter für externe Standardprofile. Die
Apex-Tests decken deshalb alle Branches ab `Contact` ab, nicht den Link `User → Contact`.

**4.2 Eine Seite: `/me`**

`MePage.tsx` mit genau diesen Angaben:

- Name aus `Contact`
- Participant-Status (`Participant__c.Status__c`)
- Programm
- Start- und Enddatum
- Portalstatus

**4.3 Routen und Navigation**

`PrivateRoute`-Bereich um die Portalroute erweitern, Stock-Navigation (`Search`, `TestChat`)
entfernen, `AuthAppLayout` auf Portal-Nav umstellen. Deutsche Labels wie im backend —
das Portal-Template ist aktuell englisch, das ist zu entscheiden.

**Akzeptanz:** Ein echter Portal-Login zeigt `/me` mit korrekten Daten. Ein zweiter Contact
sieht diesen Datensatz nicht.

---

### Phase 5 — Termine, Abwesenheiten, Lernpfad, Schreiboperationen

Erst jetzt wird der Portalumfang aufgebaut. Reihenfolge nach Nutzerwert:

| Schritt | Inhalt                         | Schreiboperationen                         |
| ------- | ------------------------------ | ------------------------------------------ |
| 5.1     | Termine — Liste, Details       | bestätigen, absagen, verschieben           |
| 5.2     | Abwesenheiten — Antrag, Status | beantragen, stornieren, Dokument hochladen |
| 5.3     | Lernpfad — Fortschritt         | keiner                                     |

Jede Schreiboperation braucht:

- serverseitige Autorisierung gegen den **eigenen** Datensatz, nie gegen eine
  übermittelte `participantId`
- eigenes Audit-Event
- Negativtest: Versuch auf fremden Datensatz

**Akzeptanz:** Alle Portal-Schreiboperationen erzeugen ein Audit-Event und sind auf den
eigenen Datensatz begrenzt.

---

### Phase 6 — Audit, E2E, Dokumentation, Aufräumen

| #   | Aufgabe                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Neue Event-Typen in `../activity-coverage.md` eintragen, Zähler aktualisieren                                                                   |
| 6.2 | E2E im `frontend`-Projekt: `global-setup.ts` mit `PORTAL_USERNAME` / `PORTAL_PASSWORD`, Specs für Login → `/me` → leere Datensätze; Negativtest |
| 6.3 | `../AGENTS.md` um Naming, Ownership, Portal-Architektur und Login-Fluss ergänzen                                                                |
| 6.4 | `Student_Test__c` löschen (Scratch-Rest)                                                                                                        |
| 6.5 | Schema-Drift auflösen: `../migrations/2026-09-appointment-staff-backup.csv` referenziert `Appointment__c.Staff__c`, das Feld existiert nicht    |
| 6.6 | `dist/` des UI-Bundles aus Git entfernen — **nicht** in `.forceignore`, das `dist` ist der deploybare Inhalt                                    |

---

## 4. Abhängigkeiten, die nicht im Code liegen

Diese Punkte blockieren die Umsetzung und liegen außerhalb des Repos:

1. **Experience-Cloud-Lizenzen** (Customer/Partner User) — Kauf und Zuweisung. Ohne sie
   sind Phase 1.5 und Phase 2 nicht testbar.
2. **Portal-Profil + Lizenzzuweisung** in Setup — nicht deploybar.
3. **E-Mail-Versand** — Absenderadresse, Single Sender oder Email Relay.
4. **Sharing-Regeln** müssen vor dem ersten End-to-End-Test stehen, sonst sieht der
   Pilot-Teilnehmer eine leere Seite.

---

## 5. Reihenfolge auf einen Blick

```text
0   Security, Template-Bereinigung, Ownership          ✅ 2026-09-29
1   Contact-basierte Teilnehmeranlage, Eindeutigkeit, Migration
1.5 Sharing- und Lizenz-Spike (genau ein Testbenutzer)
2   Experience-Cloud-Mitgliedschaft, Profil, Permset, Templates
3   Portalzugang aktivieren / sperren / Einladung erneut senden
4   /me-Endpoint und genau eine Portalseite
5   Termine, Abwesenheiten, Lernpfad, Schreiboperationen
6   Audit, E2E, Dokumentation, Aufräumen
```

Phase 1.5 und Phase 2 sind **Gates**. Wer sie überspringt, baut auf ungeprüfter Autorisierung.
