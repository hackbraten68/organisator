# Seed Sample Data (Dev-Werkzeug)

Erzeugt realistische Demo-Daten für 10–13 Teilnehmer inkl. echter Audit-Historie.

## Usage

```bash
node scripts/seed-sample-data.mjs --target-org backendtest   # seeden (Abbruch bei existierendem Manifest)
node scripts/seed-sample-data.mjs --target-org backendtest --dry-run
node scripts/seed-sample-data.mjs --target-org backendtest --rebuild   # Cleanup + Neuaufbau
```

## Wie es funktioniert

- Nutzt die Repo-`.graphql`-Dokumente als Text und spiegelt die Service-Auditlogik
  1:1 ( gleiche Eventtypen, gleicher `changes`/`metadata`-Split). Die TS-Services
  selbst können außerhalb des Bundles nicht laufen (`createDataSDK` braucht die
  Bundle-Session) — Service-Codepfade sind unit-getestet, dieses Script testet
  das Org-Ende-zu-Ende (Picklists, Lookups, Timeline, Projektion).
- `occurredAt` wird über ~3 Wochen gestaffelt → realistische Timeline.
- Jeder Lauf markiert seine Audit-Events mit `CorrelationId = DEV_SEED_<Datum>`.

## Known Gaps (bewusst, nicht versteckt)

- Absence-/Appointment-Domänen haben keine Writer und werden nicht geseedet.
- (Geschlossen 2026-09-27: `participant.created` hat jetzt einen
  Produktiv-Writer in `participantService.createParticipant`. Der Seed
  emittiert weiter direkt, weil Plain-Node kein `createDataSDK` ausführen
  kann — Shapes spiegeln `recordParticipantCreation` 1:1.)

## Idempotenz / Cleanup

- `scripts/.seed-manifest.json` (git-ignored) listet alle erzeugten IDs.
  Existiert es → Abbruch (kein Doppel-Seed).
- `--rebuild` löscht zuerst: Seed-Audit-Events (`CorrelationId LIKE 'DEV_SEED_%'`
  als robustes Netz + Manifest-IDs), dann Items, dann Teilnehmer.
- Seed-Audit-Events werden **mit gelöscht** — deterministischer Zustand statt
  referenzloser Historie-Narben.

## Datensatz

11 Teilnehmer (DE-Namen), Status-Mix Onboarding/Active/Paused/Graduated,
Inbox-Lücken exakt auf den produktiven Regeln (GitHub/Discord/Coach/Programm),
Lernpfad-Dramaturgie je Status (siehe `PEOPLE` im Script).
