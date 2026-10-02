# AGENTS.md — `frontend` project

This file records **verified** findings about the Experience Cloud site in this repo. Every
command here was executed against `hubSandbox` and its output was checked. Claims that
could not be verified are marked as such.

The site is live at:

```text
https://techandteach--devhub.sandbox.my.site.com/organisatorv1
```

---

## What this project owns

Per `backend/docs/AGENTS.md`, `frontend` owns `Network`, `CustomSite`,
`DigitalExperienceConfig`, portal profiles/permission sets, Experience Cloud templates,
and the participant UI Bundle. Both projects deploy into the **same org**.

---

## The three-component URL architecture (read this before touching any URL)

An Experience Cloud site is three metadata components using **two different URLs**:

| Component | Metadata type | URL | Purpose |
|---|---|---|---|
| Picasso site | `DigitalExperienceConfig` + `DigitalExperienceBundle` | `organisatorv1` | primary, customer-facing pages |
| ChatterNetwork site | `Network` + `CustomSite` | `organisatorv1vforcesite` | legacy auth endpoints |

Rules:

- `Network.urlPathPrefix` and `CustomSite.urlPathPrefix` **must be identical**. Salesforce
  distinguishes the secondary URL by appending `vforcesite` to the primary.
- The primary URL lives in the `DigitalExperienceConfig`, **not** in the `Network`. Reading
  `Network` to find the site path is wrong and cost real debugging time here.
- `Network.picassoSite` must be `{siteName}1` — the Picasso site — **not** `{siteName}`.
- `Network.site` must be `{siteName}` — the ChatterNetwork site.

The live mapping, verified by retrieve:

```text
Network Organisator:     <site>Organisator</site>
                         <picassoSite>Organisator1</picassoSite>
                         <urlPathPrefix>organisatorv1vforcesite</urlPathPrefix>
CustomSite Organisator:  <urlPathPrefix>organisatorv1vforcesite</urlPathPrefix>
DEC Organisator1:        <urlPathPrefix>organisatorv1</urlPathPrefix>
                         <space>site/Organisator1</space>
```

---

## Creating a React (UI Bundle) site — the working procedure

Verified 2026-10-01 for `Organisator`. Templates follow
`forcedotcom/sf-skills/skills/experience-ui-bundle-site-generate`.

### Files to author

```text
networks/{siteName}.network-meta.xml
sites/{siteName}.site-meta.xml
digitalExperienceConfigs/{siteName}1.digitalExperienceConfig-meta.xml
digitalExperiences/site/{siteName}1/{siteName}1.digitalExperience-meta.xml
digitalExperiences/site/{siteName}1/sfdc_cms__site/{siteName}1/{_meta.json,content.json}
```

`{siteName}` is UpperCamelCase; the Picasso site is always `{siteName}1`. In this org the
metadata name and the URL are independent — the site is `Organisator` while its URL is
`organisatorv1`.

The content record that makes it a React site:

```json
{
  "type": "sfdc_cms__site",
  "title": "{siteName}",
  "urlName": "{siteUrlPathPrefix}",
  "contentBody": {
    "authenticationType": "AUTHENTICATED_WITH_PUBLIC_ACCESS_ENABLED",
    "appContainer": true,
    "appSpace": ""
  }
}
```

### Deploy in one call, all five types together

```bash
cd frontend
sf project deploy start \
  --target-org <alias> \
  --source-dir force-app/main/default/networks/Organisator.network-meta.xml \
  --source-dir force-app/main/default/sites/Organisator.site-meta.xml \
  --source-dir force-app/main/default/digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml \
  --source-dir force-app/main/default/digitalExperiences/site/Organisator1
```

Then publish:

```bash
sf community publish --name Organisator --target-org <alias>
```

### Why one call is mandatory

The cross-references (`Network.site`, `Network.picassoSite`, `DEC.space`) are validated
against the **existing org state**, not against the components in the same deploy. Deploying
them in stages produces cascading failures that look like unrelated errors:

| Split deploy | Error |
|---|---|
| DEC first | `In field: Network - no Network named portal found` |
| CustomSite first | `In field: Name - no Network named portal found` |
| Network alone | `In field: Site - no CustomSite named portal found` |
| Network with `picassoSite={siteName}` | `PicassoSite portal is not of type ChatterNetworkPicasso` |

Note that `Network` + `CustomSite` *together* does resolve their mutual reference, but adding
`DigitalExperienceConfig`/`DigitalExperienceBundle` is where the whole set must be atomic.

---

## `appContainer` is read-only — `appSpace` is not

This is the single most important constraint and it dictates a two-phase deploy.

An **existing** LWR site cannot be converted into a React container:

```text
Der Wert für die Eigenschaft "$.appContainer" ist schreibgeschützt
und kann nicht geändert werden.
```

So a React site must be created net-new. `appSpace` must be empty at creation and set
afterwards — deploying it too early fails validation with
`We couldn't find the <namespace>__<name> UIBundle`.

```text
phase 1:  appSpace: ""          -> site + workspace created
phase 2:  appSpace: "c__frontend" -> binding applied (verified writable on a fresh site)
```

Phase 2 is a separate `--source-dir` deploy of the same `sfdc_cms__site` folder. Note that
`appContainer` read-only does **not** extend to `appSpace`; that was verified by deploying.

Namespace: `sfdx-project.json` has `"namespace": ""`, so the binding is `c__{devName}`.
`UiBundle:frontend` -> `c__frontend`.

---

## `sfdc_cms__languageSettings` is not deployable here

The official template emits it and says "always". On this org/API version it fails with a
platform error regardless of workspace state:

```text
DigitalExperience  site/Organisator1.sfdc_cms__languageSettings/languages
An unexpected error occurred. Please include this ErrorId if you contact support:
453620757-1174626 (1183319229)
```

Earlier this surfaced as `NullPointerException: ... "value.isAuthoringOnly" is null`.
The Salesforce reference calls the type *"authoring-only ... until the platform runtime
change lands"*. It is omitted from source deliberately. For a single-locale site it is not
needed. Do not "fix" this by retrying — the error is not an ordering problem.

---

## `SITE_PATH_PREFIX` and its source of truth

`src/config/site.ts` hardcodes the site prefix because `sdk.fetch` resolves against the site
but a raw `fetch()` or `window.location` does not — without it, `SessionTimeServlet` and
`logout.jsp` 404 on the My Domain root.

```text
frontend/force-app/main/default/uiBundles/frontend/src/config/site.ts
```

`site.test.ts` asserts the constant against
`digitalExperienceConfigs/Organisator1.digitalExperienceConfig-meta.xml`. **Not** the
Network — see the URL section above. If you change the site path, change the DEC, the
constant, and rebuild; then re-run both test suites.

---

## Verifying the site actually serves the bundle

`curl` the **primary** URL. Checking the `...vforcesite` URL instead is the classic false
negative here — that URL legitimately serves the stock login on legacy sites.

```bash
curl -sS -L -o /tmp/portal.html -w "final=%{url_effective}\nstatus=%{http_code}\n" \
  "https://techandteach--devhub.sandbox.my.site.com/organisatorv1"

grep -oE 'assets/index-[A-Za-z0-9_-]+\.(js|css)' /tmp/portal.html
```

A correct response contains `<base href="/organisatorv1/">`, a
`SFDC_ENV` block with `"appName": "frontend"`, and an asset hash matching the local
`dist/`. Then confirm the asset itself returns 200:

```bash
curl -sS -o /dev/null -w "%{http_code} %{size_download}\n" \
  "https://techandteach--devhub.sandbox.my.site.com/organisatorv1/assets/index-<hash>.js"
```

---

## Site inventory in `hubSandbox`

| Site | URL | State |
|---|---|---|
| `Organisator` / `Organisator1` | `/organisatorv1` | **the React portal** |
| `frontend` | `/organisatorvforcesite` | legacy; `picassoSite=frontend2`, delegates to `/organisator` |
| `frontend2` | `/organisator` | stock LWR, Picasso site, no Network |
| `portal` | `/portal` | dead end from a failed binding attempt |

`Site` is not deletable (`Site.delete=False`) — only archivable in Setup. `portal` is
leftover and should be archived. `frontend`/`frontend2` can go once nobody shares old links:
`/organisatorvforcesite` still redirects to `/organisator/login`.

---

## Network member groups

A `NetworkMemberGroup` covering only an external profile locks the internal admin out: the
row in *All Sites* loses its URL and actions and the Experience Builder is unreachable. The
Network needs both:

```xml
<networkMemberGroups>
    <profile>admin</profile>
    <profile>customer community plus user</profile>
</networkMemberGroups>
```

The official `sf-skills` template ships `admin` only. Adding the external profile is a
deliberate deviation — omitting it locks out every portal user.

Constraints:

- `NetworkMemberGroup` is not deletable and rejects Apex DML
  (`DML operation Update not allowed`). Membership can only be set via REST/Data Loader.
- The org stores the profile names lower-cased. Both spellings deploy; the localized names
  (`Systemadministrator`) do not.
- Keep the explanatory comment block in `networks/frontend.network-meta.xml`. An org
  retrieve deletes it, and it is the only record of why both entries exist.

---

## Testing the portal as an actual participant

`/me` resolves identity as `User.ContactId -> Contact -> Participant__c`. **The internal
admin has no `ContactId`**, so logging in as the admin renders the app shell plus

```text
Daten konnten nicht geladen werden. Bitte versuche es später noch einmal.
```

That is the correct behaviour, not a defect. Seeing it confirms the bundle loads and the
frontend calls the API — it only means there is no participant behind that login.

To see the real thing you need a `User` on an external profile whose `ContactId` points at a
contact that has a `Participant__c` row. See `backend/docs/portal-deploy-status.md` for the
open steps and the Apex restrictions involved.

---

## A green suite that proves nothing

Before believing a test, check that it fails without the fix. Two cases from this project
where that was not true:

- **`dist/` is not rebuilt by the Playwright run.** `playwright.config.ts` serves the existing
  `dist/` with `npx serve dist --single`. Editing `src/` and running the suite tests the old
  bundle. Run `npm run build` first. The suite was green against a build from weeks earlier.
- **The static harness cannot reproduce a guest failure.** Served statically,
  `services/data/.../ui-api/session/csrf` answers with `index.html`, the SDK throws at once,
  `loading` is set to `false`, and the login button is enabled **with and without** the
  timeout fix. The same assertion against the live site times out without the fix. Guest
  behaviour needs `npx playwright test --config=playwright.live.config.ts`.

### Running the live suite

```bash
cd frontend/force-app/main/default/uiBundles/frontend
npm run build                       # the live spec needs dist/ for the shell suite anyway
PORTAL_USER=<username> PORTAL_PASSWORD=<password> \
  npx playwright test --config=playwright.live.config.ts
```

`playwright.config.ts` ignores `live-guest.spec.ts`; `playwright.live.config.ts` runs only
that file. Both suites are run separately, and the live one needs network plus the org.

**`baseURL` carries the host only, never the site path.** `page.goto('/login')` resolves
against the URL *origin* and discards any path in `baseURL`. With
`baseURL: '.../organisatorv1'` the suite ran against `/login` on the site root, which 301s
to `AnmeldungsPortal` — a different site entirely, serving Salesforce's own login form.
Every spec in the live suite spells out `/organisatorv1/...` instead.

### A test that passes without the fix

The login-button test passes with and without `AUTH_PROBE_TIMEOUT_MS`: the submit button
is released after ~1.3 s in both cases. The bound is insurance against a promise that
never settles, not a fix for an observed failure — and the tests say so. Keep it that way
rather than claiming it solves something the measurements do not support.

---

## Test commands

Run the bundle suites from the bundle directory, not the project root:

```bash
cd frontend/force-app/main/default/uiBundles/frontend
npx vitest run
npx playwright test
```

The same trap exists in `backend`: `npm test` in `backend/` runs `sfdx-lwc-jest` (Jest) but
the tests are Vitest and fail to load. Use
`cd backend/force-app/main/default/uiBundles/backend && npx vitest run` (247 tests).

---

## Three bugs that kept `/me` unreachable (found 2026-10-01)

All three were latent because the endpoint had never returned a row to anyone. They are
recorded because each one has a non-obvious cause that costs an hour to rediscover.

### `urlMapping` needs a wildcard

```apex
@RestResource(urlMapping='/participant-portal/*')   // not '/participant-portal'
```

The frontend calls `/services/apexrest/participant-portal/me`. Without the `/*` that URL
matches no resource and answers `404 Could not find a match for URL`.

### The response body has to be returned, not stored

The class used to keep the body in a static field and never write it to
`RestContext.response`, so every call answered `200` with an empty body. Writing it
explicitly is not available here — `RestContext.response.response` does not exist on this
API version:

```text
Variable does not exist: response
```

So the method returns the object and Salesforce serialises it. Note that `@HttpGet` rejects
`Object` as a return type:

```text
HttpGet methods do not support return type of Object
```

which is why there is one `MeResponse` class carrying both the participant fields and
`code`/`message` rather than a `ParticipantView` and a `PortalErrorResponse`.

### Do not prefix the start URL again

`getSanitizedStartUrl()` used to prepend `Site.getPathPrefix()`. The SPA router already
sends paths that include the app base path, so login redirected to
`/organisatorv1/organisatorv1/`. On a Picasso site it is wrong twice over: the CustomSite
path (`/organisatorv1vforcesite`) is not the SPA path (`/organisatorv1`).

### Not enough to log in — access has to be granted

`without sharing` does not grant anything here. This org enforces Apex record sharing, so
a portal user saw `0` rows on `Participant__c` regardless. `ParticipantPortalData` now runs
`with sharing` and requires a `Participant__Share` row per portal user, created by
`ParticipantPortalSharingService`. `viewAllRecords` was rejected on purpose: combined with
the `ApiEnabled` permission set it would let every portal user read every participant row.

---

## Login and logout paths

```text
login   POST /organisatorv1/sf/api/services/apexrest/auth/login
data    GET  /organisatorv1/sf/api/services/apexrest/participant-portal/me
logout  GET  <origin>/organisatorv1vforcesite/secur/logout.jsp
```

Two URLs, not one: login and data on the Picasso prefix `/organisatorv1`, logout on the
ChatterNetwork auth prefix `/organisatorv1vforcesite`. `<origin>` is
`window.location.origin`, not `SFDC_ENV.orgUrl` — see "Where logout has to go" below.

`SFDC_ENV.apiPath` is `/organisatorv1/sf/api`, so the Data SDK prefixes
`/services/apexrest/...`. Calling `/organisatorv1/services/apexrest/...` directly returns
the SPA shell with `200` and looks like a working API while being the fallback route.

Two things that will mislead you when testing with `curl`:

- **Portal sessions cannot be checked with `Authorization: Bearer <sid>`.** The REST API
  rejects them with `INVALID_SESSION_ID: This session is not valid for use with the REST
  API`, so you always see the anonymous answer and conclude the thing you just tested works.
- **After logout, a `curl` cookie jar keeps working.** Logout is confirmed server-side
  (`AuthSession.IsCurrent = false`), but the jar still replays the old cookie. Verify logout
  in a real browser: a protected route must ask for the login again.

## Where logout has to go, and where it must not (measured 2026-10-02)

**Logout does NOT go on the Picasso path and does NOT go on the My Domain.** Only
`<origin>/organisatorv1vforcesite/secur/logout.jsp` ends a member session in this site.

Measured with a real portal session, checking `GET /organisatorv1/sf/api/services/apexrest/participant-portal/me`
**before and after** each candidate. That check is the one that matters — `/me` resolves
identity server-side from `User.ContactId` and takes no parameters, so a 200 after a
"logout" proves the session survived, whatever the status code or the redirect said.

| Candidate | Status | `/me` after | Session ended? |
|---|---|---|---|
| `<origin>/organisatorv1vforcesite/secur/logout.jsp` | 200 | **401** | **yes** |
| `<origin>/organisatorv1vforcesite/sfsites/s/logout` | 503 | 200 | no — CDN error page |
| `<myDomain>/sfsites/s/logout` | 302 → org login | 200 | **no** |
| `<myDomain>/servlet/networks/logout` | 404 | 200 | no |

Three things this corrected, all of them earlier conclusions in this file:

- **`/sfsites/s/logout` was never a logout for a portal member.** It ends the *Lightning*
  session and then bounces through `…my.salesforce.com/visualforce/session?url=…`. A member
  sees Salesforce's login page and is still authenticated to the portal — walking back into
  `/organisatorv1` logs them straight in. The `logoutUrl` metadata does not apply to it.
- **`secur/logout.jsp` was not dead.** An earlier commit removed it as "verified dead"
  because `/organisatorv1/secur/logout.jsp` is unreachable — true, and still true, because
  the app container swallows the Picasso prefix. Generalising that to the vforcesite prefix
  without evidence is what pointed logout at `/sfsites/s/logout` for a day.
- **Login and logout are not on the same surface.** Login genuinely is on
  `…vforcesite` (Salesforce's own welcome email links there). Logout is on the vforcesite
  *Aura/VF* path underneath it, not on the LWR `/sfsites/s/` path.

Where the member lands afterwards is decided by the Network `<logoutUrl>`, committed in
`networks/Organisator.network-meta.xml` — not generated by `scripts/org-setup.mjs`, because
`ensureLogoutUrl()` calls `deriveSiteName()`, which throws when a project holds more than one
`*.network-meta.xml` and `frontend/` holds two. **Its domain is sandbox-specific**; a
different org needs a different value.

No return-URL parameter is used anywhere. Measured on the My Domain endpoint, `retURL`,
`redirect`, `returnUrl`, `logoutUrl` and `startURL` all produced an identical `Location`,
the value only reappearing double-encoded inside that redirect's own `url=` echo. Reading
that echo as "the redirect was honoured" is what shipped this bug in the first place.

`SFDC_ENV` is not read for any of this. It carries `orgUrl`, `apiPath`, `basePath`,
`namespace` and `appName` — **but no community URL**, so the only correct origin available to
the client is the one it is served from.

## The static Playwright harness cannot verify logout

`playwright.config.ts` serves `dist/` over `npx serve`. Against it the suite is **flaky by
construction** — five runs of the unmodified tree produced 5, 6, 4, 7 and 5 failures out of
10, and the failing set changed between runs. Do not read a failure there as a regression
without a baseline, and do not read a pass as a result. Logout is covered by `live-guest.spec.ts`
against the real site, which needs `PORTAL_USER` and `PORTAL_PASSWORD`.

## What the live suite must assert before a rollout is called done

Three cases in `live-guest.spec.ts`, and each one exists because the cheaper check was tried
first and did not work:

| Case | Credentials | What it settles |
|---|---|---|
| `the live site serves the bundle built in this working tree` | none | **Which bundle is live.** Compares the served `assets/index-<hash>.js` against the local `dist/index.html` — never a pinned hash, which would break for the wrong reason on the next deploy. |
| `signing out lands on this app's login page, not on the org login` | user | The logout landing, and that the session really ended. Host **and** path in one auto-retrying predicate, then a protected route must ask for the login again. |
| `a second portal user never sees the first user's participant` | user + user2 | **Suspended, not passing.** Identity resolution does not leak across participants. See below. |

Four things that took a wrong turn and are worth not repeating:

- **A missing `dist/` fails instead of skipping.** A skip is the "green suite that proves
  nothing" this repo keeps documenting: with no local build there is nothing to compare
  against, so the rollout state is unproven, and a skip hides exactly that.
- **The landing assertion must come first and must retry.** Reading `page.url()`
  synchronously after the Sign Out click races the navigation — it reads the pre-logout URL
  and fails for a reason unrelated to the bug. Two separate checks can also straddle two of
  the three navigations this flow makes.
- **Host and path belong in one predicate.** The org login also serves
  `/organisatorv1/login`, so a path-only check passes while the member sits on the wrong
  page — which is how the DevHub-login bug shipped in the first place.

**The cross-participant case is suspended, and that is not the same as passing.** There are no
credentials for a second portal user. The *evidence* it would check already exists at the
service level — `backend/docs/portal-deploy-status.md:205-211` records both directions, both
shares present → both users 200 with their own row, probe share revoked → 404. What the
browser case adds is the UI surface: that the page renders nothing foreign even when the
response-level check is green.

Do not read the green run as covering it. It sits in its own `describe.skip` block with that
reason written out, and no env variable can switch it on. To re-enable: set a portal password
for `probe.mixeddml2.1790159877908@example.invalid` (documented at `portal-deploy-status.md:161-166`,
`System.setPassword` via Execute Anonymous), drop the `.skip`, and restore
`PORTAL_USER2`/`PORTAL_PASSWORD2`.

**What that case cannot prove even once re-enabled**, so nobody widens the claim later: `/me`
accepts no parameter and resolves identity server-side from `User.ContactId`, so there is no
place to substitute an id and the classic injection test is not available. A probe through
`/services/data/...` would be worthless — Experience Cloud sessions are rejected there with
`INVALID_SESSION_ID`, so such an assertion would pass unconditionally.

Verified negative controls for the bundle case (2026-10-02, re-run them if you touch it):

```text
dist/index.html pointed at a fake hash  -> 1 failed  (Expected index-STALE0000000.js, Received index-CwIPKROn.js)
dist/ moved away                        -> 1 failed  ("is missing — run `npm run build` first", not skipped)
dist/ restored                          -> 1 passed
```

## Sandbox gotchas worth knowing before you waste a day

- **Criteria-Based Sharing Rules do not evaluate `$User` here.** `Portal_User__c =
  $User.UserRecord.Id` and `= $User.Id` are both stored and displayed, and both match zero
  rows — every portal user gets `NO_PARTICIPANT`. A static user id works. Measured, not
  assumed.
- **Creating a CustomField via the Metadata API fails silently here.** The deploy reports
  `Created`, `describe` does not show the field. New fields must be created once in Setup.
- **`SharingReason`, `SharingCriteriaRule` and `SharingGuestRule` are not in the CLI
  registry**, so they can be neither deployed nor retrieved. Create them in Setup.
- **Experience Cloud sessions do not work against `/services/data/...`**, so the spike's
  planned negative test (a SOQL read as a portal user) cannot be run that way. Test
  through `/me` with real portal sessions instead.
- **Some Setup sections exist only in Salesforce Classic.** Apex Sharing Reasons is the one
  we hit: it is absent from Lightning Object Manager entirely, so a search there comes up
  empty and reads as an org defect. Switch the whole UI (`Setup → Switch to Salesforce
  Classic`), then `Build → Create → Objects`. Needed right now for the site's login page,
  see below.
- **The guest CSRF endpoint answers `403 API_DISABLED_FOR_ORG`** — Chatter Connect is off
  for the guest profile. The platform SDK fetches a CSRF token before every protected
  request, so a guest pays for that before anything else. A guest cannot reach GraphQL
  either: `POST /organisatorv1/sf/api/graphql` answers `401` with a 5-byte empty body.
  This is why `AuthContext` bounds the probe with `AUTH_PROBE_TIMEOUT_MS`. Note the bound
  is a safety net, not a fix for an observed hang: the submit button is released after
  ~1.3 s on the live site, with or without it.

---

## Portal access: managed sharing, not a sharing rule (2026-10-01)

`Participant__c` is `externalSharingModel = Private` and this org enforces Apex record
sharing, so `without sharing` grants nothing — a portal user saw `0` rows. Access is now a
`Participant__Share` Read row per portal user, created by
`ParticipantPortalSharingService` from the `ParticipantPortalSharing` trigger.

Two independent layers guard `/me`:

1. **Record-level sharing** — the class runs `with sharing`, so the query cannot see
   another participant at all.
2. **Identity filter** — `resolveForPortalUser()` additionally asserts
   `Portal_User__c = UserInfo.getUserId()`, else **403 `PORTAL_ACCESS_NOT_GRANTED`**.

Three things to know before changing this:

- **The RowCause is `Portal_Access__c`, an Apex Sharing Reason, and it exists only in
  Salesforce Classic.** In Lightning → Object Manager → Participant the entry is missing
  entirely, which reads like an org defect but is not. Create it via
  `Setup → Switch to Salesforce Classic → Build → Create → Objects → Participant →
  Apex Sharing Reasons → New`, Label `Portal Access`, Name `Portal_Access`.
  It is what separates the portal's shares from an administrator's: with it, a `Manual`
  share on the same row pointing at the same user is left alone even when the release
  target changes. That case was indistinguishable before the reason existed.
  `ApexSharingReason` is not in the `@salesforce/cli` registry, so it is a manual step and
  `PORTAL_ROW_CAUSE` in the service is the one place to change.
- **`RowCause` is not a writable field** (`Field is not writeable:
  Participant__Share.RowCause`), so shares cannot be converted when the reason changes.
  Delete the old ones and run `ParticipantPortalSharingService.synchroniseAll()`.
- **A share to an *internal* user fails** with
  `FIELD_INTEGRITY_EXCEPTION: trivial share level Read, for organization with default level Edit`.
  `sharingModel = ReadWrite` means the internal default is Edit, so Read is trivial there.
  External portal users get Read fine. Do not "fix" this by raising the level — it would
  grant internal users write access.

**Apex tests cannot insert a share row at all**, at any level: the test context applies the
internal default and refuses anything at or below it, `Edit` included, while `All` is
rejected with `INVALID_ACCESS_LEVEL`. The service therefore computes its diff in a separate
`planFor()` step that does no DML, and the tests assert on that plan. Share rows are only
ever inserted in production. Do not "fix" a failing share test by writing the row in the
test — it cannot work.
