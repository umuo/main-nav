#!/usr/bin/env python3
"""Safely manage any compatible deployed Main Nav instance through its HTTP API."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


class NavError(RuntimeError):
    pass


class NavClient:
    def __init__(
        self,
        base_url: str | None,
        timeout: float,
        api_token: str | None,
        cookie: str | None,
    ) -> None:
        if not base_url or not base_url.strip():
            raise NavError("Provide the deployment URL with --base-url or NAV_BASE_URL")
        normalized_base_url = base_url.strip()
        parsed = urlsplit(normalized_base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise NavError("Base URL must be an absolute HTTP/HTTPS URL")
        self.base_url = normalized_base_url.rstrip("/")
        self.timeout = timeout
        self.api_token = api_token.strip() if api_token and api_token.strip() else None
        self.cookie = self._normalize_cookie(cookie)

    @staticmethod
    def _normalize_cookie(cookie: str | None) -> str | None:
        if not cookie:
            return None
        value = cookie.strip()
        if not value:
            return None
        return value if "=" in value else f"auth_token={value}"

    def request(
        self,
        method: str,
        path: str,
        payload: Any | None = None,
        *,
        authenticated: bool = False,
        accepted_error_statuses: frozenset[int] = frozenset(),
    ) -> Any:
        if authenticated and not self.api_token and not self.cookie:
            raise NavError(
                "Authenticated operation requires NAV_ADMIN_TOKEN. "
                "Alternatively, use an authenticated browser or an explicit temporary NAV_AUTH_COOKIE."
            )

        headers = {"Accept": "application/json", "User-Agent": "manage-main-nav/1.0"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if authenticated:
            if self.api_token:
                headers["Authorization"] = f"Bearer {self.api_token}"
            elif self.cookie:
                headers["Cookie"] = self.cookie

        request = Request(f"{self.base_url}{path}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8")
                return json.loads(body) if body else None
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            try:
                parsed_body = json.loads(body)
            except json.JSONDecodeError:
                parsed_body = None
            if error.code in accepted_error_statuses and parsed_body is not None:
                return parsed_body
            detail = (
                parsed_body.get("error", body)
                if isinstance(parsed_body, dict)
                else body or error.reason
            )
            raise NavError(f"HTTP {error.code}: {detail}") from error
        except URLError as error:
            raise NavError(f"Request failed: {error.reason}") from error
        except json.JSONDecodeError as error:
            raise NavError("Server returned a non-JSON response") from error

    def sites(self) -> list[dict[str, Any]]:
        result = self.request("GET", "/api/sites")
        if not isinstance(result, list):
            raise NavError("Unexpected websites response")
        return result

    def categories(self) -> list[dict[str, Any]]:
        result = self.request("GET", "/api/categories")
        if not isinstance(result, list):
            raise NavError("Unexpected categories response")
        return result


def emit(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))


def normalize_site_url(value: str) -> str:
    normalized = value.strip()
    if "://" not in normalized:
        normalized = f"https://{normalized}"
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise NavError("Site URL must use HTTP or HTTPS and include a hostname")
    return normalized


def exact_matches(items: list[dict[str, Any]], reference: str, fields: tuple[str, ...]) -> list[dict[str, Any]]:
    folded = reference.strip().casefold()
    return [
        item for item in items
        if any(str(item.get(field, "")).casefold() == folded for field in fields)
    ]


def resolve_site(client: NavClient, reference: str) -> dict[str, Any]:
    matches = exact_matches(client.sites(), reference, ("id", "title", "url"))
    if not matches:
        raise NavError(f"Site not found: {reference}")
    if len(matches) > 1:
        raise NavError(f"Site reference is ambiguous; use an ID: {reference}")
    return matches[0]


def resolve_category(client: NavClient, reference: str) -> dict[str, Any]:
    matches = exact_matches(client.categories(), reference, ("id", "name"))
    if not matches:
        raise NavError(f"Category not found: {reference}")
    if len(matches) > 1:
        raise NavError(f"Category reference is ambiguous; use an ID: {reference}")
    return matches[0]


def category_names(client: NavClient) -> dict[str, str]:
    return {str(category["id"]): str(category["name"]) for category in client.categories()}


def list_sites(client: NavClient, args: argparse.Namespace) -> None:
    sites = client.sites()
    category_map = category_names(client)
    if args.category:
        category_id = resolve_category(client, args.category)["id"]
        sites = [site for site in sites if site.get("categoryId") == category_id]
    if args.query:
        needle = args.query.casefold()
        sites = [
            site for site in sites
            if needle in str(site.get("title", "")).casefold()
            or needle in str(site.get("url", "")).casefold()
            or needle in str(site.get("description", "")).casefold()
        ]
    enriched = [
        {**site, "categoryName": category_map.get(str(site.get("categoryId")), "")}
        for site in sorted(sites, key=lambda value: str(value.get("title", "")).casefold())
    ]
    emit({"baseUrl": client.base_url, "count": len(enriched), "sites": enriched})


def get_site(client: NavClient, args: argparse.Namespace) -> None:
    site = resolve_site(client, args.site)
    category_map = category_names(client)
    emit({**site, "categoryName": category_map.get(str(site.get("categoryId")), "")})


def list_categories(client: NavClient, _args: argparse.Namespace) -> None:
    sites = client.sites()
    counts: dict[str, int] = {}
    for site in sites:
        category_id = str(site.get("categoryId", ""))
        counts[category_id] = counts.get(category_id, 0) + 1
    categories = [
        {**category, "siteCount": counts.get(str(category["id"]), 0)}
        for category in client.categories()
    ]
    emit({"baseUrl": client.base_url, "count": len(categories), "categories": categories})


def mutation_preview(method: str, path: str, payload: Any | None, **context: Any) -> None:
    emit({"dryRun": True, "method": method, "path": path, "payload": payload, **context})


def add_site(client: NavClient, args: argparse.Namespace) -> None:
    payload: dict[str, Any] = {
        "title": args.title.strip(),
        "url": normalize_site_url(args.url),
        "description": args.description or "",
        "iconUrl": args.icon_url or "",
    }
    if not payload["title"]:
        raise NavError("Site title cannot be empty")
    if args.category:
        payload["categoryId"] = resolve_category(client, args.category)["id"]
    if args.dry_run:
        mutation_preview("POST", "/api/sites", payload)
        return
    created = client.request("POST", "/api/sites", payload, authenticated=True)
    verified = next((site for site in client.sites() if site.get("id") == created.get("id")), None)
    if not verified:
        raise NavError("Create response succeeded, but the new site was not found during verification")
    emit({"success": True, "created": verified, "verified": True})


def update_site(client: NavClient, args: argparse.Namespace) -> None:
    before = resolve_site(client, args.site)
    updates: dict[str, Any] = {}
    if args.title is not None:
        title = args.title.strip()
        if not title:
            raise NavError("Site title cannot be empty")
        updates["title"] = title
    if args.url is not None:
        updates["url"] = normalize_site_url(args.url)
    if args.description is not None:
        updates["description"] = args.description
    if args.icon_url is not None:
        updates["iconUrl"] = args.icon_url
    if args.category is not None:
        updates["categoryId"] = resolve_category(client, args.category)["id"]
    if not updates:
        raise NavError("No update fields were provided")
    path = f"/api/sites/{quote(str(before['id']), safe='')}"
    if args.dry_run:
        mutation_preview("PUT", path, updates, before=before, after={**before, **updates})
        return
    client.request("PUT", path, updates, authenticated=True)
    after = resolve_site(client, str(before["id"]))
    if any(after.get(key) != value for key, value in updates.items()):
        raise NavError("Update response succeeded, but requested fields failed verification")
    emit({"success": True, "before": before, "after": after, "verified": True})


def delete_site(client: NavClient, args: argparse.Namespace) -> None:
    site = resolve_site(client, args.site)
    path = f"/api/sites/{quote(str(site['id']), safe='')}"
    if args.dry_run:
        mutation_preview("DELETE", path, None, target=site)
        return
    if not args.confirm:
        raise NavError("Deleting a site requires --confirm after reviewing a dry run")
    client.request("DELETE", path, authenticated=True)
    if any(candidate.get("id") == site.get("id") for candidate in client.sites()):
        raise NavError("Delete response succeeded, but the site still exists")
    emit({"success": True, "deleted": site, "verified": True})


def add_category(client: NavClient, args: argparse.Namespace) -> None:
    name = args.name.strip()
    if not name:
        raise NavError("Category name cannot be empty")
    if exact_matches(client.categories(), name, ("name",)):
        raise NavError(f"A category already uses this name: {name}")
    payload = {"name": name}
    if args.dry_run:
        mutation_preview("POST", "/api/categories", payload)
        return
    created = client.request("POST", "/api/categories", payload, authenticated=True)
    verified = next((item for item in client.categories() if item.get("id") == created.get("id")), None)
    if not verified:
        raise NavError("Create response succeeded, but the category was not found during verification")
    emit({"success": True, "created": verified, "verified": True})


def rename_category(client: NavClient, args: argparse.Namespace) -> None:
    before = resolve_category(client, args.category)
    name = args.name.strip()
    if not name:
        raise NavError("Category name cannot be empty")
    duplicates = [
        item for item in exact_matches(client.categories(), name, ("name",))
        if item.get("id") != before.get("id")
    ]
    if duplicates:
        raise NavError(f"A category already uses this name: {name}")
    path = f"/api/categories/{quote(str(before['id']), safe='')}"
    payload = {"name": name}
    if args.dry_run:
        mutation_preview("PUT", path, payload, before=before, after={**before, **payload})
        return
    client.request("PUT", path, payload, authenticated=True)
    after = resolve_category(client, str(before["id"]))
    if after.get("name") != name:
        raise NavError("Rename response succeeded, but the category failed verification")
    emit({"success": True, "before": before, "after": after, "verified": True})


def delete_category(client: NavClient, args: argparse.Namespace) -> None:
    category = resolve_category(client, args.category)
    categories = client.categories()
    if category.get("id") == "default":
        raise NavError("The default category is protected")
    if len(categories) <= 1:
        raise NavError("The final category cannot be deleted")
    affected = [site for site in client.sites() if site.get("categoryId") == category.get("id")]
    path = f"/api/categories/{quote(str(category['id']), safe='')}"
    if args.dry_run:
        mutation_preview(
            "DELETE",
            path,
            None,
            target=category,
            affectedSiteCount=len(affected),
            affectedSites=[{"id": site.get("id"), "title": site.get("title")} for site in affected],
            warning="Affected sites will be reassigned to an unspecified remaining category",
        )
        return
    if not args.confirm:
        raise NavError("Deleting a category requires --confirm after reviewing a dry run")
    client.request("DELETE", path, authenticated=True)
    remaining = client.categories()
    if any(item.get("id") == category.get("id") for item in remaining):
        raise NavError("Delete response succeeded, but the category still exists")
    affected_ids = {site.get("id") for site in affected}
    reassigned = [site for site in client.sites() if site.get("id") in affected_ids]
    emit({
        "success": True,
        "deleted": category,
        "affectedSiteCount": len(affected),
        "reassignedSites": reassigned,
        "verified": True,
    })


def import_sites(client: NavClient, args: argparse.Namespace) -> None:
    try:
        payload = json.loads(Path(args.file).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise NavError(f"Could not read import file: {error}") from error
    if not isinstance(payload, list):
        raise NavError("Import file must contain a JSON array")
    valid = [item for item in payload if isinstance(item, dict) and item.get("title") and item.get("url")]
    invalid_count = len(payload) - len(valid)
    if args.dry_run:
        mutation_preview(
            "POST",
            "/api/sites/import",
            valid,
            validCount=len(valid),
            skippedCount=invalid_count,
        )
        return
    before_ids = {site.get("id") for site in client.sites()}
    result = client.request("POST", "/api/sites/import", valid, authenticated=True)
    added = [site for site in client.sites() if site.get("id") not in before_ids]
    if len(added) != result.get("count"):
        raise NavError("Import count did not match the verified number of new sites")
    emit({"success": True, "result": result, "added": added, "skippedCount": invalid_count, "verified": True})


def check_site(client: NavClient, args: argparse.Namespace) -> None:
    site = resolve_site(client, args.site)
    payload = {"id": site["id"]}
    if args.dry_run:
        mutation_preview("POST", "/api/monitor/check", payload, target=site)
        return
    result = client.request(
        "POST",
        "/api/monitor/check",
        payload,
        authenticated=True,
        accepted_error_statuses=frozenset({422}),
    )
    verified = resolve_site(client, str(site["id"]))
    emit({
        "success": result.get("reason") != "unsafe-url",
        "result": result,
        "site": verified,
        "verified": True,
    })


def add_site_fields(parser: argparse.ArgumentParser, *, create: bool) -> None:
    parser.add_argument("--title", required=create)
    parser.add_argument("--url", required=create)
    parser.add_argument("--description")
    parser.add_argument("--icon-url")
    parser.add_argument("--category", help="Exact category ID or name")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("NAV_BASE_URL"),
        help="Deployment base URL (or set NAV_BASE_URL)",
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--dry-run", action="store_true", help="Preview a mutation without sending it")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_sites_parser = subparsers.add_parser("list-sites")
    list_sites_parser.add_argument("--query")
    list_sites_parser.add_argument("--category")
    list_sites_parser.set_defaults(handler=list_sites)

    get_site_parser = subparsers.add_parser("get-site")
    get_site_parser.add_argument("site", help="Exact site ID, title, or URL")
    get_site_parser.set_defaults(handler=get_site)

    list_categories_parser = subparsers.add_parser("list-categories")
    list_categories_parser.set_defaults(handler=list_categories)

    add_site_parser = subparsers.add_parser("add-site")
    add_site_fields(add_site_parser, create=True)
    add_site_parser.set_defaults(handler=add_site)

    update_site_parser = subparsers.add_parser("update-site")
    update_site_parser.add_argument("site", help="Exact site ID, title, or URL")
    add_site_fields(update_site_parser, create=False)
    update_site_parser.set_defaults(handler=update_site)

    delete_site_parser = subparsers.add_parser("delete-site")
    delete_site_parser.add_argument("site", help="Exact site ID, title, or URL")
    delete_site_parser.add_argument("--confirm", action="store_true")
    delete_site_parser.set_defaults(handler=delete_site)

    add_category_parser = subparsers.add_parser("add-category")
    add_category_parser.add_argument("--name", required=True)
    add_category_parser.set_defaults(handler=add_category)

    rename_category_parser = subparsers.add_parser("rename-category")
    rename_category_parser.add_argument("category", help="Exact category ID or name")
    rename_category_parser.add_argument("--name", required=True)
    rename_category_parser.set_defaults(handler=rename_category)

    delete_category_parser = subparsers.add_parser("delete-category")
    delete_category_parser.add_argument("category", help="Exact category ID or name")
    delete_category_parser.add_argument("--confirm", action="store_true")
    delete_category_parser.set_defaults(handler=delete_category)

    import_parser = subparsers.add_parser("import-sites")
    import_parser.add_argument("--file", required=True)
    import_parser.set_defaults(handler=import_sites)

    check_parser = subparsers.add_parser("check-site")
    check_parser.add_argument("site", help="Exact site ID, title, or URL")
    check_parser.set_defaults(handler=check_site)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        client = NavClient(
            args.base_url,
            args.timeout,
            os.environ.get("NAV_ADMIN_TOKEN"),
            os.environ.get("NAV_AUTH_COOKIE"),
        )
        args.handler(client, args)
        return 0
    except NavError as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
