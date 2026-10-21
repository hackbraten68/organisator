/**
 * Der allgemeine Bearbeitungspfad fuer einen Termin (Apex `AppointmentEditService`).
 *
 * WARUM EIN APEX-ENDPOINT UND NICHT DIE UI-API
 *   Der Pfad lief bis 2026-10-21 ueber die Standard-UI-API
 *   (`uiapi { Appointment__cUpdate }`). Serverseitig geprueft wurde dort nur,
 *   was die Org an Feld- und Objektrechten durchsetzt — nicht aber der
 *   fachliche Zustand des Datensatzes. Entscheidung D1: ein Termin darf ueber
 *   den allgemeinen Bearbeitungspfad nur geaendert werden, wenn sein
 *   **aktueller serverseitiger** Status `Draft` ist. Der vom Client
 *   mitgesendete Status entscheidet nicht.
 *
 *   Diese Pruefung liegt jetzt im Einstiegspunkt. Dieses Modul ist nur der
 *   Transport — und es entscheidet nicht, ob ueberhaupt etwas geaendert werden
 *   darf. Das kann der Client nicht: eine Berechtigung laesst sich nur dort
 *   feststellen, wo der Aufruf ausgefuehrt wird. Der Server antwortet mit 409
 *   (nicht bearbeitbar) und 404 (nicht vorhanden); dieses Modul macht daraus
 *   einen typisierten Fehler.
 *
 * WAS DIESES MODUL NICHT SCHICKT
 *   Kein `status`, kein `participantId`, kein `cancellationReason`, kein
 *   `correlationId`. Die Felder, die der Einstiegspunkt nicht kennt, kann der
 *   Client auch nicht setzen — der Server liest seinen Request in eine
 *   Whitelist-Form hinein und schreibt genau die Felder, die sich geaendert
 *   haben.
 *
 * AUDIT
 *   Das Audit-Event schreibt der Server, in derselben Transaktion wie die
 *   Aenderung. Der Client schreibt nichts: ein zweites Event waere ein
 *   Duplikat fuer dieselbe Handlung.
 *
 * TRANSPORT
 *   `sdk.fetch`, nicht ein blanker `fetch`: der Data SDK setzt
 *   `SFDC_ENV.apiPath` davor und haengt das CSRF-Token an. Ein relativer
 *   Pfad ist hier richtig — ein absoluter Pfad beantwortet die Anfrage mit der
 *   SPA-Shell und HTTP 200.
 */

import { createDataSDK } from "@salesforce/platform-sdk";
import type { AppointmentLocation, AppointmentType } from "@/types/appointment";

/** Pfad, wie der SDK ihn braucht: `sdk.fetch` setzt `SFDC_ENV.apiPath` selbst. */
const EDIT_PATH = "/services/apexrest/appointment-edit";

/**
 * Die Felder, die der Bearbeitungspfad aendern darf.
 *
 * `location` darf auch die leere Zeichenkette sein: serverseitig bedeutet
 * `""` "leeren", `undefined` "nicht mitschicken". Der Unterschied ist der
 * ganze Unterschied zwischen einem Feld loeschen und einem Feld unberuehrt
 * lassen.
 */
export interface AppointmentEditInput {
  coachId?: string;
  type?: AppointmentType;
  startTime?: string;
  endTime?: string;
  location?: AppointmentLocation | "";
  meetingLink?: string;
  notes?: string;
}

/** Der Zustand nach der Aenderung, soweit der Server ihn zurueckgibt. */
export interface AppointmentEditResult {
  id: string;
  /** `TERM-{0000}` — der Name ist ein AutoNumber-Feld. */
  name: string;
  status: string;
}

/**
 * Die Fehler des Bearbeitungspfads.
 *
 * `code` ist der Code des Servers (`APPOINTMENT_NOT_EDITABLE`,
 * `INVALID_INTERVAL`, ...). `status` ist der HTTP-Status. Beide sind fuer den
 * Anwender unsichtbar: die Meldung ist bereits auf Deutsch und sagt, was
 * nicht stimmt.
 */
export class AppointmentEditError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AppointmentEditError";
    this.code = code;
    this.status = status;
  }

  /** Der Termin ist in einem Zustand, in dem er nicht bearbeitet werden darf. */
  get isNotEditable(): boolean {
    return this.code === "APPOINTMENT_NOT_EDITABLE";
  }
}

/** Was der Server zurueckgibt: bei Erfolg der Datensatz, bei Fehler Code und Meldung. */
interface EditResponseBody {
  id?: string | null;
  name?: string | null;
  status?: string | null;
  code?: string | null;
  message?: string | null;
}

/**
 * Bearbeitet einen Termin ueber den serverseitigen Einstiegspunkt.
 *
 * Wirft `AppointmentEditError`, wenn der Server die Aenderung ablehnt — die
 * Meldung des Servers wird durchgereicht, weil sie den konkreten Grund nennt
 * ("Ein Termin kann nur im Status Draft bearbeitet werden") und nichts ueber
 * Felder oder Ids preisgibt.
 */
export async function editAppointment(
  id: string,
  patch: AppointmentEditInput
): Promise<AppointmentEditResult> {
  const sdk = await createDataSDK();
  if (!sdk.fetch) {
    throw new AppointmentEditError(
      "UNAVAILABLE",
      "Der Termin konnte nicht bearbeitet werden: die Serververbindung steht nicht zur Verfuegung.",
      0
    );
  }

  const body: Record<string, unknown> = { id };
  if (patch.coachId !== undefined) body.coachId = patch.coachId;
  if (patch.type !== undefined) body.type = patch.type;
  if (patch.startTime !== undefined) body.startTime = patch.startTime;
  if (patch.endTime !== undefined) body.endTime = patch.endTime;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.meetingLink !== undefined) body.meetingLink = patch.meetingLink;
  if (patch.notes !== undefined) body.notes = patch.notes;

  let response: Response;
  try {
    response = await sdk.fetch(EDIT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Failed to reach the appointment edit endpoint", err);
    throw new AppointmentEditError(
      "UNAVAILABLE",
      "Der Termin konnte nicht bearbeitet werden: die Verbindung zum Server ist fehlgeschlagen.",
      0
    );
  }

  const payload = await readBody(response);

  if (!response.ok) {
    throw new AppointmentEditError(
      payload?.code || codeForStatus(response.status),
      payload?.message || messageForStatus(response.status),
      response.status
    );
  }

  return {
    id: payload?.id || id,
    name: payload?.name || "",
    status: payload?.status || "",
  };
}

/**
 * Liest den Antwortkoerper als JSON — und gibt `null` zurueck, wenn es keiner ist.
 *
 * Ein 403 der Plattform antwortet mit HTML, kein JSON. `response.json()` wirft
 * dann; dieser Fehler darf den Fehler des Servers nicht ersetzen, denn die
 * Meldung des Servers sagt mehr als der HTTP-Status.
 */
async function readBody(response: Response): Promise<EditResponseBody | null> {
  try {
    const parsed = await response.json();
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as EditResponseBody;
  } catch {
    return null;
  }
}

/** Der Code, wenn der Server keinen nennt. */
function codeForStatus(status: number): string {
  if (status === 403) return "NO_ACCESS";
  if (status === 404) return "APPOINTMENT_NOT_FOUND";
  if (status === 409) return "APPOINTMENT_NOT_EDITABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  return "BAD_REQUEST";
}

/** Die Meldung, wenn der Server keine nennt. */
function messageForStatus(status: number): string {
  if (status === 403) {
    return "Fuer diese Aenderung fehlt die Berechtigung.";
  }
  if (status === 404) {
    return "Der Termin existiert nicht.";
  }
  if (status === 409) {
    return "Der Termin kann in seinem aktuellen Status nicht bearbeitet werden.";
  }
  if (status >= 500) {
    return "Der Termin konnte nicht bearbeitet werden.";
  }
  return "Die Aenderung war unvollstaendig.";
}
