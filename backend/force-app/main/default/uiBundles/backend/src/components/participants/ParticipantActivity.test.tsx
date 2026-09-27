import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantActivity } from "./ParticipantActivity";
import { getParticipantActivity } from "@/api/audit/auditApiService";
import type { AuditEvent } from "@/types/audit";

vi.mock("@/api/audit/auditApiService", () => ({
  getParticipantActivity: vi.fn(),
}));

const mockedActivity = vi.mocked(getParticipantActivity);

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
  subjectId: "p-1",
  participantId: "p-1",
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

describe("ParticipantActivity", () => {
  it("renders timeline events for the participant", async () => {
    mockedActivity.mockResolvedValueOnce({
      events: [statusChangedEvent],
      hasNextPage: false,
      nextCursor: undefined,
    });

    render(<ParticipantActivity participantId="p-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Coach (Team)")).toBeInTheDocument();
    });
    expect(mockedActivity).toHaveBeenCalledWith("p-1", 50);
    expect(screen.getByText("Aktivitäten")).toBeInTheDocument();
  });

  it("renders empty state when no events exist", async () => {
    mockedActivity.mockResolvedValueOnce({ events: [], hasNextPage: false });

    render(<ParticipantActivity participantId="p-1" />);

    await waitFor(() => {
      expect(screen.getByText("Keine Aktivitäten vorhanden")).toBeInTheDocument();
    });
  });

  it("renders error state when loading fails", async () => {
    mockedActivity.mockRejectedValueOnce(new Error("boom"));

    render(<ParticipantActivity participantId="p-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Fehler beim Laden der Aktivitätshistorie/)).toBeInTheDocument();
    });
  });

  it("filters events by search query and resets", async () => {
    const user = userEvent.setup();
    const appointmentEvent: AuditEvent = {
      ...statusChangedEvent,
      id: "a0AA000000000002AAA",
      eventType: "appointment.created",
      domain: "appointment",
      action: "created",
      occurredAt: "2026-09-20T09:00:00.000Z",
      actorDisplayNameSnapshot: "Other Coach",
      reason: "Routine check-in",
    };
    mockedActivity.mockResolvedValueOnce({
      events: [statusChangedEvent, appointmentEvent],
      hasNextPage: false,
      nextCursor: undefined,
    });

    render(<ParticipantActivity participantId="p-1" />);
    await screen.findByText("Test Coach (Team)");

    await user.type(
      screen.getByRole("textbox", { name: "Verlauf durchsuchen" }),
      "routine",
    );

    await waitFor(() => {
      expect(screen.getByText(/1 von 2 Einträgen/)).toBeInTheDocument();
    });
    expect(screen.queryByText("Test Coach (Team)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /zurücksetzen/i }));

    await waitFor(() => {
      expect(screen.getByText("Test Coach (Team)")).toBeInTheDocument();
    });
    expect(screen.queryByText(/von 2 Einträgen/)).not.toBeInTheDocument();
  });
});
