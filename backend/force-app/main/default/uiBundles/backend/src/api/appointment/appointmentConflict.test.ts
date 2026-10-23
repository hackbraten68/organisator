import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_INVALID_INTERVAL,
  APPOINTMENT_TIME_CONFLICT,
  AppointmentConflictError,
  translateAppointmentWriteError,
} from "./appointmentConflict";

/**
 * Der Kollisionsschutz sitzt in der Datenbank und erreicht die Oberflaeche
 * ueber zwei Wege: der benannte Apex-Einstiegspunkt antwortet mit 409 und
 * einem Code im Rumpf, die UI-API reicht die Apex-Meldung unveraendert durch.
 * Beide muessen am UI gleich ankommen.
 */
describe("Übersetzung der Schreibfehler", () => {
  it("erkennt einen Zeitkonflikt in der GraphQL-Meldung", () => {
    const translated = translateAppointmentWriteError(
      new Error(
        "GraphQL Error: APPOINTMENT_TIME_CONFLICT: Der Zeitraum ist beim Coach bereits belegt."
      )
    );

    expect(translated).toBeInstanceOf(AppointmentConflictError);
    const conflict = translated as AppointmentConflictError;
    expect(conflict.code).toBe(APPOINTMENT_TIME_CONFLICT);
    expect(conflict.status).toBe(409);
    expect(conflict.message).toBe("Der Zeitraum ist beim Coach bereits belegt.");
    expect(conflict.isTimeConflict).toBe(true);
  });

  it("erkennt ein ungültiges Intervall", () => {
    const translated = translateAppointmentWriteError(
      new Error("GraphQL Error: INVALID_INTERVAL: Die Startzeit muss vor der Endzeit liegen.")
    );

    expect(translated).toBeInstanceOf(AppointmentConflictError);
    const conflict = translated as AppointmentConflictError;
    expect(conflict.code).toBe(APPOINTMENT_INVALID_INTERVAL);
    expect(conflict.status).toBe(400);
    expect(conflict.isTimeConflict).toBe(false);
  });

  it("lässt einen anderen Fehler unverändert", () => {
    const original = new Error("Netzwerkfehler");

    expect(translateAppointmentWriteError(original)).toBe(original);
  });

  it("lässt einen Fehler ohne erkennbaren Code unverändert", () => {
    const original = new Error("");

    expect(translateAppointmentWriteError(original)).toBe(original);
  });

  it("verträgt einen Fehler, der kein Error-Objekt ist", () => {
    const translated = translateAppointmentWriteError(
      "APPOINTMENT_TIME_CONFLICT: Der Zeitraum ist beim Coach bereits belegt."
    );

    expect(translated).toBeInstanceOf(AppointmentConflictError);
  });
});
