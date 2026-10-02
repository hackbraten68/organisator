/**
 * Path prefixes and logout routing for the Experience Cloud site this bundle is
 * served from.
 *
 * THE SITE HAS TWO URLS, AND THIS MODULE KEEPS THEM APART ON PURPOSE.
 *
 * | Prefix | Source of truth | Serves |
 * |---|---|---|
 * | `SITE_PATH_PREFIX` (`/organisatorv1`) | `digitalExperienceConfigs/Organisator1…` `<urlPathPrefix>` | the React app, every customer-facing page |
 * | `SITE_AUTH_PATH_PREFIX` (`/organisatorv1vforcesite`) | `sites/Organisator.site-meta.xml` and `networks/Organisator.network-meta.xml` `<urlPathPrefix>` — which must be identical | login and logout |
 *
 * `sdk.fetch("/services/apexrest/...")` resolves against the site automatically,
 * but a raw `fetch()` or `window.location` does NOT. Without the prefix, requests
 * go to `/sfsites/c/...` on the My Domain root and 404.
 *
 * If either site path ever changes, change it here and in the metadata that owns
 * it, then re-run the tests in `site.test.ts` — the sync assertions there read
 * the XML and fail loudly on drift.
 */

/**
 * Picasso path prefix (primary, customer-facing). Mirrors the
 * DigitalExperienceConfig `urlPathPrefix`. Must not include the `...vforcesite`
 * secondary suffix.
 */
export const SITE_PATH_PREFIX = "/organisatorv1";

/**
 * Auth path prefix (secondary, the ChatterNetwork URL).
 *
 * Salesforce appends `vforcesite` to the legacy URL of a ChatterNetwork site and
 * puts LOGIN there, not on the Picasso path: a member's welcome email links to
 * `/organisatorv1vforcesite/login?c=…` and only then forwards to `/organisatorv1`.
 *
 * It cannot be moved up to `SITE_PATH_PREFIX`: the React app is an enhanced-LWR
 * *app container*, which intercepts every path under the Picasso prefix and
 * serves the SPA shell. Verified 2026-10-02.
 *
 * LOGOUT is the exception and does NOT live here — see `logoutUrl`.
 */
export const SITE_AUTH_PATH_PREFIX = "/organisatorv1vforcesite";

/**
 * Site name. Mirrors the Network `<site>` value and the CustomSite name. Used by
 * the logout endpoint, which takes the site name as a query parameter.
 */
export const SITE_NAME = "Organisator";

/**
 * Builds an absolute path under the Picasso prefix, e.g.
 * `siteUrl("/sfsites/c/x")`.
 * @param path path relative to the site root, with or without a leading slash
 */
export function siteUrl(path: string): string {
	return `${SITE_PATH_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The path on the auth surface that DOES end a portal session.
 *
 * Measured live 2026-10-02 with a real member session, checking
 * `/me` before and after each candidate. The check matters more than the status
 * code: `/me` resolves identity server-side from `User.ContactId`, so a 200 after
 * a "logout" proves the session survived.
 *
 * | Candidate | Status | `/me` after | Session ended? |
 * |---|---|---|---|
 * | `<site>/…vforcesite/secur/logout.jsp` | 200 | **401** | **yes** |
 * | `<site>/…vforcesite/sfsites/s/logout` | 503 | 200 | no — CDN error |
 * | `<myDomain>/sfsites/s/logout` | 302 → org login | 200 | **no** |
 * | `<myDomain>/servlet/networks/logout` | 404 | 200 | no |
 *
 * Only the Aura/VF-era endpoint works — the one this module used before
 * 2026-10-02 and which an earlier commit removed as "verified dead". It was not
 * dead: `/organisatorv1/secur/logout.jsp` is unreachable because the Picasso app
 * container swallows it, but the SAME PATH on the vforcesite surface answers
 * 200, ends the session, and — with the Network `<logoutUrl>` set — lands the
 * member on this app's React login.
 *
 * The earlier `site.test.ts` assertion that the container "intercepts every path
 * under the site prefix" was true and still is; it was generalised to the
 * vforcesite prefix without evidence, and that generalisation is what sent this
 * function to `/sfsites/s/logout`.
 *
 * WHY NO RETURN-URL PARAMETER: the `<logoutUrl>` metadata decides the landing, so
 * a parameter would be redundant. It was also measured useless on the My Domain
 * endpoint — `retURL`, `redirect`, `returnUrl`, `logoutUrl` and `startURL` all
 * produced an identical `Location`, with the value only reappearing
 * double-encoded inside that redirect's own `url=` echo.
 *
 * `SFDC_ENV` is deliberately not read. It exposes `orgUrl`, `apiPath`,
 * `basePath`, `namespace` and `appName` — but no community URL.
 */
export function logoutUrl(): string {
	return `${window.location.origin}${SITE_AUTH_PATH_PREFIX}/secur/logout.jsp`;
}
