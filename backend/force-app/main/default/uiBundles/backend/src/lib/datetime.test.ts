import { describe, it, expect } from "vitest";
import { toApiDateTime, toDateTimeLocalValue } from "./datetime";

describe("toApiDateTime", () => {
  it("rechnet eine Wanduhrzeit ohne Offset in UTC um", () => {
    // 10:00 Ortszeit entspricht 08:00Z in MEZ (+01:00, Winterzeit).
    const result = toApiDateTime("2026-09-30T10:00");
    expect(result).toBe("2026-09-30T08:00:00.000Z");
  });

  it("interpretiert den Wert als lokale Zeit, nicht als UTC", () => {
    const result = toApiDateTime("2026-09-30T10:00");
    const local = new Date(result);
    expect(local.getHours()).toBe(10);
    expect(local.getMinutes()).toBe(0);
  });

  it("laesst eine ISO-Zeit mit Z unveraendert", () => {
    expect(toApiDateTime("2026-09-30T08:00:00.000Z")).toBe("2026-09-30T08:00:00.000Z");
  });

  it("laesst eine ISO-Zeit mit numerischem Offset unveraendert", () => {
    expect(toApiDateTime("2026-09-30T10:00:00+02:00")).toBe("2026-09-30T10:00:00+02:00");
  });

  it("liefert ein fuer DateTime akzeptierbares Ergebnis (immer mit Offset)", () => {
    const result = toApiDateTime("2026-07-01T14:30");
    expect(result).toMatch(/Z$|[+-]\d{2}:\d{2}$/);
    expect(new Date(result).toISOString()).toBe(result);
  });

  it("lehnt unsinnige Werte ab, statt sie still zu akzeptieren", () => {
    expect(() => toApiDateTime("kein datum")).toThrow(/Ungültiger Datum\/Zeit-Wert/);
  });

  it("gibt leere Eingaben unveraendert zurueck", () => {
    expect(toApiDateTime("")).toBe("");
    expect(toApiDateTime("   ")).toBe("");
  });
});

describe("toDateTimeLocalValue", () => {
  it("zeigt eine ISO-Zeit als lokale Wanduhrzeit im Input-Format", () => {
    const iso = new Date(2026, 8, 30, 10, 0).toISOString();
    expect(toDateTimeLocalValue(iso)).toBe("2026-09-30T10:00");
  });

  it("formatiert auf Minuten genau ohne Sekunden", () => {
    const iso = new Date(2026, 8, 30, 10, 5, 42).toISOString();
    expect(toDateTimeLocalValue(iso)).toBe("2026-09-30T10:05");
  });

  it("liefert bei leerer oder unparsbarer Eingabe einen leeren String", () => {
    expect(toDateTimeLocalValue("")).toBe("");
    expect(toDateTimeLocalValue("kein datum")).toBe("");
  });
});
