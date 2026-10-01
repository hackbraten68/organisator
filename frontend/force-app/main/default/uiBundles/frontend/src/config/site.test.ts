/**
 * Unit tests for the site path prefix.
 *
 * The bug this guards against is real and was shipped: `SessionTimeoutValidator`
 * and `logout.jsp` were called with `basePath=""`, so the raw requests went to
 * `/sfsites/c/...` on the My Domain root while the site actually lives under
 * `/organisatorv1`. The session poll 404'd on every tick and logout left the site.
 *
 * These assertions cannot catch a changed metadata value on their own — the
 * constant is duplicated from `urlPathPrefix` — so the sync check below is the
 * part that matters.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { SITE_PATH_PREFIX, siteUrl } from "./site";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_METADATA = resolve(
	HERE,
	"../../../../digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml",
);

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

describe("site path constant", () => {
	it("matches urlPathPrefix in the DigitalExperienceConfig metadata", () => {
		// A raw fetch() and window.location do not resolve against the site, so
		// this constant has to track the metadata. If the site moves and this
		// does not, session polling and logout silently break again.
		//
		// The primary URL lives in the DigitalExperienceConfig of the Picasso
		// site, NOT in the Network: Network and CustomSite carry the secondary
		// `...vforcesite` URL used for legacy auth endpoints.
		const xml = readFileSync(SITE_METADATA, "utf8");
		const match = xml.match(/<urlPathPrefix>([^<]+)<\/urlPathPrefix>/);
		expect(match).not.toBeNull();
		expect(SITE_PATH_PREFIX).toBe(`/${match![1]}`);
	});
});