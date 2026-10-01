/**
 * Site path prefix and logout routing for the Experience Cloud site this bundle
 * is served from.
 *
 * Site path prefix source of truth is
 * `force-app/main/default/digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml`
 * → `<urlPathPrefix>organisatorv1</urlPathPrefix>`.
 * The site *name* source of truth is the Network metadata
 * → `networks/Organisator.network-meta.xml` → `<site>Organisator</site>`.
 *
 * Why SITE_PATH_PREFIX exists: `sdk.fetch("/services/apexrest/...")` resolves
 * against the site automatically, but a raw `fetch()` or `window.location` does
 * NOT. Without the prefix, requests go to `/sfsites/c/...` on the My Domain root
 * and 404, because the site actually lives under `/organisatorv1`.
 *
 * If the site path ever changes, change it here and in the DigitalExperienceConfig
 * metadata, then re-run the tests in `site.test.ts`.
 */

/**
 * Site path prefix (primary URL). Mirrors the DigitalExperienceConfig
 * `urlPathPrefix`. Must not include the `...vforcesite` secondary suffix.
 */
export const SITE_PATH_PREFIX = "/organisatorv1";

/**
 * Site name. Mirrors the Network `<site>` value and the CustomSite name. Used by
 * the logout endpoint below, which takes the site name as a query parameter.
 */
export const SITE_NAME = "Organisator";

/**
 * Builds an absolute in-site path, e.g. `siteUrl("/sfsites/c/x")`.
 * @param path path relative to the site root, with or without a leading slash
 */
export function siteUrl(path: string): string {
	return `${SITE_PATH_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The subset of `SFDC_ENV` the logout builder reads. Typed structurally. */
type SfdcEnvSubset = { orgUrl?: string };

/**
 * Reads `SFDC_ENV.orgUrl` — the My Domain origin (e.g.
 * `https://techandteach--devhub.sandbox.lightning.force.com`) the platform
 * injects on every Experience Cloud page. Returns null when absent (e.g. local
 * dev or a plain static harness).
 */
function orgOrigin(): string | null {
	const env = (globalThis as { SFDC_ENV?: SfdcEnvSubset }).SFDC_ENV;
	return env?.orgUrl ? env.orgUrl.replace(/\/+$/, "") : null;
}

/**
 * Builds the Experience Cloud logout URL.
 *
 * Why not `/secur/logout.jsp` (the Aura/VF community convention): this site is an
 * enhanced-LWR React *app container*. Every path under the site prefix — including
 * `/organisatorv1/secur/logout.jsp` — is intercepted by the container and served
 * the SPA shell, so the logout endpoint is never reached and the user is dumped
 * on a 404 after the redirect.
 *
 * The working endpoint is the session logout on the My Domain origin:
 * `/sfsites/s/logout?site=<SITE_NAME>`. It returns the Salesforce login page.
 *
 * Falls back to the site-relative path when `SFDC_ENV.orgUrl` is unavailable
 * (local dev), so the caller always gets a string.
 *
 * @param startURL optional in-site path to land on after re-authenticating
 */
export function logoutUrl(startURL?: string): string {
	const origin = orgOrigin();
	const query = new URLSearchParams({ site: SITE_NAME });
	if (startURL) {
		query.set("retURL", startURL);
	}
	const path = `/sfsites/s/logout?${query.toString()}`;
	return origin ? `${origin}${path}` : siteUrl(path);
}
