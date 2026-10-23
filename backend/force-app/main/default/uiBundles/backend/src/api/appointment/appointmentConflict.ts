/**
 * The time-conflict contract of the appointment write paths (ADR-016).
 *
 * The guard sits on `Appointment__c` in the database, so it sees every write
 * path — the UI API and the named Apex entry point alike. The rejection
 * reaches the UI in two different shapes: the Apex entry point answers 409
 * with a code in the body, the UI API hands the Apex message through the
 * GraphQL error path unchanged. Both are translated into the same typed error
 * here, so that the dialog layer does not have to know which path was taken.
 *
 * The message itself is sparse on purpose: it names no participant, no coach
 * and no appointment id. The detail belongs in the server log.
 */

/** The server's code for a time window that is already taken. */
export const APPOINTMENT_TIME_CONFLICT = "APPOINTMENT_TIME_CONFLICT";

/**
 * The server's code for an interval that is not a valid one.
 *
 * The same code the named entry point has always used, so both write paths
 * make the same statement about the same condition.
 */
export const APPOINTMENT_INVALID_INTERVAL = "INVALID_INTERVAL";

/**
 * A write that was rejected because of a conflict.
 */
export class AppointmentConflictError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AppointmentConflictError";
    this.code = code;
    this.status = status;
  }

  /** The requested time window is already taken for this coach. */
  get isTimeConflict(): boolean {
    return this.code === APPOINTMENT_TIME_CONFLICT;
  }
}

/**
 * Whether the error is a write error whose message comes from the server.
 *
 * The two transports deliver two different types: `AppointmentEditError` from
 * the named Apex entry point, `AppointmentConflictError` from the UI API. A
 * common base class would not survive the tests — they replace the first one
 * with their own class — so the check is done on the shape instead: a server
 * error carries a `code`.
 */
export function isServerWriteError(
  error: unknown
): error is { code: string; message: string } {
  if (error instanceof AppointmentConflictError) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

/**
 * The code and the message the server sent, in the shape the UI API delivers
 * them: the Apex message is handed through verbatim and starts with a stable
 * code (`APPOINTMENT_TIME_CONFLICT: Der Zeitraum ist beim Coach bereits
 * belegt.`).
 *
 * The pattern is built from the codes above, so the two cannot drift apart.
 */
const CONFLICT_PATTERN = new RegExp(
  `(${APPOINTMENT_TIME_CONFLICT}|${APPOINTMENT_INVALID_INTERVAL}):\\s*([^\\n]*)`
);

/**
 * Turns a transport error into an `AppointmentConflictError` if the server
 * reported a conflict, and leaves every other error untouched.
 *
 * The code prefix is the contract, not the prose: the message behind it can
 * change without breaking the client.
 */
export function translateAppointmentWriteError(error: unknown): unknown {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const match = CONFLICT_PATTERN.exec(raw);
  if (!match) {
    return error;
  }
  const status = match[1] === APPOINTMENT_TIME_CONFLICT ? 409 : 400;
  return new AppointmentConflictError(match[1], match[2].trim(), status);
}
