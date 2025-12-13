# AGENTS.md

This is a living “agent handbook” for working on **Immich Bridge** (Nextcloud app `immich_nc_app`).

Goals:
- Capture **non-obvious learnings** so we don’t repeat failures.
- Provide a **fast, correct workflow** for development + deployment to **Nextcloud AIO**.
- Record **known issues** and the exact fix/verification steps.

This document complements (and should stay consistent with):
- `docs/nextcloud-aio-playbook.md`

---

## 1) Non-negotiable invariants

- App folder name == app id
  - Folder: `immich_nc_app`
  - `appinfo/info.xml`: `<id>immich_nc_app</id>`
  - `lib/AppInfo/Application.php`: `APP_ID = 'immich_nc_app'`
- Nextcloud version compatibility must match the server.
- Assume AIO may not ship all `occ` commands (e.g. `migrations:migrate`, `db:execute-sql`).

---

## 2) Deployment (Nextcloud AIO)

Authoritative notes: `docs/nextcloud-aio-playbook.md`

### 2.1 App install path

AIO custom apps path:
- `/var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/immich_nc_app/`

### 2.2 Reliable deploy sequence

1) `git pull origin main` on the server clone
2) Copy into the AIO volume
3) Fix ownership
4) If **routes changed**, disable/enable the app
5) Hard refresh the browser

Example:
- `sudo cp -r ~/immich_nc_app/* /var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/immich_nc_app/`
- `sudo chown -R www-data:www-data /var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/immich_nc_app`

Reload routes after changing `appinfo/routes.php`:
- `sudo docker exec -u www-data nextcloud-aio-nextcloud php occ app:disable immich_nc_app`
- `sudo docker exec -u www-data nextcloud-aio-nextcloud php occ app:enable immich_nc_app`

---

## 3) Frontend (CSP-safe rules)

- Do not load dependencies from CDNs.
- Avoid runtime template compilation (no `eval` / `new Function`).
  - Use Vue render functions (`h()`) only.
- Always include assets via Nextcloud helpers in `templates/main.php`:
  - `style('immich_nc_app', 'style');`
  - `script('immich_nc_app', 'vue.global.prod');`
  - `script('immich_nc_app', 'main');`

---

## 4) API rules (CSRF + methods)

- GET endpoints called by `fetch` often need `@NoCSRFRequired`.
  - Symptom: `412 Precondition Failed`
- POST must include header `requesttoken: OC.requestToken`.
- Prefer POST over DELETE for compatibility with Nextcloud routing.

---

## 5) Routing / cache gotchas

If a route “should exist” but you still get HTML 404 or method mismatch:

- After any `appinfo/routes.php` change:
  - Disable/enable the app.
  - Hard refresh.

### Symptom: API endpoint returns Nextcloud “Page not found” HTML

- Meaning: request never hit your controller; route not registered or server code isn’t updated.
- Fix checklist:
  - Verify `appinfo/routes.php` exists in the AIO volume.
  - Disable/enable app.
  - Hard refresh.

---

## 6) Immich connectivity invariants

- The **Nextcloud container** must be able to reach Immich.
- Always test from inside the container:
  - `sudo docker exec nextcloud-aio-nextcloud curl -s https://<immich-host>/api/server/version`
- Base URL must end with `/api`.

---

## 7) UX conventions (project direction)

### Navigation
- Use a left navigation list for sections.
- Avoid “tab-looking buttons” for navigation.

### Actions
- Put destructive actions (Disconnect) inside Settings.
- Keep “Refresh” as a contextual action in the Albums view, not global.

### Nextcloud integration
- Prefer Nextcloud UI primitives:
  - Toasts: `OC.Notification.showTemporary(...)`
  - Confirms: `OC.dialogs.confirm(...)`
- Prefer Nextcloud theme variables where possible.

---

## 8) Lightbox / media rendering learnings

- A Nextcloud app route like `/apps/immich_nc_app/api/...` returning HTML “Page not found” indicates **route registration/deploy mismatch**, not an image decode issue.
- Make the lightbox robust by falling back image sources (e.g. `preview → thumbnail → original`) on `img.onerror`.
- If the lightbox appears under the Nextcloud top bar:
  - If `z-index` doesn't work, the lightbox may be inside a stacking context (e.g. parent has `transform`).
  - Fix: render the lightbox using Vue `Teleport` to `document.body`.

---

## 9) Release checklist (before asking for verification)

- If you added/changed routes:
  - Confirm the new route exists in `appinfo/routes.php` in the deployed AIO volume
  - Disable/enable app
- Hard refresh browser
- Verify:
  - config load/save
  - album list loads
  - thumbnails load
  - lightbox loads an image

---

## 10) Learning log (append-only)

### 2025-12-13 (Session 1)
- Added `/api/assets/{id}/preview` route.
- Observed: hitting `/preview` returned Nextcloud HTML "Page not found" on the server.
  - Root cause: route not active in deployed instance (stale route cache / mismatched deployed code).
  - Fix: ensure AIO volume updated + disable/enable app + hard refresh.
- Added lightbox image fallback chain to avoid blank lightbox if preview route is unavailable.
- Observed: lightbox overlay can still appear behind the Nextcloud top bar even with high `z-index`.
  - Root cause: stacking context / transformed parent inside Nextcloud layout.
  - Fix: Teleport the lightbox to `document.body`.
- Observed: Immich `?size=preview` and `?key=preview` parameters return small thumbnails (~14KB) not large previews.
  - Root cause: Immich thumbnail endpoint doesn't reliably support preview size variants across versions.
  - Fix: Load `/original` directly in lightbox for guaranteed full quality. Accept the larger file size tradeoff.
- Observed: Loading full original is too slow/large for lightbox viewing.
  - Root cause: Original files can be many MB.
  - Fix: Use Immich `GET /assets/{id}/thumbnail?size=preview` which returns ~1440px large preview (~100-500KB). This is the correct Immich API parameter per their docs.
- Observed: Lightbox action buttons rendered with blue background (looked bad).
  - Root cause: Nextcloud or browser default button styles overriding custom styles.
  - Fix: Use `!important` on background/border/color and dark pill-shaped design with blur backdrop.
- Added All Photos view with filters (favorites, rating, tags) using Immich search/metadata API.

### 2025-12-13 (Session 2)
- Switched from Immich timeline API to `POST /search/metadata` for All Photos view.
  - Timeline API (`/timeline/buckets`, `/timeline/bucket`) had inconsistent response structures.
  - Search metadata API is more reliable and supports rating filter.
- Added star rating filter (≥1★ to 5★) using Immich's rating field.
- Added year filter with timeline scroller on right side.
- Added "Load More" pagination (500 photos per page).
- Lightbox redesigned to match Nextcloud Memories style:
  - Solid header bar with filename and counter
  - Blue rounded square buttons (44x44px) for actions
  - Blue nav arrows on sides
- Default view changed from Albums to All Photos.
- Added "Save Album to Nextcloud" feature - saves all photos to a folder (creates folder if needed).
- Album sort options: Newest Photos (by endDate), Recently Updated, Name, Photo Count.
- Added ascending/descending toggle button for album sort.
- Observed: `key` parameter in thumbnail requests caused 401 errors.
  - Root cause: Immich interprets `key` as a share key.
  - Fix: Removed `key` parameter from thumbnail requests.
- Observed: Save to Nextcloud failed with "Target folder does not exist".
  - Root cause: Album folder path didn't exist.
  - Fix: Create folder path recursively before saving files.

## 11) Security audit (2025-12-13)

✅ **Secure practices verified:**
- Authentication checks on all endpoints (`getUserId()` returns 401 if not logged in)
- CSRF protection on POST endpoints (only GET has `@NoCSRFRequired`)
- Input validation: URL with `filter_var()`, filename with `basename()`
- User isolation: credentials stored per-user in database
- No SQL injection: uses Nextcloud ORM/Entity mapper
- Path traversal protection: `basename()` on filenames, Nextcloud file API for paths
- API key not exposed in responses (getConfig doesn't return it)
- All Immich requests proxied through Nextcloud server (no direct client access)
