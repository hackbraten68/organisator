/**
 * Unit tests for the site path prefix and the logout URL.
 *
 * Two shipped bugs are guarded against here.
 *
 * 1. Missing prefix: `SessionTimeoutValidator` and `logout.jsp` were called with
 *    `basePath=""`, so raw requests went to `/sfsites/c/...` on the My Domain root
 *    while the site actually lives under `/organisatorv1`. The session poll 404'd
 *    on every tick and logout left the site.
 *
 * 2. Logout pointed at the site: `/organisatorv1/secur/logout.jsp` returns HTTP
 *    200 but serves the React SPA shell — the app container intercepts every path
 *    under the site prefix, so the Aura/VF logout endpoint is never reached. The
 *    session logout has to go to the My Domain origin instead.
 *
 * The prefix assertions cannot catch a changed metadata value on their own — the
 * constant is duplicated from `urlPathPrefix` — so the sync checks below are the
 * part that matters.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { SITE_PATH_PREFIX, SITE_NAME, siteUrl, logoutUrl } from "./site";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_METADATA = resolve(
	HERE,
	"../../../../digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml",
);
const NETWORK_METADATA = resolve(
	HERE,
	"../../../../networks/Organisator.network-meta.xml",
);

afterEach(() => {
	delete (globalThis as { SFDC_ENV?: unknown }).SFDC_ENV;
});

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
	it("targets the My Domain origin, not the site", () => {
		(globalThis as { SFDC_ENV?: unknown }).SFDC_ENV = {
			orgUrl: "https://acme--dev.sandbox.lightning.force.com",
		};
		const url = new URL(logoutUrl());
		expect(url.origin).toBe("https://acme--dev.sandbox.lightning.force.com");
	});

	it("uses the session logout endpoint with the site name", () => {
		(globalThis as { SFDC_ENV?: unknown }).SFDC_ENV = {
			orgUrl: "https://acme--dev.sandbox.lightning.force.com",
		};
		const url = new URL(logoutUrl());
		expect(url.pathname).toBe("/sfsites/s/logout");
		expect(url.searchParams.get("site")).toBe(SITE_NAME);
	});

	it("never produces a path under the site prefix", () => {
		// The container serves the SPA for anything under the prefix, so a
		// logout URL there silently lands the user on a blank page instead.
		(globalThis as { SFDC_ENV?: unknown }).SFDC_ENV = {
			orgUrl: "https://acme--dev.sandbox.lightning.force.com",
		};
		expect(new URL(logoutUrl()).pathname.startsWith(SITE_PATH_PREFIX)).toBe(false);
	});

	it("carries a retURL when a start URL is given", () => {
		(globalThis as { SFDC_ENV?: unknown }).SFDC_ENV = {
			orgUrl: "https://acme--dev.sandbox.lightning.force.com",
		};
		const url = new URL(logoutUrl("/organisatorv1/profile"));
		expect(url.searchParams.get("retURL")).toBe("/organisatorv1/profile");
	});

	it("strips a trailing slash from orgUrl", () => {
		(globalThis as { SFDC_ENV?: unknown }).SFDC_ENV = {
			orgUrl: "https://acme--dev.sandbox.lightning.force.com/",
		};
		expect(logoutUrl()).toMatch(/^https:\/\/[^/]+\/sfsites\/s\/logout\?/);
	});

	it("falls back to a site-relative path when SFDC_ENV is absent", () => {
		// Local dev and the static e2e harness have no SFDC_ENV.
		const url = logoutUrl();
		expect(url.startsWith(SITE_PATH_PREFIX)).toBe(true);
	});
});

describe("site path constant", () => {
	it("matches urlPathPrefix in the DigitalExperienceConfig metadata", () => {
		// A raw fetch() and window.location do not resolve against the site, so
		// this constant has to track the metadata. If the site moves and this
		// does not, session polling silently breaks again.
		//
		// The primary URL lives in the DigitalExperienceConfig of the Picasso
		// site, NOT in the Network: Network and CustomSite carry the secondary
		// `...vforcesite` URL used for legacy auth endpoints.
		const xml = readFileSync(SITE_METADATA, "utf8");
		const match = xml.match(/<urlPathPrefix>([^<]+)<\/urlPathPrefix>/);
		expect(match).not.toBeNull();
		expect(SITE_PATH_PREFIX).toBe(`/${match![1]}`);
	});

	it("matches the site name in the Network metadata", () => {
		// The logout endpoint takes the site name as a query parameter; a wrong
		// value logs the user out of nothing and leaves the session alive.
		const xml = readFileSync(NETWORK_METADATA, "utf8");
		const match = xml.match(/<site>([^<]+)<\/site>/);
		expect(match).not.toBeNull();
		expect(SITE_NAME).toBe(match![1]);
	});
});
