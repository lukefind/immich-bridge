# Immich Bridge / Nextcloud AIO Playbook (Rules + Troubleshooting)

This document is a living guide for building and deploying this Nextcloud app on **Nextcloud AIO** without repeating the same problems.

## 1) Non-negotiable invariants (avoid 80% of breakages)

- **App folder name == app id**
  - Folder: `immich_nc_app`
  - `appinfo/info.xml`: `<id>immich_nc_app</id>`
  - `lib/AppInfo/Application.php`: `APP_ID = 'immich_nc_app'`
  - Routes and template helpers use the same ID.

- **Nextcloud version compatibility must match your server**
  - If your server is Nextcloud 32.x, `info.xml` must allow it (e.g. `max-version="32"`).

- **Never rely on commands that your AIO build may not ship**
  - On your AIO install, `occ migrations:migrate` and `occ db:execute-sql` were not available.
  - Plan deployments assuming those may not exist.

## 2) Frontend rules (CSP-safe in Nextcloud)

### CSP rule #1: Don’t load frontend dependencies from a CDN
- Loading from `unpkg.com` triggered CSP blocks.
- **Ship vendor JS locally** under `js/` and load via Nextcloud helpers.

### CSP rule #2: Avoid Vue runtime template compilation
- Vue templates can require `eval()` / `new Function()`.
- Nextcloud CSP blocks `unsafe-eval`.
- **Use Vue render functions** (`h()`) only.

### CSP rule #3: Always use Nextcloud script/style helpers
- In `templates/main.php` use:
  - `style('immich_nc_app', 'style');`
  - `script('immich_nc_app', 'vue.global.prod');`
  - `script('immich_nc_app', 'main');`

These helpers handle CSP nonces properly.

## 3) API rules (CSRF, 412, and request format)

### CSRF rule #1: GET endpoints called by fetch often need `@NoCSRFRequired`
- Symptom: **`GET ... 412 Precondition Failed`**
- Fix: annotate controller methods (GETs) with `@NoCSRFRequired`.

### CSRF rule #2: POST requests must include the request token
- Symptom: **`POST ... 412 Precondition Failed`**
- Fix: set header `requesttoken: OC.requestToken` on POST (and other state-changing requests).

### Request format rule: Don’t assume JSON body auto-parses
- Nextcloud `IRequest::getParam()` is easiest when you submit form params.
- If you send JSON bodies, ensure your controller/request parsing matches (this app currently uses JSON payloads from fetch).

## 4) Routing + cache gotchas (why routes “exist” but still 404/405)

### Prefer POST over DELETE for compatibility
- Symptom: **`DELETE ... 405 Method Not Allowed`** even when route appears in `routes.php`.
- Fix used here: create a **POST** route:
  - `POST /api/config/delete`

### After changing routes, assume you need a reload cycle
When routes don’t seem to take effect:
- Disable/enable the app:
  - `php occ app:disable immich_nc_app`
  - `php occ app:enable immich_nc_app`
- Then hard refresh your browser.

## 5) Nextcloud AIO deployment rules (custom_apps)

### Where the app must live
AIO custom apps path:
- `/var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/immich_nc_app/`

### Reliable deploy sequence
1. Pull on server
2. Copy into AIO volume
3. Fix ownership
4. Disable/enable app if you changed routes

Example:
- `git pull origin main`
- `sudo cp -r ~/immich_nc_app/* /var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/immich_nc_app/`
- `sudo chown -R www-data:www-data /var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/immich_nc_app`

### Permissions rule
- If you get weird behavior after deploy, check ownership.
- Use `www-data:www-data` in the AIO Nextcloud container volume.

## 6) Immich connectivity rules (local vs internet)

### Always test from *inside* the Nextcloud container
The browser is not the runtime. The **Nextcloud container** must reach Immich.

Test:
- `sudo docker exec nextcloud-aio-nextcloud curl -s https://photos.lukus.cloud/api/server/version`

If this returns JSON (e.g. `{ "major": ... }`), connectivity is OK.

### Base URL format
- Use a URL that ends with `/api`.
- Example: `https://photos.lukus.cloud/api`

## 7) Debug workflow (fastest way to isolate issues)

### In the browser console
- CSP errors: blocked scripts / `unsafe-eval`.
- 412 errors: CSRF token missing.
- 502/504 errors: server-to-Immich connectivity.

### In Nextcloud logs
- `sudo docker exec -u www-data nextcloud-aio-nextcloud php occ log:tail -n 50`

## 8) Database operations in AIO (when you need to reset user config)

### Identify DB type
- `sudo docker exec nextcloud-aio-nextcloud cat /var/www/html/config/config.php | grep dbtype`

On this install:
- `dbtype` is `pgsql`.

### Reset app config table (Postgres)
If you need to reset stored Immich config:
- `sudo docker exec -it nextcloud-aio-database psql -U oc_nextcloud -d nextcloud_database -c "DELETE FROM oc_immich_bridge_usercfg;"`

(Replace table name if it changes.)

## 9) UI/UX rules

- Prefer in-app viewing to new tabs.
  - Implemented: lightbox modal with keyboard navigation.
- Make layout fill Nextcloud app content area.
  - Implemented: full-page CSS constraints.

### Nextcloud top-bar overlap rule
- Symptom: header/buttons appear **under** the Nextcloud top bar (cut off / overlapping).
- Root cause: forcing viewport layout with `position:absolute; top:0;` (or global `#content` overrides) ignores Nextcloud’s own content offsets.
- Fix:
  - Don’t absolutely-position your root container to `top:0`.
  - Scope any “full height” rules to this app only (e.g. `.app-immich_nc_app #content { ... }`).
  - Prefer flex layouts within the app container and let Nextcloud control the page chrome.

## 10) “Symptom → Fix” quick table

- **Blank screen + CSP script-src-elem errors**
  - Ship JS locally + use `script()` helper.

- **`Uncaught EvalError` / `unsafe-eval` blocked**
  - Use Vue render functions only.

- **`GET ... 412 Precondition Failed`**
  - Add `@NoCSRFRequired` to GET endpoints.

- **`POST ... 412 Precondition Failed`**
  - Send `requesttoken: OC.requestToken`.

- **Routes changed but still 404/405**
  - Disable/enable app; prefer POST over DELETE.

- **Albums empty + 502 from Nextcloud**
  - `curl` from inside `nextcloud-aio-nextcloud` to Immich.
  - Use a reachable URL (often the public HTTPS endpoint).

## 11) How to keep this guide updated

When we hit a new issue, append:
- **Symptom** (exact error)
- **Root cause**
- **Fix** (exact command/code change)
- **Prevention rule** (what to do next time)
