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

  it("toggles categories with OR semantics and resets all filters", async () => {
    const user = userEvent.setup();
    const appointmentEvent: AuditEvent = {
      ...statusChangedEvent,
      id: "a0AA000000000002AAA",
      eventType: "appointment.created",
      domain: "appointment",
      action: "created",
      actorDisplayNameSnapshot: "Other Coach",
      correlationId: "corr-2",
    };
    const absenceEvent: AuditEvent = {
      ...statusChangedEvent,
      id: "a0AA000000000003AAA",
      eventType: "absence.reported",
      domain: "absence",
      action: "reported",
      actorDisplayNameSnapshot: "Third Coach",
      correlationId: "corr-3",
    };
    mockedActivity.mockResolvedValueOnce({
      events: [statusChangedEvent, appointmentEvent, absenceEvent],
      hasNextPage: false,
      nextCursor: undefined,
    });

    render(<ParticipantActivity participantId="p-1" />);
    await screen.findByText("Test Coach (Team)");

    // No selection = all events.
    expect(screen.getByText("Other Coach (Team)")).toBeInTheDocument();
    expect(screen.getByText("Third Coach (Team)")).toBeInTheDocument();

    // Single category filters down to that category.
    await user.click(screen.getByRole("button", { name: "Termine" }));
    expect(screen.queryByText("Test Coach (Team)")).not.toBeInTheDocument();
    expect(screen.getByText("Other Coach (Team)")).toBeInTheDocument();
    expect(screen.getByText(/1 Filter aktiv/)).toBeInTheDocument();

    // Second category adds via OR instead of narrowing further.
    await user.click(screen.getByRole("button", { name: "Abwesenheit" }));
    expect(screen.getByText("Other Coach (Team)")).toBeInTheDocument();
    expect(screen.getByText("Third Coach (Team)")).toBeInTheDocument();
    expect(screen.getByText(/2 Filter aktiv/)).toBeInTheDocument();

    // Re-click removes a single category again.
    await user.click(screen.getByRole("button", { name: "Termine" }));
    expect(screen.queryByText("Other Coach (Team)")).not.toBeInTheDocument();
    expect(screen.getByText("Third Coach (Team)")).toBeInTheDocument();

    // Reset clears the whole selection.
    await user.click(screen.getByRole("button", { name: /zurücksetzen/i }));
    expect(screen.getByText("Test Coach (Team)")).toBeInTheDocument();
    expect(screen.getByText("Other Coach (Team)")).toBeInTheDocument();
    expect(screen.getByText("Third Coach (Team)")).toBeInTheDocument();
    expect(screen.queryByText(/Filter aktiv/)).not.toBeInTheDocument();
  });

  it("documents unknown-category behavior as empty result", async () => {
    const { filterForAudience } = await import("@/api/audit/activityProjection");
    expect(
      filterForAudience(
        [statusChangedEvent],
        "coach",
        // @ts-expect-error deliberate: unknown categories must not leak events
        { categories: ["not_a_category"] },
      ),
    ).toEqual([]);
  });

  it("hides pills for categories that can never show content", async () => {
    mockedActivity.mockResolvedValueOnce({
      events: [statusChangedEvent],
      hasNextPage: false,
      nextCursor: undefined,
    });

    render(<ParticipantActivity participantId="p-1" />);
    await screen.findByText("Test Coach (Team)");

    // Deliberate, not a bug: audit is empty by design (self-reading log
    // must not append to itself), security has no writer yet
    // (TODO(login-tracking)). All content-bearing categories stay.
    expect(screen.queryByRole("button", { name: "Audit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sicherheit" })).not.toBeInTheDocument();
    for (const label of ["Verlauf", "Termine", "Anwesenheit", "Abwesenheit", "Lernen", "Verwaltung"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
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
