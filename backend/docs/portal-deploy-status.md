# Portal-Zugang: was deployed ist und was fehlt

Stand 2026-10-01, Ziel-Org `hubSandbox`.

## In der Org

| Baustein | Status |
|---|---|
| `ParticipantPortalData` (+ `PortalIdentityException`) | deployed, Active |
| `UIBundleLogin`, `UIBundleChangePassword`, `UIBundleAuthUtils`, `UIBundleSocialLoginConfig`, `UIBundleForgotPassword` | deployed, Active |
| `Participant_Portal_Access` (Permission Set) | deployed, zugewiesen an 2 Portal-User |
| `frontend_Guest_User_Api_Access` (Permission Set) | deployed |
| `UIBundle:frontend` (das React-Portal inkl. `/me`) | deployed, Active, **an Site `Organisator` gebunden** |
| Network `Organisator` | **Live**, Pfad `/organisatorv1vforcesite`, Site-as-Container |
| CustomSite `Organisator` (ChatterNetwork) | **Active**, Pfad `/organisatorv1vforcesite` |
| CustomSite `Organisator1` (Picasso) | **Active**, Pfad `/organisatorv1` |
| DigitalExperienceConfig `Organisator1` | deployed, `appContainer: true`, `appSpace: c__frontend` |

## Das React-Portal ist live

```text
https://techandteach--devhub.sandbox.my.site.com/organisatorv1
```

Verifiziert per `curl -L`: HTTP 200, `<base href="/organisatorv1/">`, `SFDC_ENV`
mit `appName: "frontend"`, und die ausgelieferte Asset-Hash
(`assets/index-C58SXKK7.js`) entspricht dem lokalen Build. Die Site ist published
(`sf community publish --name Organisator`, Network-ID `0DB9X000000sWKgWAM`).

`SITE_PATH_PREFIX` in `frontend/force-app/main/default/uiBundles/frontend/src/config/site.ts`
steht auf `/organisatorv1`; der Sync-Test `site.test.ts` prüft das gegen
`digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml` — **nicht** gegen
das Network. Die Primär-URL steht im DEC, das Network trägt die sekundäre
`...vforcesite`-URL für die Legacy-Auth-Endpunkte. Beide URLs sind verschieden und
müssen es bleiben.

## Warum eine neue Site nötig war

`appContainer` ist auf einer bestehenden Site **schreibgeschützt**. Ein bereits
existierendes Stock-LWR-Workspace (`frontend2`, Pfad `/organisator`) lässt sich daher
nicht in einen React-Container umwandeln:

```text
Der Wert für die Eigenschaft "$.appContainer" ist schreibgeschützt
und kann nicht geändert werden.
```

Damit war Net-New die einzige CLI-Möglichkeit. `appSpace` ist im Gegensatz zu
`appContainer` schreibbar und wird als **zweites** Deploy gesetzt — vorher schlägt die
Validierung fehl mit `We couldn't find the c__frontend UIBundle`.

### Drei Fehlerquellen, jeweils einmal pro Versuch

| Fehler | Ursache |
|---|---|
| `no Network named portal found` | Network und CustomSite getrennt deployed |
| `PicassoSite portal is not of type ChatterNetworkPicasso` | `picassoSite` muss `{siteName}1` sein, nicht `{siteName}` |
| `Sie können die Site mit dem Namen ... nicht bereitstellen` | Namenskollision mit bestehender Site |

Die Cross-References (`Network.site`, `Network.picassoSite`, `DEC.space`) prüfen gegen
den **bestehenden** Org-Zustand, nicht gegen die Komponenten desselben Deploys. Alle
fünf Typen müssen deshalb in **einem** Aufruf liegen, sonst schlägt die Validierung der
übrigen fehl.

### Zwei Abweichungen von den offiziellen `sf-skills`-Templates

1. `<networkMemberGroups>` enthält zusätzlich `customer community plus user`. Das
   Template hat nur `admin` — das würde alle Portal-User aussperren, also genau den
   Lockout aus [`portal/network-mitgliedschaft-lockout.md`](portal/network-mitgliedschaft-lockout.md).
2. `sfdc_cms__languageSettings` ist **nicht** deployed. Der Content-Typ bricht mit einem
   Plattformfehler ab (`ErrorId 453620757-1174626`, `NullPointerException` auf
   `isAuthoringOnly`) — unabhängig vom Workspace-Zustand, also kein Ordering-Problem.
   Für eine einsprachige Site entbehrlich. Die Salesforce-Referenz nennt den Typ selbst
   „authoring-only … until the platform runtime change lands".

## Die alten Sites

Drei Sites liegen noch in der Org und sind **nicht** mehr das Portal:

| Site | Pfad | Zustand |
|---|---|---|
| `Organisator` | `/organisatorv1` | **das React-Portal** |
| `frontend` | `/organisatorvforcesite` | delegiert per `<picassoSite>frontend2</picassoSite>` nach `/organisator`, liefert dort Stock-LWR. Login-/Session-Altlast. |
| `frontend2` | `/organisator` | Stock-LWR, Picasso-Site ohne eigenes Network. |
| `portal` | `/portal` | **Müll aus einem fehlgeschlagenen Binding-Versuch**, nicht mehr benutzt. |

`portal` lässt sich nicht löschen (`Site.delete=False`). **Offen: in Setup archivieren.**

`frontend` und `frontend2` können erst archiviert werden, wenn niemand mehr alte Links
teilt — `/organisatorvforcesite` leitet heute mit zwei Redirects auf
`/organisator/login` weiter.

### Site-Mitgliedschaft: der Admin-Lockout

Eine `NetworkMemberGroup` nur auf ein externes Profil sperrt den internen
Administrator aus: die Zeile in „Alle Sites" verliert URL und Aktionen, der Builder
ist unerreichbar. Fix per REST-Insert einer zweiten Gruppe mit dem Profil `admin`.
Vollständig dokumentiert in
[`portal/network-mitgliedschaft-lockout.md`](portal/network-mitgliedschaft-lockout.md).

## Portal-Testuser: Bestand

Es liegen zwei Portal-User mit `ContactId` und `Participant__c`-Zeile vor:

| Rolle | User | Contact | `Participant__c` | Zweck |
|---|---|---|---|---|
| Primärer Testuser | `mehmet.kaya.portal@codingschule.de.devhub` (`0059X00000rOHULQA4`) | `0039X000023sDyWQAU` | `a0s9X00000boVT9QAM` „Mehmet Kaya" | Hauptpfad des UAT |
| Zweiter Testuser | `probe.mixeddml2.1790159877908@example.invalid` (`0059X00000qeMkQQAU`) | `0039X000021stNjQAI` | `a0s9X00000bqpfRQAQ` „Probe MixedDml2" | **Negativtest** |

Beide haben das Passwort gesetzt, `Participant_Portal_Access` zugewiesen, ein gesetztes
`Portal_User__c` und eine `Portal_Access__c`-Read-Share. Der zweite User existierte
ursprünglich als Wegwerf-Artefakt eines Mixed-DML-Probes und wurde für den Negativtest
wiederverwendet — als Contact und Participant, nicht als User, also ohne etwas Neues
anzulegen.

**Damit ist der Negativtest ausgeführt und bestanden**, siehe
[Abschnitt Autorisierung](#autorisierung-with-sharing--apex-managed-sharing-stand-2026-10-01):
User A sieht nur Participant A, beide User teilen sich denselben Account
(`0019X00002OOmgDQAT`), die Isolation ist also nachweislich pro User und nicht zufällig
pro Account. Der Probe-User ist damit kein Wegwerf mehr, sondern Teil des UAT-Sets und
**nicht löschen**.

Die alte Anleitung zur Erstellung eines Portal-Users ist damit überholt. Neu anlegen ist
nur nötig, wenn ein weiterer Identitätspfad geprüft werden soll.

### Reservierte UAT-Daten ohne Portal-User

Ein zweites, vollständiges Testset liegt bereit, wird aber nicht vom Portal genutzt, weil
die Lizenzklasse voll ist:

```text
Account    0019X00002OdEKcQAN  "SPIKE Portal Test Account B"
Contact    0039X0000244DE7QAM  "Spike Beta"   (auf dem Account)
Participant a0s9X00000bqpabQAA "Spike Beta"   Status Active, Portal_User__c leer
```

Es gibt **keinen** User dazu — die Anlage schlug mit fehl in der Lizenzklasse fehl
(`LICENSE_LIMIT_EXCEEDED: Customer Community Plus`), und zwar auch nicht mit dem Profil
`Trainer`, das dieselbe Lizenzklasse belegt. Belegung aktuell:

| User | Profil | Aktiv |
|---|---|---|
| `lena.student@thehub.test.devhub` | Customer Community Plus User | nein |
| `probe.mixeddml2.1790159877908@example.invalid` | Customer Community Plus User | ja |
| `mehmet.kaya.portal@codingschule.de.devhub` | Customer Community Plus User | ja |

Der Satz ist der vorbereitete zweite **echte** Portal-User für die Browservalidierung, falls
die Isolation später mit zwei getrennten Accounts statt zweier User auf demselben Account
geprüft werden soll. Bis dahin bewusst stehen lassen: er kostet nichts, und ein später
neu aufgebauter Satz wäre Arbeit ohne Erkenntnis. **Löschen erst**, wenn entweder eine
Lizenz ohnehin gebraucht wird oder die Browservalidierung abgeschlossen ist.

### Erzeugen eines weiteren Portal-Users, falls doch nötig

1. Toggle prüfen — Setup → Digitale Erlebnisse → Einstellungen →
   *Aus Standard-externen Profilen die Selbstregistrierung, Benutzererstellung und
   die Anmeldung erlauben*. Ohne ihn scheitert das Setzen von `User.ContactId` mit
   `FIELD_INTEGRITY_EXCEPTION`.
2. Contact und `Participant__c` anlegen, klar als Test gekennzeichnet. `Contact__c` ist
   auf `Participant__c` Pflicht.
3. Portal-User auf diesen Contact anlegen, Passwort setzen. In der Sandbox geht das
   nicht per Setup-Route („nur zurücksetzen") und auch nicht per SOAP — die OAuth-Tokens
   waren abgelaufen. **Beliebter Weg: `System.setPassword(userId, pw)` per Execute
   Anonymous.** `Participant__c` bekommt `Portal_User__c = <User-Id>`; der Trigger legt
   die Share an. Getrennte Apex-Läufe verwenden, sonst `MIXED_DML_OPERATION`
   (Setup-Objekt `GroupMember` nach Non-Setup-Objekt `Participant__c`).
4. `Participant_Portal_Access` zuweisen — ohne das gibt der Endpoint `403 FORBIDDEN`
   statt Daten, siehe [Abschnitt Live-Nachweis](#live-nachweis-der-automatik).

## Autorisierung: `with sharing` + Apex Managed Sharing (Stand 2026-10-01)

### Befund

`Participant__c` steht auf `sharingModel=ReadWrite`, `externalSharingModel=Private`,
`enableSharing=true`. Die Org erzwingt Apex-Record-Sharing. Gemessen: der Portal-User
sah bei `SELECT COUNT() FROM Participant__c` **0 Rows**, obwohl `ParticipantPortalData`
damals `without sharing` lief — System Mode greift hier also nicht.

Drei Freigabe-Varianten wurden durchgemessen, jeweils über echte Portal-Sessions:

| Kriterium der Sharing Rule | Mehmet | Probe-User |
|---|---|---|
| statische User-ID | **200** | 404 |
| `$User.UserRecord.Id` | 404 | 404 |
| `$User.Id` | 404 | 404 |

**Ergebnis: Eine Criteria-Based Sharing Rule scheitert in dieser Org daran, dass
`$User…` nicht ausgewertet wird.** Salesforce speichert und zeigt den Wert, vergleicht
aber literal — die Regel findet keine Row, jeder Portal-User bekommt `NO_PARTICIPANT`.
Das ist kein Maskenproblem, sondern Verhalten; beide Varianten sind live gemessen.

Damit ist der Ansatz aus ADR-012 (A: deklarative Rule, B: Sharing Set) in dieser Org
nicht umsetzbar. Gewählt: **C bleibt, die Autorisierung wandert aus dem Apex-Code in die
Datensatzfreigabe** — Ansatz C nach dem Wortlaut der ADR („prozedural autorisierter
Endpoint") wird damit um eine Sharing-Ebene ergänzt, die es vorher nicht gab. ADR-012
nennt dieses Zielbild ausdrücklich als möglich:

```text
C bleibt + deklaratives Sharing kommt als zusätzliche Schutzschicht dazu
C bleibt + Klasse wechselt nach erfolgreichem Spike auf with sharing
```

Beides ist umgesetzt.

### Lösung: direkte `Participant__Share`-Zeilen

`ParticipantPortalSharingService` legt je `Participant__c` mit `Portal_User__c` genau
eine Read-Share auf genau diesen Portal-User an, RowCause `Portal_Access__c`. Damit ist
Isolation **pro User**, nicht pro Account — zwei Portal-User auf demselben Account sehen
weiterhin nur ihre eigene Zeile.

Beweis, beidseitig:

| Zustand | Mehmet | Probe-User |
|---|---|---|
| beide Shares vorhanden | **200** `a0s9X00000boVT9QAM` | **200** `a0s9X00000bqpfRQAQ` |
| Probe-Share entzogen | 200 | **404** |

Der Probe-User besitzt eine existierende Teilnehmerzeile mit korrekt gesetztem
`Portal_User__c` und vollem Permission Set und sieht sie nur dann, wenn der Share
existiert. Der Share ist damit das Gate, nicht der serverseitige Filter.

### Zwei Schutzschichten in `ParticipantPortalData`

1. **Record-Level Sharing** — die Klasse läuft `with sharing`; die Query sieht
   konstruktionsbedingt nur die freigegebene Row.
2. **Identity-Filter** — `resolveForPortalUser()` prüft zusätzlich
   `Portal_User__c = UserInfo.getUserId()`, sonst **403 `PORTAL_ACCESS_NOT_GRANTED`**.

Der 403 ist gewollt: der Caller ist ein legitimer, angemeldeter Portal-User — die
ehrliche Antwort ist „nicht für dich freigegeben", nicht „existiert nicht".

### Apex Sharing Reason `Portal_Access__c`

**Der Eintrag existiert nur in Salesforce Classic, nicht in Lightning.** In Lightning →
Object Manager → Participant fehlt er vollständig, was leicht als Org-Defekt fehlgedeutet
wird. Der Weg:

```text
Setup → Switch to Salesforce Classic → Build → Create → Objects
→ Participant (Objektnamen anklicken) → Related List "Apex Sharing Reasons" → New
  Label: Portal Access
  Name:  Portal_Access
```

`ApexSharingReason` fehlt zudem in der Registry des `@salesforce/cli`, der Grund ist also
nicht deploybar. Nach dem Anlegen ist er in Apex referenzierbar:

```text
Schema.Participant__Share.RowCause.Portal_Access__c
```

Damit trennt der RowCause die Portal-Shares sauber von allen anderen Freigaben auf
`Participant__c`. Vorher (`RowCause.Manual`) musste der Service die eigenen Shares über die
Identität erkennen — der User, auf den die Row freigegeben ist — was eine Admin-Freigabe an
dieselbe Person nicht von einer Portal-Freigabe unterscheiden konnte. Mit eigenem Grund ist
das nicht mehr nötig: `isOurs()`, `keptAsAmbiguous` und der `previousPortalUsers`-Parameter
sind ersatzlos entfallen.

**Nachgewiesen live.** Eine manuelle Admin-Freigabe (`Manual`) und die Portal-Freigabe
(`Portal_Access__c`) zeigten auf **denselben** Portal-User derselben Row. Nach dem Umhängen
des Release-Ziels:

| UserOrGroupId | RowCause | nach dem Wechsel |
|---|---|---|
| `0059X00000qeMkQQAU` | `Portal_Access__c` | durch die neue ersetzt |
| `0059X00000qeMkQQAU` | `Manual` | **unverändert erhalten** |

Unter `Manual` wären beide Rows nicht unterscheidbar gewesen.

`RowCause` ist kein schreibbares Feld (`Field is not writeable: Participant__Share.RowCause`),
Shares lassen sich also nicht in-place umstellen. Nach dem Wechsel des Grundes einmal
`synchroniseAll()` ausführen: es löscht die Shares des alten Grundes und legt sie neu an.

### `synchroniseAll()` ist vollständig, nicht nur additiv

Mit eigenem Grund kann der Abgleich auch verwaiste Shares entfernen — eine Row, deren
`Portal_User__c` geleert wurde, ohne dass der Trigger lief. Vorher war das unmöglich, weil
eine verwaiste Share keinem Portal-User zugeordnet werden konnte und stilles Entziehen als
das größere Risiko galt. Der Trigger deckt den Einzelzeilenfall ab, `synchroniseAll()` alles
Übrige: aus Setup oder Data Loader importierte Rows, ein Release-Ziel, das bei inaktivem
Trigger geändert wurde, und Shares aus einer früheren RowCause-Generation.

Berührt weiterhin ausschließlich Shares mit `PORTAL_ROW_CAUSE`. Eine manuelle
Admin-Freigabe wird von einem Reconcile nicht entfernt.

### Live-Nachweis der Automatik

Über echte Portal-Sessions, Service und Trigger sind deployed:

| Aktion | Ergebnis |
|---|---|
| `Portal_User__c` auf einen Portal-User setzen | Read-Share mit `Portal_Access__c` angelegt |
| Release von Mehmet auf Probe-User umhängen | alte Share ersetzt, neue angelegt, nur eine bleibt |
| Admin-`Manual`-Share an denselben User | **unverändert erhalten** |
| Mehmet nach der Umhängung | **403 `PORTAL_ACCESS_NOT_GRANTED`** |
| `Portal_User__c` auf `null` | Share entfernt, 0 Rows |
| Mehmet ohne Freigabe | **403 `PORTAL_ACCESS_NOT_GRANTED`** |
| `synchroniseAll()` nach RowCause-Wechsel | alte Shares ersetzt, `Portal_Access__c` |
| Endstand | beide User 200 mit eigener Row, ohne Session 401 |

Eine Share an einen **internen** User schlägt fehl:

```text
FIELD_INTEGRITY_EXCEPTION: AccessLevel (trivial share level Read,
                             for organization with default level Edit)
```

Das ist kein Defekt: `sharingModel = ReadWrite` bedeutet Default-Level `Edit` intern, und
`Read` ist gegenüber dem internen Default „trivial". Externe Portal-User bekommen `Read`
korrekt — der Fehler trat nur beim Test mit einem internen Admin als Release-Ziel auf.

### Derselbe Org-Defekt: CustomFields

Das Anlegen neuer CustomFields per Metadata API schlägt in dieser Org **still** fehl:
der Deploy meldet `Created`, `describe` zeigt das Feld nicht. Betroffen waren
`Participant__c.Portal_User__c` und `Portal_User_Id__c`. Neue Felder müssen in dieser
Sandbox einmalig manuell in Setup angelegt werden.

### Test-Nachweis über die REST-Daten-API nicht möglich

Die im Spike-Protokoll vorgesehene Prüfung
(`GET /services/data/.../query?q=SELECT Id FROM Participant__c` mit Portal-Session)
scheitert an der Plattform: Experience-Cloud-Sessions sind für die allgemeine
REST-Daten-API ungültig (`INVALID_SESSION_ID: This session is not valid for use with
the REST API`). Auch der LWR-Proxy unter `/organisatorv1/sf/api/services/data` leitet
nur `services/apexrest` weiter. Der Nachweis wird deshalb über `/me` mit echten
Portal-Sessions geführt, nach dem `with sharing`-Wechsel also über den Endpoint selbst.

### Logout: Server-Seite invalidiert, Cookie-Jar im Test irreführend

`GET /sfsites/s/logout?site=Organisator` (302, danach `/organisatorv1/login`) invalidiert
die serverseitige Session. Über `AuthSession` geprüft: die `ChatterNetworks`-Sessions des
Portal-Users haben `LastModifiedDate == CreatedDate` und `IsCurrent = false`.

Ein `curl`-Test mit Cookie-Jar meldet danach fälschlich weiterhin `200`. Grund ist das
Testsetup, nicht das Verhalten: Experience-Cloud-Sessions sind **nicht** über
`Authorization: Bearer <sid>` prüfbar — die REST-API weist sie mit
`INVALID_SESSION_ID: This session is not valid for use with the REST API` ab, man bekommt
also immer `NO_CONTACT_IDENTITY` und damit ein falsches „Logout hat gewirkt". Der sid ist
zudem an den `TempChatterNetworks`-Session-Typ gebunden, den Salesforce erst serverseitig
abläuft, während curl das alte Cookie weiter mitsendet.

**Für den Abnahmetest:** Logout im echten Browser prüfen (geschützte Route muss wieder
den Login verlangen), nicht per `curl` mit Cookie-Jar. Wer es per API prüfen will, muss
das Cookie-Set nach dem Logout neu aufbauen, statt das alte weiterzureichen.

### Setup-Elemente, die es nur in Salesforce Classic gibt

Ein Teil der Experience-Cloud-Konfiguration ist in **Lightning nicht erreichbar**, sondern
nur nach einem Wechsel der gesamten Oberfläche. In Lightning fehlt der Menüpunkt
vollständig, was leicht als Org-Defekt fehlgedeutet wird — diesen Fehlschluss haben wir
gemacht und daraus fast eine zweite Fehlersuche gebaut.

Wechsel oben rechts im Profilmenü:

```text
Setup → Switch to Salesforce Classic
```

Es genügt **nicht**, eine Classic-Unterseite in Lightning zu öffnen; die Oberfläche muss
wirklich wechseln.

#### Apex Sharing Reasons (Bestand, angelegt)

```text
Classic → Setup → Build → Create → Objects
        → Participant (Objektnamen anklicken, nicht „Edit")
        → Related List „Apex Sharing Reasons" → New
            Label: Portal Access
            Name:  Portal_Access
```

`ApexSharingReason` fehlt in der Registry des `@salesforce/cli`, der Grund ist also nicht
deploybar. Nötige Berechtigung ist *Author Apex*; *Modify All Data* betrifft nur das
Anlegen der Share-Datensätze selbst, nicht das Definieren des Grundes.

Nach dem Anlegen ist er in Apex referenzierbar und nach einem Deploy der
`ParticipantPortalSharingService` in Gebrauch — siehe [Abschnitt Apex Sharing
Reason](#apex-sharing-reason-portal_access__c).

#### Login-Site: das React-Login wird ausgeliefert (geklärt 2026-10-01)

**Die Site ist richtig konfiguriert.** `/organisatorv1/login` liefert das React-Bundle:

```html
<base href="/organisatorv1/">  …  assets/index-BFfkKz_H.js
```

Ein zwischenzeitlicher Befund, die Site liefere Salesfaces eigenes Login-Formular, war
**falsch** und beruhte auf einem Fehler im Test, nicht in der Konfiguration. Ursache:
`playwright.live.config.ts` trug den Site-Pfad in `baseURL`, und `page.goto('/login')` ist
pfadwurzelrelativ — Playwright hat den Pfad verworfen und gegen `/login` auf dem
Site-Root getestet. Das ist per `301` auf **`AnmeldungsPortal`** gegangen, eine völlig
andere Site. Dort wurde das Standard-Formular gefunden (`name="username"`,
`/img/clear.png`, `LoginHint.clearExistingIdentity()`) und fälschlich dieser Site
zugeschrieben.

Korrigiert in `playwright.live.config.ts`: `baseURL` trägt nur den Host, jede Spec schreibt
den vollen Site-Pfad (`/organisatorv1/login`).

#### Gast-Login gegen die Live-Site (geklärt 2026-10-01)

Der Gast-Login funktioniert. Live verifiziert über echte Browser-Sessions und als
Playwright-Test gegen die Site:

| Prüfung | Ergebnis |
|---|---|
| Gast sieht `/login` | Submit wird **nach ~1,3 s** bedienbar |
| Gast ruft `/me` | `401`, `NO_CONTACT_IDENTITY`, alle Teilnehmerfelder `null` |
| Portal-User meldet sich an | Weiterleitung aus `/login`, Teilnehmerdaten sichtbar |

Gemessen mit `PORTAL_USER` / `PORTAL_PASSWORD`; `playwright.live.config.ts`. Ohne diese
Variablen überspringt nur der Anmeldetest, die Gastprüfungen laufen immer.

Der Submit-Button ist während der Session-Prüfung kurz gesperrt — das ist die
Session-Prüfung, nicht ein Fehler. `AuthContext` hat dafür inzwischen eine Obergrenze von
`AUTH_PROBE_TIMEOUT_MS` (8 s), damit eine nicht aufgelöste Prüfung den Gast nicht
aussperrt. **Diese Grenze hat den gemessenen Fall aber nicht verursacht und ihre Notwendigkeit
ist nicht belegt**: derselbe Test besteht auch mit dem Altcode. Sie ist ein
Robustheitsnetz gegen ein Promise, das hängen bliebe, und der Gast-403 auf dem
CSRF-Endpunkt ist der naheliegende Auslöser dafür, dass überhaupt eine Grenze nötig ist.

### Local Dev: Vite-Proxy nicht funktionsfähig (Stand 2026-10-01)

```text
GET  http://localhost:5173/                                      -> 200 (App-Shell laeuft)
POST http://localhost:5173/services/apexrest/auth/login         -> 401 UNAUTHORIZED_EXCEPTION
```

`VITE ready`, die App laeuft, aber der Salesforce-Proxy kann keine Org-Session
herstellen. Ursache ist derselbe abgelaufene OAuth-Token wie beim Metadata-Weg:
`sf org display` meldet `Connected`, der Token ist aber nicht mehr gueltig
(REST 401, Refresh `invalid_grant: expired access/refresh token`). `sf config get
target-org --global` liefert `hubSandbox`, ist also nicht die Ursache.

Fuer den lokalen Dev-Betrieb ist deshalb ein Browser-Login noetig:

```text
sf org login web --alias hubSandbox --set-default
```

Ergaenzende Einschraenkung, unabhaengig davon: der Dev-Proxy laeuft mit der Session von
**samuel.dillenburg**, also einem internen Admin ohne `ContactId`. `/me` antwortet dort
korrekterweise mit `NO_CONTACT_IDENTITY` — das ist kein Fehler, sondern das erwartete
Verhalten. Lokal sieht man die App mit Samuel; die Teilnehmeransicht ist nur live oder
mit einer Portal-User-Session sichtbar.

### Bevor eine Konfigurationsänderung vorgeschlagen wird

Zwei Fehler, die hier je einen Tag gekostet haben. Beide waren Fehler im Messaufbau,
nicht in der Anwendung:

**1. Der Test lief gegen die falsche Site.** `playwright.live.config.ts` trug den
Site-Pfad in `baseURL`, `page.goto('/login')` ist pfadwurzelrelativ. Ergebnis: der Test
lief gegen `/login` auf dem Root → `301` → `AnmeldungsPortal`, eine andere Site mit
Salesfaces Standard-Login. Daraus wurde die falsche Diagnose, die Site liefere nicht unser
Bundle. **Regel:** bevor ein Befund eine Konfiguration ändert, den tatsächlichen
Request-URL aus dem Test heraus protokollieren (`page.on('request')`), nicht aus dem
Konfigurationswert ableiten.

**2. `dist/` wird von Playwright nicht neu gebaut.** `playwright.config.ts` serviert das
vorhandene `dist/` mit `npx serve dist --single`. Ein Testlauf nach einer `src/`-Änderung
prüft das alte Bundle — hier eines vom 1. Oktober. **Regel:** vor jedem Testlauf
`npm run build`.

Und die Regel, die sich bewährt hat: **eine Assertion gilt erst als Beleg, wenn sie mit
dem gestashten Altcode fehlschlägt.** Eine grüne Suite beweist zunächst gar nichts. Hier
hat sie sogar das Gegenteil belegt: der Timeout-Fix in `AuthContext` besteht die
Live-Tests auch ohne ihn, und die Sperre des Submit-Buttons dauert real rund 1,3 s. Der
Fix ist damit als Notwendigkeit **nicht** belegt — er bleibt als Robustheitsnetz gegen
ein hängendes Promise, aber er war nicht die Ursache des gemeldeten Problems.

