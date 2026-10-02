/**
 * Unit tests for the two site path prefixes, the logout endpoint and the
 * Network logout landing.
 *
 * Four shipped bugs are guarded against here.
 *
 * 1. Missing prefix: `SessionTimeoutValidator` was called with `basePath=""`, so
 *    raw requests went to `/sfsites/c/...` on the My Domain root while the site
 *    actually lives under `/organisatorv1`. The session poll 404'd on every tick.
 *
 * 2. Logout pointed at the site: `/organisatorv1/secur/logout.jsp` returns HTTP
 *    200 but serves the React SPA shell — the app container intercepts every path
 *    under the prefix, so the Aura/VF logout endpoint is never reached.
 *
 * 3. Logout pointed at the My Domain (2026-10-02). That endpoint ends the
 *    session but bounces through
 *    `…my.salesforce.com/visualforce/session?url=…` onto the org's own login —
 *    a different session system than the portal's. Fixed by moving to the site's
 *    own auth surface, which is the `…vforcesite` path.
 *
 * 4. The Network `<logoutUrl>` does NOT apply to the My Domain endpoint.
 *    Measured live: with the value set, the site published, and four attempts
 *    over nine minutes, a sign-out still landed on `…my.salesforce.com/?ec=302`.
 *    That is why the endpoint in (3) had to change, not just the metadata.
 *
 * The prefix assertions cannot catch a changed metadata value on their own — the
 * constants are duplicated from XML — so the sync checks below are the part that
 * matters.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { SITE_PATH_PREFIX, SITE_AUTH_PATH_PREFIX, SITE_NAME, siteUrl, logoutUrl } from "./site";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DEFAULT = resolve(
	HERE,
	"../../../../digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml",
);
const NETWORK = resolve(HERE, "../../../../networks/Organisator.network-meta.xml");
const CUSTOM_SITE = resolve(HERE, "../../../../sites/Organisator.site-meta.xml");

const readTag = (file: string, tag: string): string | null => {
	const match = readFileSync(file, "utf8").match(
		new RegExp(`<${tag}>([^<]+)</${tag}>`),
	);
	return match ? match[1] : null;
};

describe("siteUrl", () => {
	it("prefixes an absolute path", () => {
		expect(siteUrl("/secur/logout.jsp")).toBe("/organisatorv1/secur/logout.jsp");
	});

	it("adds the missing leading slash", () => {
		expect(siteUrl("secur/logout.jsp")).toBe("/organisatorv1/secur/logout.jsp");
	});

	it("keeps the session servlet inside the site", () => {
		const url = siteUrl("/sfsites/c/_nc_external/system/security/session/SessionTimeServlet");
		expect(url.startsWith(SITE_PATH_PREFIX)).toBe(true);
	});
});

describe("logoutUrl", () => {
	it("targets the logout path that actually ends a session", () => {
		const url = new URL(logoutUrl());
		// `/secur/logout.jsp` on the AUTH surface, not `/sfsites/s/logout`.
		// Measured live 2026-10-02: the latter answers 503 and leaves the session
		// intact (`/me` still 200). See the table in logoutUrl's doc comment.
		expect(url.pathname).toBe(`${SITE_AUTH_PATH_PREFIX}/secur/logout.jsp`);
		expect(url.search).toBe("");
	});

	it("never targets the My Domain, even when SFDC_ENV names one", () => {
		// The bug this guards: the My Domain endpoint ends the session and then
		// bounces the member onto the org's own login page. `SFDC_ENV.orgUrl` is
		// exactly that My Domain origin, and reading it is what caused it — so the
		// value is planted here and must still be ignored.
		//
		// No assertion about the *expected* host here: under jsdom the origin is
		// localhost. That the community host is `*.my.site.com` in production is
		// asserted where it actually holds — on the metadata below, and in the live
		// logout spec against the real site.
		(globalThis as { SFDC_ENV?: unknown }).SFDC_ENV = {
			orgUrl: "https://acme--dev.sandbox.lightning.force.com",
		};
		try {
			const url = new URL(logoutUrl());
			expect(url.host).not.toBe("acme--dev.sandbox.lightning.force.com");
			expect(url.host).toBe(new URL(window.location.origin).host);
		} finally {
			delete (globalThis as { SFDC_ENV?: unknown }).SFDC_ENV;
		}
	});

	it("never produces a path under the Picasso prefix", () => {
		// The app container serves the SPA for anything under the prefix, so a
		// logout URL there lands the member back on a blank page instead of
		// ending the session.
		//
		// The boundary is the PATH SEGMENT, not the raw string: the auth prefix
		// `/organisatorv1vforcesite` does start with `/organisatorv1` textually,
		// and asserting on the bare string would fail on that coincidence while
		// saying nothing about behaviour. Measured: the container does NOT swallow
		// the vforcesite path — that path serves the real auth endpoints.
		const url = new URL(logoutUrl());
		expect(url.pathname.startsWith(`${SITE_PATH_PREFIX}/`)).toBe(false);
		expect(url.pathname.startsWith(`${SITE_AUTH_PATH_PREFIX}/`)).toBe(true);
	});

	it("carries no return-URL parameter at all", () => {
		// Measured on the My Domain endpoint: retURL, redirect, returnUrl, logoutUrl
		// and startURL all produced the identical Location, the value only
		// reappearing inside that redirect's own `url=` echo. Inert code that
		// reads like a working feature is how this reached production.
		//
		// The landing is decided by the Network <logoutUrl> instead, so a
		// parameter here would be redundant even if the endpoint honoured one.
		expect([...new URL(logoutUrl()).searchParams.keys()]).toEqual([]);
	});

	it("does not read SFDC_ENV at all", () => {
		// `SFDC_ENV` carries no community URL, so the only correct origin is the
		// one this module is served from. A test that pins the absence of the
		// dependency fails if someone reintroduces it for convenience.
		const before = logoutUrl();
		(globalThis as { SFDC_ENV?: unknown }).SFDC_ENV = {
			orgUrl: "https://acme--dev.sandbox.lightning.force.com",
		};
		try {
			expect(logoutUrl()).toBe(before);
		} finally {
			delete (globalThis as { SFDC_ENV?: unknown }).SFDC_ENV;
		}
	});
});

describe("path prefix constants", () => {
	it("SITE_PATH_PREFIX matches the Picasso urlPathPrefix in the DigitalExperienceConfig", () => {
		// A raw fetch() and window.location do not resolve against the site, so
		// this constant has to track the metadata. If the site moves and this does
		// not, session polling silently breaks again.
		//
		// The primary URL lives in the DigitalExperienceConfig, NOT in the Network:
		// Network and CustomSite carry the secondary `...vforcesite` URL.
		expect(SITE_PATH_PREFIX).toBe(`/${readTag(SRC_DEFAULT, "urlPathPrefix")}`);
	});

	it("SITE_AUTH_PATH_PREFIX matches the CustomSite urlPathPrefix", () => {
		expect(SITE_AUTH_PATH_PREFIX).toBe(`/${readTag(CUSTOM_SITE, "urlPathPrefix")}`);
	});

	it("Network and CustomSite agree on the auth prefix", () => {
		// A Salesforce constraint, not a style preference: the Network's secondary
		// URL is the CustomSite URL.
		expect(readTag(NETWORK, "urlPathPrefix")).toBe(readTag(CUSTOM_SITE, "urlPathPrefix"));
	});

	it("the auth prefix is not the Picasso prefix", () => {
		// The two used to be conflated. If they ever collapse, the auth endpoints
		// move under the app container and stop being reachable.
		expect(SITE_AUTH_PATH_PREFIX).not.toBe(SITE_PATH_PREFIX);
	});

	it("matches the site name in the Network metadata", () => {
		// The logout endpoint takes the site name as a query parameter; a wrong
		// value logs the user out of nothing and leaves the session alive.
		expect(SITE_NAME).toBe(readTag(NETWORK, "site"));
	});
});

describe("logout landing", () => {
	/**
	 * The Network <logoutUrl> is what decides where a member lands after signing
	 * out. It does NOT apply to the My Domain endpoint (measured live), which is
	 * why the endpoint is on the auth surface — but the value still has to be
	 * right, or the auth surface falls back to the org default site login.
	 *
	 * Parsed rather than string-matched against a fixed URL, because the host is
	 * sandbox-specific: what must hold is that the path is THIS app's login.
	 */
	it("points the Network logoutUrl at this app's login route", () => {
		const url = new URL(readTag(NETWORK, "logoutUrl") ?? "");
		expect(url.protocol).toBe("https:");
		expect(url.pathname).toBe(siteUrl("/login"));
		// The community host, not the My Domain. This is the one place the
		// sandbox-specific host is asserted: it lives in the metadata, so it is
		// checked here rather than in a unit test that runs under localhost.
		expect(url.host).toMatch(/\.my\.site\.com$/);
		expect(url.host).not.toMatch(/lightning\.force\.com$/);
	});

	it("is not absent — a Network without logoutUrl lands on the org default login", () => {
		// Its own assertion so the failure names what is missing rather than
		// reporting a URL mismatch on the test above.
		expect(readFileSync(NETWORK, "utf8")).toContain("<logoutUrl>");
	});
});