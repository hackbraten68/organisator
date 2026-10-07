# Testanleitung: Coach-Zugang zum Backend

Ziel des Tests ist **nicht** der Login. Ein Login beweist nichts — System-Administratoren
umgehen Feldsicherheit und Freigaben vollständig. Der Test zeigt, ob ein Kollege mit
einem **normalen Standardprofil** die Fachdaten sieht und bearbeiten kann.

## Vorbedingungen (Setup, einmalig)

### 0. Wer überhaupt als Coach getestet werden kann

`backend_Coach` ist zugewiesen an vier User. Profileingeschränkend ist aber die
Zuweisung:

| User                                            | Profil                   | Als Coach-Test brauchbar?     |
| ----------------------------------------------- | ------------------------ | ----------------------------- |
| `sandra@codingschule.de.devhub` (Sandra Krüger) | `Standardbenutzer Sales` | **ja** — einziger Nicht-Admin |
| `frank@codingschule.de.devhub` (Frank Blum)     | `System Administrator`   | nein, umgeht FLS und OWD      |
| `samuel.dillenburg@codingschule.de.devhub`      | `System Administrator`   | nein, umgeht FLS und OWD      |
| `coach.test@codingschule.de.devhub`             | `Standardbenutzer AM`    | Referenzprofil                |

Zwei der drei echten Coaches sitzen auf System-Administrator. Ein Test mit ihnen
beweist nichts — sie sehen alles, unabhängig von `backend_Coach`. **Der aussagekräftige
Test ist Sandras Sitzung.**

Deshalb auch der Grund für Schritt 1: `Standardbenutzer Sales` ist ein
Vertriebsprofil und wird die 31 Pflichtfelder sehr wahrscheinlich nicht freigeben.
Solange das so ist, wird ihr Test an Zeile 1 des Testablaufs rot.

### 1. Feldsicherheit für die 31 Pflichtfelder

`backend_Coach` kann diese Felder nicht freigeben. Salesforce lehnt jeden
`fieldPermissions`-Eintrag für ein Pflichtfeld ab, unabhängig vom Wert. Die FLS kommt
deshalb vom **Profil**.

In Setup → Benutzer → Profile → das Profil des Kollegen → Feldsicherheit
→ Feldeinstellungen bearbeiten:

| Objekt                | Felder                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuditEvent__c`       | `EventType__c`, `OccurredAt__c`, `SubjectId__c`, `SubjectType__c`, `Domain__c`, `Action__c`, `ActorType__c`, `Visibility__c`, `Sensitivity__c`, `Source__c`, `SchemaVersion__c` |
| `AuditOutbox__c`      | `EventType__c`, `Status__c`, `RetryCount__c`                                                                                                                                    |
| `Absence__c`          | `Participant__c`, `Status__c`, `Type__c`, `StartDate__c`, `EndDate__c`                                                                                                          |
| `Appointment__c`      | `Participant__c`, `Status__c`, `Type__c`, `StartTime__c`, `EndTime__c`                                                                                                          |
| `AvailabilitySlot__c` | `DayOfWeek__c`, `StartTime__c`, `EndTime__c`, `Type__c`                                                                                                                         |
| `Module__c`           | `Program__c`                                                                                                                                                                    |
| `Learning_Path__c`    | `Title__c`                                                                                                                                                                      |
| `Participant__c`      | `Contact__c`                                                                                                                                                                    |

Alle drei Berechtigungen (Lesen / Bearbeiten / Anzeigen aller Datensätze) setzen.

**Ohne diesen Schritt wird der Test an Zeile 1 rot.** Der erste Fehler lautet dann
sinngemäß "Required fields are missing" oder "insufficient access".

### 2. Permission Set zuweisen

Setup → Benutzer → der Kollege → Berechtigungszuweisungen bearbeiten
→ `backend_Coach` hinzufügen.

## Testablauf

Der Kollege meldet sich über die Salesforce-Anmeldeseite an und öffnet die
Backend-App über die App-Launcher-Suche (`Cmd/Ctrl + K`, „backend"). Er darf sich
**nicht** als System-Administrator anmelden — siehe Schritt 0.

| #   | Aktion                          | Erwartung                                                                       |
| --- | ------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Teilnehmerliste öffnen          | Teilnehmer werden angezeigt                                                     |
| 2   | Einen Teilnehmer öffnen         | Detailseite lädt vollständig, keine Permission-Fehler                           |
| 3   | Status ändern und speichern     | Gespeichert, keine Fehlermeldung                                                |
| 4   | Termin anlegen                  | Coach-Auswahl zeigt die Kollegen, nicht „undefined"                             |
| 5   | Abwesenheit genehmigen          | Status wechselt auf `Approved`                                                  |
| 6   | **Audit-Events ansehen**        | Termin- und Abwesenheitsänderungen erscheinen im Verlauf                        |
| 7   | Modul löschen                   | Löschdialog öffnet (Soll-Fall, `Module__c` hat bewusst Delete)                  |
| 8   | Teilnehmer löschen              | **Kein** Lösch-Button — das ist Absicht, das Permission Set gibt das nicht frei |
| 9   | `/contacts` öffnen              | **Genau ein** Kontakt: „Coach, Marek". Sonst filtert die Freischaltung nicht    |
| 10  | `/contacts` → Suche nach `Kaya` | „Keine Treffer". Mehmet Kaya ist nicht freigeschaltet und darf nicht auftauchen |

## Der Freischalt-Test (Schritt 9 und 10)

Seit dem Deploy vom 07.10. filtert `ListContacts.graphql` serverseitig auf
`Freigeschaltet__c = true`. In der Org ist genau ein Kontakt freigeschaltet —
`Coach, Marek` (`0039X00001zDpMrQAK`, `persona.coach@thehub.test`), gesetzt per CLI.

Damit ist der Test zweigeteilt:

- **Schritt 9 beweist den Filter.** Ein Kontakt erscheint, nicht 23. Erscheint die
  ganze Liste, ist der Bundle-Stand nicht aktiv — dann ist der Filter nicht deployed.
- **Schritt 10 beweist den Ausschluss.** Kaya existiert als Teilnehmer, ist aber nicht
  freigeschaltet. Taucht er auf, filtert die Query nicht oder der Server ignoriert die
  Bedingung.

Zusätzlich im Browser prüfbar, ohne Code: in Salesforce Setup → Objekt-Manager →
Contact → den Datensatz „Coach Marek" öffnen. Ist das Feld **Freigeschaltet** dort
nicht sichtbar, liegt es am Seitenlayout (Dynamic Forms) — der Haken ist dann nur über
den CLI setzbar. Siehe `docs/portal/setup-worklist.md`, Abschnitt Contact.

## Was ein Fehlschlag bedeutet

| Beobachtung                                        | Wahrscheinliche Ursache                                                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startseite leer, Permission-Fehler                 | FLS aus Schritt 1 fehlt                                                                                                                              |
| Coach-Auswahl im Termin leer                       | `User` ist ohne `viewAllRecords`. Das war eine bewusste Entscheidung; dann in Setup `User`-Feldsicherheit für den Coach öffnen                       |
| Anlegen schlägt fehl, Pflichtfeld                  | FLS aus Schritt 1 unvollständig                                                                                                                      |
| Audit-Events fehlen, sonst klappt es               | `AuditEvent__c` braucht `viewAllRecords` — das ist im Set enthalten, dann die 11 Audit-Felder aus Schritt 1 prüfen                                   |
| `/contacts` zeigt alle 23                          | Bundle-Filter nicht deployed. `dist/` neu bauen und `UIBundle:backend` deployen — ein Deploy allein beweist nichts, siehe `docs/AGENTS.md` Befund 12 |
| `/contacts` zeigt niemanden                        | `Freigeschaltet__c` fehlt im Runtime-Schema oder ist überall `false`. `npm run schema:check` und die 23 Contacts prüfen                              |
| Audit-Write schlägt mit `INSUFFICIENT_ACCESS` fehl | `AuditEvent__c` Create fehlt — im Set enthalten, dann die Audit-Felder aus Schritt 1                                                                 |

## Wichtig

Wenn Schritt 8 **klappt** (Löschen möglich), stimmt etwas nicht. Das Permission Set
enthält für `Participant__c` kein Delete. Wenn die Löschoption sichtbar ist, läuft der
Kollege noch mit einem Profil, das mehr darf.

## Teilnehmer-Portal

Der Portal-Login unter `/organisator` ist **live**: Network `Organisator`, Site
`Organisator1` und `UIBundle:frontend` sind deployed und an die Site gebunden. Die
Aussage aus früheren Protokollversionen, das Portal sei nicht erreichbar, ist seit
dem 05.10. überholt — siehe `docs/portal-deploy-status.md` für den Stand.

## Noch nicht getestet

Der Teilnehmer-Login liegt unter `/organisator` und ist **noch nicht erreichbar**.
Network und Site brauchen ein Experience-Cloud-Site-Setup, das nur manuell in Setup
angelegt werden kann. Siehe `backend/docs/coach-access.md`.
