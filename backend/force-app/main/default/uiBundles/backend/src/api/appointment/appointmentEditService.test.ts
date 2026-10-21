import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentEditError, editAppointment } from "./appointmentEditService";

const { mockCreateDataSDK } = vi.hoisted(() => ({ mockCreateDataSDK: vi.fn() }));
vi.mock("@salesforce/platform-sdk", () => ({
  createDataSDK: mockCreateDataSDK,
}));

interface FetchArgs {
  url: string;
  init?: RequestInit;
}

/** Protokolliert den Aufruf und antwortet mit `response`. */
function givenResponse(response: unknown, status = 200): FetchArgs[] {
  const calls: FetchArgs[] = [];
  mockCreateDataSDK.mockResolvedValue({
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => response,
      };
    }),
  });
  return calls;
}

/** Antwortet mit einem Body, der kein JSON ist (403 der Plattform). */
function givenNonJsonResponse(status: number): FetchArgs[] {
  const calls: FetchArgs[] = [];
  mockCreateDataSDK.mockResolvedValue({
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          throw new Error("not json");
        },
      };
    }),
  });
  return calls;
}

describe("appointmentEditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ruft den Apex-Einstiegspunkt mit POST auf", async () => {
    const calls = givenResponse({ id: "a01", name: "TERM-0007", status: "Draft" });

    await editAppointment("a01", { type: "Feedback" });

    // Relativ auf purpose: sdk.fetch setzt SFDC_ENV.apiPath davor.
    expect(calls[0].url).toBe("/services/apexrest/appointment-edit");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("schickt genau die Felder, die der Einstiegspunkt kennt", async () => {
    const calls = givenResponse({ id: "a01", name: "TERM-0007", status: "Draft" });

    await editAppointment("a01", {
      coachId: "0059b00000gUfkFAAS",
      type: "Feedback",
      startTime: "2026-10-22T09:00:00.000Z",
      endTime: "2026-10-22T10:00:00.000Z",
      location: "Zoom",
      meetingLink: "https://teams.microsoft.com/l/meetup-join/x",
      notes: "Erstes Mal",
    });

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toEqual({
      id: "a01",
      coachId: "0059b00000gUfkFAAS",
      type: "Feedback",
      startTime: "2026-10-22T09:00:00.000Z",
      endTime: "2026-10-22T10:00:00.000Z",
      location: "Zoom",
      meetingLink: "https://teams.microsoft.com/l/meetup-join/x",
      notes: "Erstes Mal",
    });
  });

  it("schickt Felder, die nicht mitgeschickt wurden, gar nicht", async () => {
    const calls = givenResponse({ id: "a01", name: "TERM-0007", status: "Draft" });

    await editAppointment("a01", { notes: "Nur die Notiz" });

    // "Nicht mitschicken" und "leeren" sind zwei verschiedene Sachen. Der
    // Server behandelt "" als Loeschung und ein fehlendes Feld als
    // "unberuehrt" — deshalb darf hier kein undefined entstehen.
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toEqual({ id: "a01", notes: "Nur die Notiz" });
    expect(Object.keys(body)).not.toContain("location");
    expect(Object.keys(body)).not.toContain("coachId");
  });

  it("schickt eine leere Zeichenkette, wenn ein Feld geleert werden soll", async () => {
    const calls = givenResponse({ id: "a01", name: "TERM-0007", status: "Draft" });

    await editAppointment("a01", { notes: "", meetingLink: "" });

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.notes).toBe("");
    expect(body.meetingLink).toBe("");
  });

  it("liefert den Zustand nach der Aenderung", async () => {
    givenResponse({ id: "a01", name: "TERM-0007", status: "Draft" });

    await expect(editAppointment("a01", { type: "Feedback" })).resolves.toEqual({
      id: "a01",
      name: "TERM-0007",
      status: "Draft",
    });
  });

  it("meldet einen Termin, der nicht bearbeitet werden darf", async () => {
    givenResponse(
      {
        code: "APPOINTMENT_NOT_EDITABLE",
        message:
          "Ein Termin kann nur im Status Draft bearbeitet werden. Aktueller Status: Confirmed.",
      },
      409
    );

    const error = await editAppointment("a01", { type: "Feedback" }).catch((err) => err);

    expect(error).toBeInstanceOf(AppointmentEditError);
    expect(error.code).toBe("APPOINTMENT_NOT_EDITABLE");
    expect(error.status).toBe(409);
    expect(error.isNotEditable).toBe(true);
    // Die Meldung des Servers wird durchgereicht: sie nennt den konkreten
    // Grund, und sie verrat weder Feldnamen noch Ids.
    expect(error.message).toContain("Status Draft");
  });

  it("meldet einen unbekannten Termin", async () => {
    givenResponse({ code: "APPOINTMENT_NOT_FOUND", message: "Der Termin existiert nicht." }, 404);

    const error = await editAppointment("a01", { type: "Feedback" }).catch((err) => err);

    expect(error).toBeInstanceOf(AppointmentEditError);
    expect(error.code).toBe("APPOINTMENT_NOT_FOUND");
    expect(error.status).toBe(404);
  });

  it("meldet ein ungueltiges Intervall", async () => {
    givenResponse(
      { code: "INVALID_INTERVAL", message: "Die Startzeit muss vor der Endzeit liegen." },
      400
    );

    const error = await editAppointment("a01", {
      startTime: "2026-10-22T11:00:00.000Z",
      endTime: "2026-10-22T10:00:00.000Z",
    }).catch((err) => err);

    expect(error.code).toBe("INVALID_INTERVAL");
    expect(error.status).toBe(400);
    expect(error.isNotEditable).toBe(false);
  });

  it("meldet fehlende Berechtigung, auch wenn die Plattform kein JSON liefert", async () => {
    // 403 kommt als HTML. Der HTTP-Status muss trotzdem greifen.
    givenNonJsonResponse(403);

    const error = await editAppointment("a01", { type: "Feedback" }).catch((err) => err);

    expect(error).toBeInstanceOf(AppointmentEditError);
    expect(error.code).toBe("NO_ACCESS");
    expect(error.status).toBe(403);
  });

  it("meldet einen Serverfehler, ohne die rohe Meldung weiterzugeben", async () => {
    givenResponse({ code: "INTERNAL_ERROR", message: "Der Termin konnte nicht bearbeitet werden." }, 500);

    const error = await editAppointment("a01", { type: "Feedback" }).catch((err) => err);

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.status).toBe(500);
  });

  it("meldet einen Ausfall der Verbindung", async () => {
    mockCreateDataSDK.mockResolvedValue({
      fetch: vi.fn(async () => {
        throw new Error("network down");
      }),
    });

    const error = await editAppointment("a01", { type: "Feedback" }).catch((err) => err);

    expect(error).toBeInstanceOf(AppointmentEditError);
    expect(error.code).toBe("UNAVAILABLE");
    expect(error.status).toBe(0);
  });

  it("meldet es, wenn die SDK-Oberflaeche kein fetch hat", async () => {
    mockCreateDataSDK.mockResolvedValue({});

    const error = await editAppointment("a01", { type: "Feedback" }).catch((err) => err);

    expect(error).toBeInstanceOf(AppointmentEditError);
    expect(error.code).toBe("UNAVAILABLE");
  });
});
