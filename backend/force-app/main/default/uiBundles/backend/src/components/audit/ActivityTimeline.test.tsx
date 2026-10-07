import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityTimeline } from "./ActivityTimeline";
import type { AuditEvent } from "@/types/audit";

const statusChangedEvent: AuditEvent = {
  id: "a0AA000000000001AAA",
  recordedAt: "2026-09-25T10:00:01.000Z",
  occurredAt: "2026-09-25T10:00:00.000Z",
  schemaVersion: 1,
  eventType: "participant.status_changed",
  domain: "participant",
  action: "status_changed",
  actorType: "staff",
  actorId: "005000000000001AAA",
  actorDisplayNameSnapshot: "Test Coach",
  subjectType: "Participant__c",
  subjectId: "a0PA000000000001AAA",
  participantId: "a0PA000000000001AAA",
  source: "web",
  correlationId: "corr-1",
  changedFields: ["Status__c"],
  changes: [
    {
      field: "Status__c",
      oldValue: "Onboarding",
      newValue: "Active",
      displayType: "status",
      redacted: false,
    },
  ],
  metadata: {},
  visibility: "staff",
  sensitivity: "normal",
};

describe("ActivityTimeline (Option A slice)", () => {
  it("renders participant.status_changed with actor and summary", () => {
    render(<ActivityTimeline events={[statusChangedEvent]} />);

    expect(screen.getByText("Test Coach (Team)")).toBeInTheDocument();
    expect(
      screen.getByText('Status von „Onboarding" auf „Active" geändert'),
    ).toBeInTheDocument();
  });

  it("renders empty state when no events", () => {
    render(<ActivityTimeline events={[]} />);
    expect(screen.getByText("Keine Aktivitäten vorhanden")).toBeInTheDocument();
  });
});

/**
 * Regression aus dem Testen in der Sandbox: nach dem Wiederherstellen eines
 * geloeschten Lernpfad-Eintrags stand in der Timeline ein zweites
 * "LearningPathItem erstellt" direkt unter dem urspruenglichen. Beide Zeilen
 * sahen gleich aus und unterschieden sich nur im Datum — der Coach konnte nicht
 * sagen, welche davon die Wiederherstellung ist.
 *
 * Der Text entsteht aus `subjectType + action`, deshalb genuegt es, `action` zu
 * pruefen: `restored` traegt in der Timeline "wiederhergestellt", `created`
 * dagegen "erstellt".
 */
describe("ActivityTimeline Wiederherstellung", () => {
  const restoredEvent = {
    ...statusChangedEvent,
    id: "a0AA000000000009AAA",
    eventType: "learning_path.item_restored",
    domain: "learning_path",
    action: "restored",
    subjectType: "Learning_Path__c",
    subjectId: "a0LP000000000009AAA",
    changes: [],
    changedFields: [],
    reason: "Aus Audit-Ereignis a0AA000000000002AAA wiederhergestellt",
  } as AuditEvent;

  const createdEvent = {
    ...statusChangedEvent,
    id: "a0AA000000000002AAA",
    eventType: "learning_path.item_created",
    domain: "learning_path",
    action: "created",
    subjectType: "Learning_Path__c",
    subjectId: "a0LP000000000002AAA",
    changes: [],
    changedFields: [],
  } as AuditEvent;

  it("unterscheidet die Wiederherstellung vom urspruenglichen Anlegen", () => {
    // Getrennt gerendert: beide Ereignisse fallen sonst in dieselbe
    // Zeitgruppe und die Zusammenfassung lautet nur noch "2 Änderungen".
    const { unmount } = render(<ActivityTimeline events={[restoredEvent]} />);
    expect(screen.getByText("Learning_Path wiederhergestellt")).toBeInTheDocument();
    expect(screen.getByText("Lernpfad – wiederhergestellt")).toBeInTheDocument();
    unmount();

    render(<ActivityTimeline events={[createdEvent]} />);
    expect(screen.getByText("Learning_Path erstellt")).toBeInTheDocument();
    expect(screen.getByText("Lernpfad – erstellt")).toBeInTheDocument();
  });

  it("nennt die Herkunft der Wiederherstellung", async () => {
    const user = userEvent.setup();
    render(<ActivityTimeline events={[restoredEvent]} />);

    // Die Begruendung steht erst im aufgeklappten Bereich.
    await user.click(screen.getByRole("button", { name: "Details ausklappen" }));

    expect(
      await screen.findByText(
        "Begründung: Aus Audit-Ereignis a0AA000000000002AAA wiederhergestellt",
        { exact: false },
      ),
    ).toBeInTheDocument();
  });
});

describe("ActivityTimeline deep link (?event=)", () => {
  it("auto-opens the linked event details and highlights its group", async () => {
    render(
      <ActivityTimeline
        events={[statusChangedEvent]}
        highlightEventId={statusChangedEvent.id}
      />,
    );

    // Details drawer opens automatically with the event id visible.
    expect(await screen.findByText(statusChangedEvent.id)).toBeInTheDocument();
    // The containing group carries the highlight ring + scroll anchor.
    const anchor = document.querySelector(
      `[data-correlation-id="${statusChangedEvent.correlationId}"]`,
    );
    expect(anchor?.className).toContain("ring-2");
  });

  it("shows a notice when the linked event is not in the result set", () => {
    render(
      <ActivityTimeline events={[statusChangedEvent]} highlightEventId="missing-id" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Das verlinkte Ereignis wurde nicht gefunden",
    );
    // …but the timeline itself still renders.
    expect(
      screen.getByText('Status von „Onboarding" auf „Active" geändert'),
    ).toBeInTheDocument();
  });
});
