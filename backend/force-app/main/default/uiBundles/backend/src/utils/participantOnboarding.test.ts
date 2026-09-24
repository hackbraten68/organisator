import { describe, expect, it } from "vitest";
import type { Participant } from "@/types/participant";
import {
  getCompletion,
  getMissingFields,
  getOnboardingCounts,
  getStatusCounts,
  needsAttention,
} from "./participantOnboarding";

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: "a059b00000gdNKkAAM",
    name: "Max Mustermann",
    status: "Onboarding",
    email: "max@example.com",
    ...overrides,
  };
}

describe("getMissingFields", () => {
  it("reports all four fields for a fresh intake record", () => {
    expect(getMissingFields(makeParticipant())).toEqual([
      "program",
      "coach",
      "discord",
      "github",
    ]);
  });

  it("treats empty and whitespace-only values as missing", () => {
    const p = makeParticipant({
      programId: "a049b000009jVgnAAE",
      coachId: " ",
      discord: "",
      github: "  ",
    });
    expect(getMissingFields(p)).toEqual(["coach", "discord", "github"]);
  });

  it("reports nothing for a fully onboarded participant", () => {
    const p = makeParticipant({
      programId: "a049b000009jVgnAAE",
      coachId: "0059b00000XXXXXXX",
      discord: "max.m",
      github: "maxm",
    });
    expect(getMissingFields(p)).toEqual([]);
  });
});

describe("getCompletion", () => {
  it("is needs-setup at 0%", () => {
    expect(getCompletion(makeParticipant())).toEqual({
      percent: 0,
      state: "needs-setup",
    });
  });

  it("is incomplete at 50%", () => {
    const p = makeParticipant({
      programId: "a049b000009jVgnAAE",
      github: "maxm",
    });
    expect(getCompletion(p)).toEqual({ percent: 50, state: "incomplete" });
  });

  it("is ready at 100%", () => {
    const p = makeParticipant({
      programId: "a049b000009jVgnAAE",
      coachId: "0059b00000XXXXXXX",
      discord: "max.m",
      github: "maxm",
    });
    expect(getCompletion(p)).toEqual({ percent: 100, state: "ready" });
  });
});

describe("needsAttention", () => {
  it("is true until all four fields are present", () => {
    expect(needsAttention(makeParticipant())).toBe(true);
    expect(
      needsAttention(
        makeParticipant({
          programId: "a049b000009jVgnAAE",
          coachId: "0059b00000XXXXXXX",
          discord: "max.m",
        }),
      ),
    ).toBe(true);
    expect(
      needsAttention(
        makeParticipant({
          programId: "a049b000009jVgnAAE",
          coachId: "0059b00000XXXXXXX",
          discord: "max.m",
          github: "maxm",
        }),
      ),
    ).toBe(false);
  });
});

describe("getOnboardingCounts", () => {
  it("derives needsAttention, active and total", () => {
    const list = [
      makeParticipant(),
      makeParticipant({ id: "2", status: "Active" }),
      makeParticipant({
        id: "3",
        status: "Active",
        programId: "a049b000009jVgnAAE",
        coachId: "0059b00000XXXXXXX",
        discord: "lisa.m",
        github: "lisam",
      }),
    ];
    expect(getOnboardingCounts(list)).toEqual({
      needsAttention: 2,
      active: 2,
      total: 3,
    });
  });
});

describe("getStatusCounts", () => {
  it("derives a total count and per-status breakdown", () => {
    const list = [
      makeParticipant({ id: "1", status: "Onboarding" }),
      makeParticipant({ id: "2", status: "Active" }),
      makeParticipant({ id: "3", status: "Active" }),
      makeParticipant({ id: "4", status: "Paused" }),
      makeParticipant({ id: "5", status: "Dropped" }),
    ];

    expect(getStatusCounts(list)).toEqual({
      Onboarding: 1,
      Active: 2,
      Paused: 1,
      Graduated: 0,
      Placed: 0,
      Dropped: 1,
      total: 5,
    });
  });
});
