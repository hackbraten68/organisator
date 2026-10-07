/**
 * `sessionTimeService` decides when the portal logs a user out. Two things
 * must hold no matter what the servlet says:
 *
 * 1. A broken or hostile response must never throw into the running app. The
 *    service returns `undefined` on every failure path so
 *    `SessionTimeoutValidator` can degrade instead of crashing.
 *
 * 2. The reported remaining time must be reduced by `LATENCY_BUFFER_SECONDS`.
 *    The value arrives from the network, so it is always stale by the time it
 *    is rendered — without the buffer the user is logged out exactly when the
 *    server thinks the session is still alive.
 *
 * The buffer also clamps at zero: a server that reports a smaller remainder
 * than the buffer must not produce a negative countdown.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	pollSessionTimeServlet,
	extendSessionTime,
	parseResponseResult,
} from "./sessionTimeService";
import { SESSION_CONFIG } from "./sessionTimeoutConfig";

const CSRF = SESSION_CONFIG.CSRF_TOKEN;

const jsonResponse = (body: string, contentType = "application/json") => ({
	ok: true,
	status: 200,
	statusText: "OK",
	headers: { get: (name: string) => (name === "content-type" ? contentType : null) },
	text: async () => body,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
	// Der Dienst loggt jeden Fehlerweg nach console.error; das würde die
	// Testausgabe mit erwarteten Fehlern fluten.
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("parseResponseResult", () => {
	it("liest sp und sr aus sauberem JSON", () => {
		expect(parseResponseResult('{"sp":0,"sr":1200}')).toEqual({ sp: 0, sr: 1200 });
	});

	it("entfernt das CSRF-Präfix, das Salesforce voranstellt", () => {
		expect(parseResponseResult(`${CSRF}{"sp":1,"sr":600}`)).toEqual({ sp: 1, sr: 600 });
	});

	it("toleriert führende und nachfolgende Leerzeichen", () => {
		expect(parseResponseResult('  \n {"sp":0,"sr":60}\n  ')).toEqual({ sp: 0, sr: 60 });
	});

	it("gibt undefined zurück bei kaputtem JSON", () => {
		expect(parseResponseResult("{not json")).toBeUndefined();
	});

	it("gibt undefined zurück, wenn sp oder sr fehlt", () => {
		expect(parseResponseResult('{"sp":0}')).toBeUndefined();
		expect(parseResponseResult('{"sr":60}')).toBeUndefined();
	});

	it("gibt undefined zurück, wenn sp oder sr keine Zahl ist", () => {
		// Häufigster Fall: das Servlet liefert bei Fehlern eine Fehlermeldung
		// als JSON-Objekt mit anderen Feldern.
		expect(parseResponseResult('{"sp":"0","sr":60}')).toBeUndefined();
		expect(parseResponseResult('{"sp":0,"sr":null}')).toBeUndefined();
		expect(parseResponseResult('{"error":"invalid_session"}')).toBeUndefined();
	});
});

describe("Restzeit-Berechnung", () => {
	it("zieht den Latenzpuffer von sr ab", async () => {
		fetchMock.mockResolvedValue(jsonResponse('{"sp":0,"sr":1200}'));

		const result = await pollSessionTimeServlet("/sfsites/c/");

		expect(result?.sr).toBe(1200 - SESSION_CONFIG.LATENCY_BUFFER_SECONDS);
	});

	it("klemmt die Restzeit bei null nach unten", async () => {
		// Server meldet weniger als der Puffer: ohne Klemmung ginge der
		// Countdown in negative Zahlen.
		fetchMock.mockResolvedValue(jsonResponse('{"sp":0,"sr":1}'));

		const result = await pollSessionTimeServlet("/sfsites/c/");

		expect(result?.sr).toBe(0);
	});

	it("gibt sr durch, wenn es bereits negativ war", async () => {
		fetchMock.mockResolvedValue(jsonResponse('{"sp":0,"sr":-30}'));

		const result = await pollSessionTimeServlet("/sfsites/c/");

		expect(result?.sr).toBe(0);
	});
});

describe("Aufruf der SessionTimeServlet", () => {
	it("hängt einen Cache-Buster an und sendet same-origin mit Ajax-Marker", async () => {
		fetchMock.mockResolvedValue(jsonResponse('{"sp":0,"sr":300}'));

		await pollSessionTimeServlet("/sfsites/c/");

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain(`${SESSION_CONFIG.SERVLET_URL}?buster=`);
		expect(url).not.toContain("updateTimedOutSession");
		expect(init.credentials).toBe("same-origin");
		expect(init.cache).toBe("no-cache");
		expect(init.headers["X-Requested-With"]).toBe("XMLHttpRequest");
	});

	it("setzt updateTimedOutSession nur beim Verlängern", async () => {
		fetchMock.mockResolvedValue(jsonResponse('{"sp":0,"sr":1800}'));

		await extendSessionTime("/sfsites/c/");

		expect(fetchMock.mock.calls[0][0]).toContain("updateTimedOutSession=true");
	});

	it("respektiert den übergebenen Community-Base-Path", async () => {
		fetchMock.mockResolvedValue(jsonResponse('{"sp":0,"sr":300}'));

		await pollSessionTimeServlet("/organisatorv1");

		expect(fetchMock.mock.calls[0][0].startsWith("/organisatorv1")).toBe(true);
	});
});

describe("Fehlerwege werfen nie", () => {
	it("gibt undefined zurück bei HTTP-Fehler", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 404,
			statusText: "Not Found",
			headers: { get: () => null },
		});

		expect(await pollSessionTimeServlet("/sfsites/c/")).toBeUndefined();
	});

	it("gibt undefined zurück bei unerwartetem Content-Type", async () => {
		// Ein HTML-Login-Formular bedeutet: die Session ist weg, der Nutzer
		// wird zur Anmeldung umgeleitet. Das darf nicht als Restzeit gelesen werden.
		fetchMock.mockResolvedValue(jsonResponse("<html></html>", "text/html; charset=utf-8"));

		expect(await pollSessionTimeServlet("/sfsites/c/")).toBeUndefined();
	});

	it("gibt undefined zurück, wenn fetch selbst scheitert", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

		expect(await extendSessionTime("/sfsites/c/")).toBeUndefined();
	});

	it("gibt undefined zurück, wenn der Body kein parsebares Ergebnis liefert", async () => {
		fetchMock.mockResolvedValue(jsonResponse("Service Unavailable"));

		expect(await pollSessionTimeServlet("/sfsites/c/")).toBeUndefined();
	});

	it("akzeptiert einen fehlenden Content-Type", async () => {
		// Manche Proxies lassen den Header weg; das ist kein Grund zu scheitern.
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			headers: { get: () => null },
			text: async () => '{"sp":0,"sr":300}',
		});

		expect((await pollSessionTimeServlet("/sfsites/c/"))?.sr).toBe(300 - SESSION_CONFIG.LATENCY_BUFFER_SECONDS);
	});
});
