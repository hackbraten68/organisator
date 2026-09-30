# Portal-Zugang: was deployed ist und was fehlt

Stand 2026-10-01, Ziel-Org `hubSandbox`.

## In der Org

| Baustein | Status |
|---|---|
| `ParticipantPortalData` (+ `PortalIdentityException`) | deployed, Active |
| `UIBundleLogin`, `UIBundleChangePassword`, `UIBundleAuthUtils`, `UIBundleSocialLoginConfig`, `UIBundleForgotPassword` | deployed, Active |
| `Participant_Portal_Access` (Permission Set) | deployed, **0 Zuweisungen** |
| `frontend_Guest_User_Api_Access` (Permission Set) | deployed |
| `UIBundle:frontend` (das React-Portal inkl. `/me`) | deployed, **noch keiner Site zugeordnet** |
| Network `frontend` | **Live**, Pfad `/organisatorvforcesite`, Site-as-Container |
| CustomSite `frontend` | **Active**, Pfad `/organisatorvforcesite` |

## Network und CustomSite existieren

Network `frontend` (Live) und CustomSite `frontend` (Active) sind seit 2026-10-01 in
der Org, Pfad `/organisatorvforcesite`. Beide referenzieren sich gegenseitig und wurden
zusammen deployed.

Daneben existiert eine zweite Site `frontend2` am Pfad `/organisator` — eine
Stock-LWR-Site **ohne** Network, ohne eigenen Guest-User. Sie ist nicht Teil des
Portals und liefert das Standard-Communities-Login aus.

### Site-Mitgliedschaft: der Admin-Lockout

Eine `NetworkMemberGroup` nur auf ein externes Profil sperrt den internen
Administrator aus: die Zeile in „Alle Sites" verliert URL und Aktionen, der Builder
ist unerreichbar. Fix per REST-Insert einer zweiten Gruppe mit dem Profil `Admin`.
Vollständig dokumentiert in
[`portal/network-mitgliedschaft-lockout.md`](portal/network-mitgliedschaft-lockout.md).

## Offen: UIBundle an die Site binden

`UIBundle:frontend` ist deployed, aber noch keiner Site zugeordnet. Der Pfad
`/organisatorvforcesite` serviert derzeit das Stock-LWR-Login, nicht das React-Portal.
Die Zuordnung passiert im Experience Builder (Site-Einstellungen), sobald der Builder
wieder erreichbar ist. Danach muss `SITE_PATH_PREFIX` in
`frontend/force-app/main/default/uiBundles/frontend/src/config/site.ts` auf den
tatsächlichen Pfad zeigen (steht noch auf `/organisator`).

## Nächster Setup-Schritt: Portal-User anlegen

1. Toggle prüfen — Setup → Digitale Erlebnisse → Einstellungen →
   *Aus Standard-externen Profilen die Selbstregistrierung, Benutzererstellung und
   die Anmeldung erlauben*. Ohne ihn scheitert das Setzen von `User.ContactId` mit
   `FIELD_INTEGRITY_EXCEPTION`.
2. Contact und `Participant__c` anlegen, klar als Test gekennzeichnet.
3. Portal-User auf diesen Contact, Passwort per API setzen.
   `emailSenderAddress` war `...@codingschule.de.invalid` und ist auf
   `samuel.dillenburg@codingschule.de` korrigiert, aber ob der Versand in der Sandbox
   freigeschaltet ist, ist ungetestet. ADR-005 (Willkommens-Mail) bleibt ungetestet.
4. `Participant_Portal_Access` zuweisen.

## Der eigentliche Test

Ein Testteilnehmer loggt sich ein und sieht Name, Status und Programm. Der
schwierigere Teil ist der **Negativtest**: mit einem zweiten Portal-User prüfen, dass
dieser die Daten des ersten nicht sieht.

`ParticipantPortalData` läuft `without sharing`, weil `Participant__c` extern `Private`
ist und `with sharing` für externe Nutzer nichts zurückgäbe. Damit ist der Filter
`Participant__c WHERE Contact__c = :contactId` das Einzige zwischen dem Aufrufer und
allen anderen Teilnehmerzeilen — es gibt keine Sharing Rules, keine FLS, keine zweite
Absicherung. Dieser Pfad ist noch nie gegen eine echte externe Identität gelaufen.