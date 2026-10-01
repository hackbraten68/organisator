# Portal-Zugang: was deployed ist und was fehlt

Stand 2026-10-01, Ziel-Org `hubSandbox`.

## In der Org

| Baustein | Status |
|---|---|
| `ParticipantPortalData` (+ `PortalIdentityException`) | deployed, Active |
| `UIBundleLogin`, `UIBundleChangePassword`, `UIBundleAuthUtils`, `UIBundleSocialLoginConfig`, `UIBundleForgotPassword` | deployed, Active |
| `Participant_Portal_Access` (Permission Set) | deployed, **0 Zuweisungen** |
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