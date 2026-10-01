/**
 * Site path prefix of the Experience Cloud site this bundle is served from.
 *
 * Source of truth is
 * `force-app/main/default/digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml`
 * → `<urlPathPrefix>organisatorv1</urlPathPrefix>`.
 *
 * Why this exists: `sdk.fetch("/services/apexrest/...")` resolves against the
 * site automatically, but a raw `fetch()` or `window.location` does NOT. Without
 * the prefix, `SessionTimeServlet` and `logout.jsp` are requested from
 * `/sfsites/c/...` on the My Domain root and 404, because the site actually
 * lives under `/organisatorv1`.
 *
 * If the site path ever changes, change it here and in the DigitalExperienceConfig metadata.
 */
export const SITE_PATH_PREFIX = "/organisatorv1";

/**
 * Builds an absolute in-site path, e.g. `siteUrl("/secur/logout.jsp")`.
 * @param path path relative to the site root, with or without a leading slash
 */
export function siteUrl(path: string): string {
	return `${SITE_PATH_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}