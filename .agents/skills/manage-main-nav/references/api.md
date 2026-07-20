# Main Nav API reference

## Target and authentication

Treat the deployment base URL as required runtime input. Do not assume a domain or read a local project configuration to discover one.

Public reads require no authentication. Mutations accept either:

- `Authorization: Bearer <token>`, where the server stores the value in `ADMIN_API_TOKEN` and the CLI reads it from `NAV_ADMIN_TOKEN`; or
- the `auth_token` HttpOnly cookie issued by `POST /api/auth/login`.

The management token must contain at least 32 characters. Login with username and password also requires a fresh Cloudflare Turnstile token and therefore needs a normal browser. The CLI reads `NAV_AUTH_COOKIE` only as a backward-compatible fallback. Never place tokens, passwords, or production cookies in skill or repository files.

## Website endpoints

### `GET /api/sites`

Return all websites.

```json
[
  {
    "id": "uuid",
    "title": "Example",
    "url": "https://example.com",
    "description": "Optional",
    "iconUrl": "",
    "status": "unknown",
    "lastChecked": 0,
    "latency": 120,
    "serverStatusCode": 200,
    "serverReason": "timeout",
    "categoryId": "uuid"
  }
]
```

### `POST /api/sites`

Require authentication. Body fields:

```json
{
  "title": "Example",
  "url": "https://example.com",
  "description": "Optional",
  "iconUrl": "https://example.com/icon.png",
  "categoryId": "uuid"
}
```

`title` and `url` are required. Return the created website with HTTP 201. Monitoring fields start as unknown/empty.

### `PUT /api/sites/:id`

Require authentication. Accept partial website fields. The storage layer only persists title, URL, description, icon URL, status, last-checked time, latency, and category ID; preserve unspecified fields.

### `DELETE /api/sites/:id`

Require authentication. Return `{ "success": true }`; missing IDs return 404.

### `POST /api/sites/import`

Require authentication. Accept an array. Every valid item needs `title` and `url`. `categoryName` takes priority over `categoryId`; missing named categories are created automatically. Invalid items without title or URL are skipped. Import inserts new sites and does not deduplicate existing URLs.

```json
[
  {
    "title": "Example",
    "url": "https://example.com",
    "description": "Optional",
    "iconUrl": "",
    "categoryName": "Tools"
  }
]
```

## Category endpoints

### `GET /api/categories`

Return `{ "id", "name" }` objects. When the database has no categories, the backend creates a `default` category named `General`.

### `POST /api/categories`

Require authentication. Body: `{ "name": "Tools" }`. Return the created category with HTTP 201.

### `PUT /api/categories/:id`

Require authentication. Body: `{ "name": "New name" }`.

### `DELETE /api/categories/:id`

Require authentication. The storage layer refuses to delete the last category. It reassigns sites in the deleted category to an arbitrary remaining category before deletion. The skill and CLI additionally refuse to delete ID `default`.

## Monitoring endpoint

### `POST /api/monitor/check`

Require authentication. Body: `{ "id": "site-id" }`. Run a server-side check and persist status. A safe-but-disallowed target returns HTTP 422 with a structured offline result; authentication and infrastructure failures use other 4xx/5xx responses.

Direct API creation or editing does not automatically call this endpoint. The web admin UI does.

## Common status codes

| Status | Meaning |
| --- | --- |
| 200/201 | Successful read or mutation |
| 400 | Invalid input or rejected human verification |
| 401 | Missing or expired admin session |
| 404 | Referenced site/category does not exist |
| 422 | Monitoring target is not a safe public HTTP target |
| 429 | Login throttled; respect `Retry-After` |
| 503 | Database/authentication dependency unavailable |

## Verification rules

- After creation, confirm the returned ID exists in `GET /api/sites` or `GET /api/categories`.
- After update, compare every requested field against a fresh read.
- After deletion, confirm the ID no longer appears.
- After category deletion, list affected sites again and report their resulting category IDs.
- After import, compare collection counts and spot-check imported titles/URLs; do not rely only on the returned count.
