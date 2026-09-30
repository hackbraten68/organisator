# Portal-Zugang: was deployed ist und was fehlt

Stand 2026-09-30, Ziel-Org `hubSandbox`.

## In der Org

| Baustein | Status |
|---|---|
| `ParticipantPortalData` (+ `PortalIdentityException`) | deployed, Active |
| `UIBundleLogin`, `UIBundleChangePassword`, `UIBundleAuthUtils`, `UIBundleSocialLoginConfig`, `UIBundleForgotPassword` | deployed, Active |
| `Participant_Portal_Access` (Permission Set) | deployed, **0 Zuweisungen** |
| `frontend_Guest_User_Api_Access` (Permission Set) | deployed |
| `UIBundle:frontend` (das React-Portal inkl. `/me`) | deployed |

## Fehlt: Network und CustomSite

Das Portal ist damit **noch nicht erreichbar**. `hubSandbox` hat kein Network und keine
Site mit Pfad `/organisator`.

Die Abhängigkeitskette:

```text
SiteDotCom "frontend1"   ← kann nur Setup erzeugen
        ↓
Network "frontend"  +  CustomSite "frontend"   ← aufeinander angewiesen
        ↓
DigitalExperienceBundle "site/frontend1"  +  UIBundle "frontend"
```

Network und CustomSite referenzieren sich gegenseitig; sie müssen zusammen deployed
werden. Beide brauchen vorher das `SiteDotCom`.

### Warum das nicht aus dem Repo kommt

`siteDotComSites/` war nie im Frontend-Projekt — es steht in keiner Commit-Historie.
Die `.site`-Datei ist eine Binärdatei, die Salesforce beim Anlegen der Site in Setup
erzeugt:

- Nur die `.site-meta.xml` zu deployen lehnt die Metadata API ab:
  `Expected source files for type 'SiteDotCom'`
- Die `.site` aus einem anderen Org-Portal zu kopieren geht technisch, aber die vier
  Sites in dieser Sandbox haben **vier verschiedene** Binärdateien. Jede trägt ihre
  eigene Konfiguration, und ein Fremd-Artifact gehört nicht in dieses Repo.

### Setup-Schritte

1. Setup → Digitale Erlebnisse → Alle Sites → Neue Site
2. Name `frontend1`, Pfad `/organisator`, Site-Typ Experience Cloud
3. Danach in Setup den Klick "Aktivieren", damit das Network `Live` wird

## Danach

```bash
cd frontend
sf project retrieve start --target-org hubSandbox --metadata SiteDotCom:frontend1
sf project deploy start --target-org hubSandbox \
  --metadata Network:frontend --metadata CustomSite:frontend \
  --metadata DigitalExperienceBundle:site/frontend1 --wait 40
```

Der Retrieve holt die `.site`-Datei ins Projekt, damit der Schritt ab dann
reproduzierbar aus dem Repo läuft statt erneut in Setup.

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