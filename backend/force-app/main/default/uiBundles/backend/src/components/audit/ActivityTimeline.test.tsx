import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
