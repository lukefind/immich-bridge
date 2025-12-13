# Immich Bridge for Nextcloud

Browse your Immich photo library directly from within Nextcloud.

## Features

- **All Photos View**: Browse all your photos with filters (favorites, star rating, year)
- **Timeline Navigation**: Year-based timeline scroller for quick navigation
- **Browse Albums**: View all your Immich albums with sorting options
- **Lightbox Viewer**: Full-screen image viewer with keyboard navigation (Nextcloud Memories style)
- **Save to Nextcloud**: Save individual photos or entire albums to your Nextcloud files
- **Responsive Design**: Works on desktop and mobile devices

## Requirements

- Nextcloud 27-32
- PHP 8.0 or higher
- An Immich server with API access

## Installation

### Standard Nextcloud

1. Copy the `immich_nc_app` folder to your Nextcloud `apps/` or `custom_apps/` directory
2. Enable the app:
   ```bash
   php occ app:enable immich_nc_app
   ```

### Nextcloud AIO

1. Copy to the custom apps volume:
   ```bash
   sudo cp -r immich_nc_app /var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/
   sudo chown -R www-data:www-data /var/lib/docker/volumes/nextcloud_aio_nextcloud/_data/custom_apps/immich_nc_app
   ```

2. Enable the app:
   ```bash
   sudo docker exec -u www-data nextcloud-aio-nextcloud php occ app:enable immich_nc_app
   ```

See `docs/nextcloud-aio-playbook.md` for detailed AIO deployment instructions.

## Configuration

1. Open "Immich Bridge" from the Nextcloud apps menu
2. Enter your Immich server base URL (e.g., `https://immich.example.com/api`)
3. Enter your Immich API key
4. Click "Connect"

### Getting an Immich API Key

1. Log into your Immich instance
2. Go to **Account Settings** → **API Keys**
3. Click **New API Key**, name it (e.g., "Nextcloud Bridge")
4. Copy the generated key

## Usage

### All Photos
- Default view showing all your photos
- Filter by: Favorites (♥), Star Rating (≥1★ to 5★), Year
- Timeline scroller on the right for quick year navigation
- Click "Load More" to load additional photos

### Albums
- Sort by: Newest Photos, Recently Updated, Name, Photo Count
- Toggle ascending/descending with the ↑/↓ button
- Click an album to view its photos
- "Save to Nextcloud" button saves all album photos to a folder

### Lightbox
- Click any photo to open full-screen viewer
- Keyboard: ← → to navigate, Escape to close
- Actions: Open in Immich, Download, Save to Nextcloud, Share

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get configuration status |
| POST | `/api/config` | Save Immich configuration |
| POST | `/api/config/delete` | Delete configuration |
| GET | `/api/albums` | List all albums |
| GET | `/api/albums/timeline` | Get photos with filters |
| GET | `/api/albums/{id}/assets` | List assets in album |
| GET | `/api/assets/{id}/thumbnail` | Get thumbnail |
| GET | `/api/assets/{id}/preview` | Get preview (~1440px) |
| GET | `/api/assets/{id}/original` | Get original file |
| POST | `/api/assets/{id}/save-to-nextcloud` | Save to Nextcloud |

## Security

- **User isolation**: Each user's Immich credentials stored separately
- **CSRF protection**: All POST endpoints require CSRF token
- **Authentication**: All endpoints require Nextcloud login
- **Input validation**: URL validation, filename sanitization, path traversal protection
- **Proxied requests**: All Immich API calls go through Nextcloud server (no direct client access)

## Limitations

- **Read-only**: No upload, delete, or edit functionality in Immich
- **No sync**: Manual refresh required for new photos
- **Share via Talk**: Not yet implemented

## License

AGPL-3.0-or-later

## Contributing

Contributions welcome! Please open issues or pull requests.
