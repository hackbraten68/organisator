# Network-Mitgliedschaft: der Admin-Lockout und sein Fix

Stand 2026-10-01, Ziel-Org `hubSandbox`. Gemessen, nicht vermutet.

## Symptom

In Setup → Digitale Erlebnisse → Alle Sites ist die Zeile der Site `frontend` tot:

- keine URL in der URL-Spalte (als einzige von 11 Sites),
- in der Spalte **Aktion** kein klickbarer Eintrag,
- Experience Builder und Workspaces unerreichbar.

Der Hilfetext der Seite nennt die Ursache selbst: *„Wenn Sie kein Site-Mitglied
sind, ist der URL nicht verlinkt."*

## Ursache

`NetworkMemberGroup` auf ein **externes** Profil allein reicht nicht. Sobald ein
Network Mitgliedsgruppen trägt, gilt die implizite Admin-Zugehörigkeit nicht mehr.
War nur `Customer Community Plus User` eingetragen, ist der interne Administrator
kein Mitglied — und die Zeile in „Alle Sites" ist genau dann tot.

Verifiziert 2026-10-01: `samuel.dillenburg` (005Oj000016CN1hIAG) war Mitglied in
**10 von 11** Sites der Org. Nur `frontend` fehlte — exakt die tote Zeile.

```bash
sf data query --target-org hubSandbox --query \
  "SELECT Network.Name FROM NetworkMember WHERE MemberId = '005Oj000016CN1hIAG'"
```

## Fix

Eine zweite `NetworkMemberGroup` mit dem internen Profil als `ParentId` einfügen.
Das geht **nicht** per Metadata-Deploy und **nicht** per Apex, nur per REST-API:

```bash
sf data create record --target-org hubSandbox \
  --sobject NetworkMemberGroup \
  --values "NetworkId=0DB9X000000sUp7WAE ParentId=00e67000000f3P0AAI"
```

| Feld       | Wert                 | Bedeutung                         |
| ---------- | -------------------- | --------------------------------- |
| NetworkId  | `0DB9X000000sUp7WAE` | Network `frontend`                |
| ParentId   | `00e67000000f3P0AAI` | Profil `Systemadministrator`      |

Danach ist der Administrator Mitglied und die Zeile lebt wieder (ggf. 1–2 Minuten
Provisionierung abwarten, dann Seite neu laden oder neu einloggen).

## Was nicht funktioniert (alle drei gemessen)

| Weg | Ergebnis |
|---|---|
| Metadata-Deploy, Gruppe aus der Quelle entfernt | Die bestehende Gruppe bleibt in der Org. `NetworkMemberGroup` ist `deletable=False`; ein Deploy löscht keine Gruppen. |
| Apex `update` / `insert` auf `NetworkMemberGroup` | `DML operation Update not allowed on NetworkMemberGroup` — obwohl der Describe `updateable=True` meldet. |
| Apex `insert NetworkMember` | `NetworkMember` ist `createable=False`. |

Die REST-API (`sf data create record`, entspricht Data Loader) ist der einzige
funktionierende Weg. Das ist auch die dokumentierte Lösung für genau dieses Symptom
(„Workspaces/Builder link not visible because profile not added as member").

## Metadata-Falle: der Profilname

Im `networkMemberGroups`-Element steht **nicht** das lokalisierte Label:

```xml
<networkMemberGroups>
    <profile>Admin</profile>                         <!-- System Administrator -->
    <profile>Customer Community Plus User</profile>  <!-- externes Portal-Profil -->
</networkMemberGroups>
```

- `<profile>Systemadministrator</profile>` scheitert im Deploy mit
  `no Profile named Systemadministrator found`.
- Der Metadata-Name des Standardprofils ist `Admin` — der Dry-Run validiert das.

## Soll-Zustand des Network `frontend`

Zwei Gruppen, beide nötig:

1. `Admin` — ohne sie verlieren interne Administratoren die Mitgliedschaft und der
   Builder ist gesperrt (dieser Lockout).
2. `Customer Community Plus User` — nimmt künftige Portalnutzer automatisch auf.

Die Gruppen stehen in
`frontend/force-app/main/default/networks/frontend.network-meta.xml`. Sie sind dort
**dokumentiert**; angelegt wurden sie per REST, weil der Deploy sie nicht anlegen
und nicht entfernen kann.

## Verifikation

```bash
# Gruppen am Network
sf data query --target-org hubSandbox --query \
  "SELECT Id, AssignmentStatus, ParentId FROM NetworkMemberGroup
   WHERE NetworkId = '0DB9X000000sUp7WAE'"

# Mitglieder (Admin muss dabei sein)
sf data query --target-org hubSandbox --query \
  "SELECT Member.Username, Member.Profile.Name FROM NetworkMember
   WHERE NetworkId = '0DB9X000000sUp7WAE'"
```

Erwartung: zwei Gruppen auf `Added`, Mitgliedsliste enthält
`samuel.dillenburg@codingschule.de.devhub` mit Profil `Systemadministrator`.
