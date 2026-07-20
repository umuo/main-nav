---
name: manage-main-nav
description: Manage websites and categories on any deployed SentinelNav or compatible Main Nav instance using only its base URL and runtime credentials. Supports listing and searching sites, website CRUD, moving sites between categories, category CRUD, bulk import, connectivity checks, and post-change verification. Use when the user asks an agent to maintain, reorganize, audit, or update a deployed navigation page without relying on its source repository.
---

# Manage Main Nav

Manage a deployed navigation instance exclusively through its HTTPS UI and API. Do not inspect, clone, or depend on the application's source repository.

## Collect runtime inputs

Require the deployment base URL. Never assume a production domain. For mutations, use one of these authentication modes:

1. Prefer an admin API token supplied at runtime. The server stores it as `ADMIN_API_TOKEN`; the agent exposes the same value to the CLI as `NAV_ADMIN_TOKEN`.
2. If the user supplies a username and password instead, use a browser-capable tool to open the deployment, complete the normal Turnstile-protected login, and operate the admin UI in that browser session.
3. If neither an API token nor an authenticated browser is available, perform public reads only.

URL plus username and password is sufficient only when a normal browser can complete Turnstile. A headless HTTP client cannot legitimately manufacture the required human-verification token.

## Choose the execution surface

1. Use `scripts/nav_admin.py` for public reads, dry runs, and token-authenticated API mutations.
2. Use the agent's browser capability when credentials rather than an API token are available. Let Turnstile run normally and ask the user to intervene if it presents an interactive challenge.
3. Accept `NAV_AUTH_COOKIE` only as a backward-compatible alternative when the user explicitly supplies a temporary session cookie.
4. Never write directly to a database, modify deployment secrets, bypass Turnstile, or save credentials in the skill directory.

Require `NAV_BASE_URL` or `--base-url`. Confirm the resolved hostname before every mutation and never redirect a requested production change to another environment.

## Follow the management workflow

1. Read current sites and categories before every mutation.
2. Resolve names to stable IDs. Reject ambiguous exact-title matches instead of guessing.
3. Normalize site URLs to HTTP/HTTPS and verify the target category exists.
4. For destructive or bulk operations, show a dry run with exact targets and affected counts. A user's explicit delete request authorizes the named deletion; otherwise obtain confirmation before executing it.
5. Execute through the admin UI or authenticated API.
6. Read the affected collection again and report the verified final state. Do not claim success from a write response alone.

## Use the CLI

Run commands from this skill directory or use the absolute script path. Keep secrets out of command-line arguments and shell history.

```bash
export NAV_BASE_URL='https://nav.example.com'

python3 scripts/nav_admin.py list-sites
python3 scripts/nav_admin.py list-sites --query blog
python3 scripts/nav_admin.py get-site "My Blog"
python3 scripts/nav_admin.py list-categories
```

Preview mutations without authentication:

```bash
python3 scripts/nav_admin.py --dry-run add-site \
  --title "My Blog" --url "https://example.com" --category "Tools"

python3 scripts/nav_admin.py --dry-run update-site "My Blog" \
  --title "Personal Blog" --category "Personal"

python3 scripts/nav_admin.py --dry-run delete-site "My Blog"
python3 scripts/nav_admin.py --dry-run delete-category "Unused"
```

For authenticated API writes, expose the deployment's management token only for the current process environment:

```bash
export NAV_ADMIN_TOKEN='replace-with-runtime-secret'
python3 scripts/nav_admin.py add-category --name "Tools"
python3 scripts/nav_admin.py add-site --title "My Blog" --url "https://example.com" --category "Tools"
python3 scripts/nav_admin.py update-site "My Blog" --description "Personal notes"
python3 scripts/nav_admin.py delete-site "My Blog" --confirm
```

Never print, echo, persist, or commit tokens, cookies, usernames, or passwords. Do not retrieve an HttpOnly cookie from browser storage.

## Manage categories carefully

- Treat the `default` category as protected even if an older deployment does not enforce this consistently.
- Never delete the final category.
- Before deleting a category, report how many sites it contains. Compatible deployments reassign those sites to another category; the destination may not be guaranteed, so move important sites explicitly first.
- Prefer category IDs for automation and exact names for user-facing requests.

## Manage websites carefully

- Preserve fields the user did not ask to change.
- Require a title and URL when creating a site.
- Accept only `http://` and `https://` URLs. Add `https://` when the scheme is omitted.
- Use `categoryId` internally; display category names in summaries.
- Expect newly added sites to have `unknown` server status until monitoring runs.
- Do not confuse browser-side reachability with persisted server-side status.

## Handle authentication and failures

- A `401` means the API token is missing or incorrect, or the browser session is missing or expired.
- A `400 Invalid human verification` means Turnstile rejected the login attempt before credential validation.
- A `429` means login throttling is active. Respect `Retry-After`.
- A `503` means the database, authentication service, or human-verification service is unavailable; do not report it as invalid credentials.
- Treat non-JSON responses as deployment or proxy failures and report the HTTP status.

Read [references/api.md](references/api.md) before troubleshooting an API response, changing the script, or operating bulk import.

## Report results

Include the base URL, operation, resolved IDs, before/after values, affected counts, and verification result. Mention any follow-up such as running a connectivity check.

Require Python 3.10 or newer and outbound HTTPS access for the CLI. If the target does not implement the API contract in the reference, stop and report the incompatibility instead of guessing endpoints.
