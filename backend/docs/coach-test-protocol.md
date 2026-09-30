# Testanleitung: Coach-Zugang zum Backend

Ziel des Tests ist **nicht** der Login. Ein Login beweist nichts — System-Administratoren
umgehen Feldsicherheit und Freigaben vollständig. Der Test zeigt, ob ein Kollege mit
einem **normalen Standardprofil** die Fachdaten sieht und bearbeiten kann.

## Vorbedingungen (Setup, einmalig)

### 1. Feldsicherheit für die 31 Pflichtfelder

`backend_Coach` kann diese Felder nicht freigeben. Salesforce lehnt jeden
`fieldPermissions`-Eintrag für ein Pflichtfeld ab, unabhängig vom Wert. Die FLS kommt
deshalb vom **Profil**.

In Setup → Benutzer → Profile → das Profil des Kollegen → Feldsicherheit
→ Feldeinstellungen bearbeiten:

| Objekt | Felder |
|---|---|
| `AuditEvent__c` | `EventType__c`, `OccurredAt__c`, `SubjectId__c`, `SubjectType__c`, `Domain__c`, `Action__c`, `ActorType__c`, `Visibility__c`, `Sensitivity__c`, `Source__c`, `SchemaVersion__c` |
| `AuditOutbox__c` | `EventType__c`, `Status__c`, `RetryCount__c` |
| `Absence__c` | `Participant__c`, `Status__c`, `Type__c`, `StartDate__c`, `EndDate__c` |
| `Appointment__c` | `Participant__c`, `Status__c`, `Type__c`, `StartTime__c`, `EndTime__c` |
| `AvailabilitySlot__c` | `DayOfWeek__c`, `StartTime__c`, `EndTime__c`, `Type__c` |
| `Module__c` | `Program__c` |
| `Learning_Path__c` | `Title__c` |
| `Participant__c` | `Contact__c` |

Alle drei Berechtigungen (Lesen / Bearbeiten / Anzeigen aller Datensätze) setzen.

**Ohne diesen Schritt wird der Test an Zeile 1 rot.** Der erste Fehler lautet dann
sinngemäß "Required fields are missing" oder "insufficient access".

### 2. Permission Set zuweisen

Setup → Benutzer → der Kollege → Berechtigungszuweisungen bearbeiten
→ `backend_Coach` hinzufügen.

## Testablauf

Der Kolnee öffnet die Backend-App über die Salesforce-App-Launcher-Suche (`Cmd/Ctrl + K`,
„backend"). Er darf sich **nicht** als System-Administrator anmelden.

| # | Aktion | Erwartung |
|---|---|---|
| 1 | Teilnehmerliste öffnen | Teilnehmer werden angezeigt |
| 2 | Einen Teilnehmer öffnen | Detailseite lädt vollständig, keine Permission-Fehler |
| 3 | Status ändern und speichern | Gespeichert, keine Fehlermeldung |
| 4 | Termin anlegen | Coach-Auswahl zeigt die Kollegen, nicht „undefined" |
| 5 | Abwesenheit genehmigen | Status wechselt auf `Approved` |
| 6 | **Audit-Events ansehen** | Termin- und Abwesenheitsänderungen erscheinen im Verlauf |
| 7 | Modul löschen | Löschdialog öffnet (Soll-Fall, `Module__c` hat bewusst Delete) |
| 8 | Teilnehmer löschen | **Kein** Lösch-Button — das ist Absicht, das Permission Set gibt das nicht frei |

## Was ein Fehlschlag bedeutet

| Beobachtung | Wahrscheinliche Ursache |
|---|---|
| Startseite leer, Permission-Fehler | FLS aus Schritt 1 fehlt |
| Coach-Auswahl im Termin leer | `User` ist ohne `viewAllRecords`. Das war eine bewusste Entscheidung; dann in Setup `User`-Feldsicherheit für den Coach öffnen |
| Anlegen schlägt fehl, Pflichtfeld | FLS aus Schritt 1 unvollständig |
| Audit-Events fehlen, sonst klappt es | `AuditEvent__c` braucht `viewAllRecords` — das ist im Set enthalten, dann die 11 Audit-Felder aus Schritt 1 prüfen |

## Wichtig

Wenn Schritt 8 **klappt** (Löschen möglich), stimmt etwas nicht. Das Permission Set
enthält für `Participant__c` kein Delete. Wenn die Löschoption sichtbar ist, läuft der
Kollege noch mit einem Profil, das mehr darf.

## Noch nicht getestet

Der Teilnehmer-Login liegt unter `/organisator` und ist **noch nicht erreichbar**.
Network und Site brauchen ein Experience-Cloud-Site-Setup, das nur manuell in Setup
angelegt werden kann. Siehe `backend/docs/coach-access.md`.