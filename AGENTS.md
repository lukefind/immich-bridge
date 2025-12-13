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

### 2025-12-13
- Added `/api/assets/{id}/preview` route.
- Observed: hitting `/preview` returned Nextcloud HTML “Page not found” on the server.
  - Root cause: route not active in deployed instance (stale route cache / mismatched deployed code).
  - Fix: ensure AIO volume updated + disable/enable app + hard refresh.
- Added lightbox image fallback chain to avoid blank lightbox if preview route is unavailable.
- Observed: lightbox overlay can still appear behind the Nextcloud top bar even with high `z-index`.
  - Root cause: stacking context / transformed parent inside Nextcloud layout.
  - Fix: Teleport the lightbox to `document.body`.
