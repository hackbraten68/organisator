# FLS-Checkliste für das Coach-Profil

Diese 31 Felder kann das Permission Set `backend_Coach` **nicht** freigeben.
Salesforce lehnt jeden `fieldPermissions`-Eintrag für ein required-Feld ab
(unabhängig vom Wert), und keines der 29 Permission Sets der Org listet eines.
Die FLS kommt deshalb vom Profil.

Setup → Benutzer → Profile → das Coach-Profil → **Feldsicherheit**
→ *Feldeinstellungen bearbeiten*. Pro Feld alle drei Rechte setzen:
**Lesen**, **Bearbeiten**, **Anzeigen aller Datensätze**.

| Objekt (Setup-Name) | Anzahl | Felder |
|---|---|---|
| `Abwesenheit` | 5 | `EndDate__c`, `Participant__c`, `StartDate__c`, `Status__c`, `Type__c` |
| `Appointment` | 5 | `EndTime__c`, `Participant__c`, `StartTime__c`, `Status__c`, `Type__c` |
| `Audit-Event` | 11 | `Action__c`, `ActorType__c`, `Domain__c`, `EventType__c`, `OccurredAt__c`, `SchemaVersion__c`, `Sensitivity__c`, `Source__c`, `SubjectId__c`, `SubjectType__c`, `Visibility__c` |
| `Audit-Outbox` | 3 | `EventType__c`, `RetryCount__c`, `Status__c` |
| `Verfügbarkeits-Slot` | 4 | `DayOfWeek__c`, `EndTime__c`, `StartTime__c`, `Type__c` |
| `Lernpfad` | 1 | `Title__c` |
| `Modul` | 1 | `Program__c` |
| `Participant` | 1 | `Contact__c` |

**Summe: 31 Felder auf 8 Objekten.**

## Danach prüfen

Setup → Benutzer → der Testnutzer `coach.test@codingschule.de.devhub`
→ **Anmelden als** (nicht als Admin abmelden, sondern diesen Nutzer wählen).

Erwartung: Die Teilnehmerliste lädt. Beim Anlegen oder Bearbeiten eines
Fachobjekts darf **kein** Feldsicherheits-Fehler kommen.

## Warum nicht am Standardprofil

Wenn diese Freigaben auf `Standardbenutzer AM` landen, bekommen **alle** User
mit diesem Profil Zugriff auf sämtliche Teilnehmerdaten — auch die, die keine
Coaches werden sollen. Besser ist ein eigenes Profil `Coach`, das nur die
ausgewählten Kollegen tragen. Für den Test mit `coach.test` ist beides identisch,
die Entscheidung fällt aber schwerer, sobald echte Kollegen drankommen.

