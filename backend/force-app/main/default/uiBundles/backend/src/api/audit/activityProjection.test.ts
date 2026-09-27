import { describe, expect, it } from "vitest";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_PROJECTION_RULES,
  UNKNOWN_EVENT_PROJECTION,
  filterDefaultParticipantView,
  filterForAudience,
  projectEvent,
} from "./activityProjection";
import { EVENT_TYPES, type AuditEvent } from "@/types/audit";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "a0AA000000000001AAA",
    recordedAt: "2026-09-25T10:00:01.000Z",
    occurredAt: "2026-09-25T10:00:00.000Z",
    schemaVersion: 1,
    eventType: "participant.status_changed",
    domain: "participant",
    action: "status_changed",
    actorType: "staff",
    subjectType: "Participant__c",
    subjectId: "p-1",
    participantId: "p-1",
    source: "web",
    changedFields: [],
    changes: [],
    metadata: {},
    visibility: "staff",
    sensitivity: "normal",
    ...overrides,
  };
}

describe("activityProjection", () => {
  it("classifies every known event type (satisfies is enforced at build)", () => {
    const known = Object.values(EVENT_TYPES);
    expect(known.length).toBeGreaterThan(30);
    for (const eventType of known) {
      const rule =
        ACTIVITY_PROJECTION_RULES[eventType as keyof typeof ACTIVITY_PROJECTION_RULES];
      expect(rule, eventType).toBeDefined();
      expect(ACTIVITY_CATEGORIES).toContain(rule.category);
      expect(typeof rule.includeInActivity).toBe("boolean");
      expect(typeof rule.technical).toBe("boolean");
    }
  });

  it("denies unknown event types in every audience timeline", () => {
    const unknown = makeEvent({ eventType: "future_domain.something_new" });
    expect(projectEvent(unknown)).toEqual(UNKNOWN_EVENT_PROJECTION);
    expect(UNKNOWN_EVENT_PROJECTION.includeInActivity).toBe(false);
    expect(UNKNOWN_EVENT_PROJECTION.audiences).toEqual([]);
    for (const audience of ["coach", "staff", "supervisor", "auditor", "participant"] as const) {
      expect(filterForAudience([unknown], audience, { includeTechnicalEvents: true })).toEqual([]);
    }
  });

  it("never renders audit meta events in timelines", () => {
    for (const eventType of ["audit.viewed", "audit.exported"]) {
      const event = makeEvent({ eventType, domain: "system", action: "created" });
      for (const audience of ["coach", "staff", "supervisor", "auditor", "participant"] as const) {
        expect(
          filterForAudience([event], audience, { includeTechnicalEvents: true }),
          `${eventType}/${audience}`,
        ).toEqual([]);
      }
    }
  });

  it("uses a separate absence category, not attendance", () => {
    expect(projectEvent(makeEvent({ eventType: "absence.reported" })).category).toBe("absence");
    expect(projectEvent(makeEvent({ eventType: "daily_checkin.submitted" })).category).toBe(
      "attendance",
    );
  });

  it("coach default sees journey/appointments/learning, not technical noise", () => {
    const events = [
      makeEvent({ eventType: "participant.status_changed" }),
      makeEvent({ eventType: "appointment.created", domain: "appointment", action: "created" }),
      makeEvent({ eventType: "workbook.submitted", domain: "workbook", action: "submitted" }),
      makeEvent({ eventType: "time_entry.corrected", domain: "time_tracking", action: "corrected" }),
      makeEvent({ eventType: "system.created", domain: "system", action: "created" }),
    ];
    const visible = filterDefaultParticipantView(events).map((e) => e.eventType);
    expect(visible).toEqual([
      "participant.status_changed",
      "appointment.created",
      "workbook.submitted",
    ]);
  });

  it("technical events require the flag and stay audience-gated", () => {
    const started = makeEvent({
      eventType: "time_entry.started",
      domain: "time_tracking",
      action: "created",
    });
    // staff with flag sees it …
    expect(
      filterForAudience([started], "staff", { includeTechnicalEvents: true }),
    ).toHaveLength(1);
    // … coach never does, even with the flag
    expect(
      filterForAudience([started], "coach", { includeTechnicalEvents: true }),
    ).toEqual([]);
    // … and staff does not see it by default either
    expect(filterForAudience([started], "staff")).toEqual([]);
  });

  it("participant audience only sees participant-classified events", () => {
    const status = makeEvent({ eventType: "participant.status_changed" });
    const updated = makeEvent({ eventType: "participant.updated", action: "updated" });
    const visible = filterForAudience([status, updated], "participant").map((e) => e.eventType);
    expect(visible).toEqual(["participant.status_changed"]);
  });

  it("filters by category within the authorized set", () => {
    const events = [
      makeEvent({ eventType: "participant.status_changed" }),
      makeEvent({ eventType: "absence.reported", domain: "absence", action: "reported" }),
    ];
    const visible = filterForAudience(events, "coach", { categories: ["absence"] });
    expect(visible.map((e) => e.eventType)).toEqual(["absence.reported"]);
  });
});
