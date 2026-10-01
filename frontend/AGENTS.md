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
logout  GET  <orgUrl>/sfsites/s/logout?site=Organisator&retURL=<startURL>
```

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
