# Immich Bridge for Nextcloud

Browse your Immich photo library directly from within Nextcloud.

## Features

- **Connect to Immich**: Configure your Immich server URL and API key
- **Browse Albums**: View all your Immich albums in a sidebar
- **View Photos**: See thumbnails in a responsive grid layout
- **View Originals**: Click any thumbnail to open the full-resolution image

## Requirements

- Nextcloud 27, 28, or 29
- PHP 8.0 or higher
- An Immich server with API access

## Installation

1. Copy the `immich_bridge` folder to your Nextcloud `apps/` directory
2. Enable the app via the Nextcloud Apps page or run:
   ```bash
   php occ app:enable immich_bridge
   ```
3. Run database migrations:
   ```bash
   php occ migrations:migrate immich_bridge
   ```

## Configuration

1. Click on "Immich Bridge" in the Nextcloud sidebar
2. Enter your Immich server base URL (e.g., `https://immich.example.com/api`)
3. Enter your Immich API key (generate one in Immich under Account Settings > API Keys)
4. Click "Save Configuration"

## Getting an Immich API Key

1. Log into your Immich instance
2. Go to **Account Settings** (click your profile icon)
3. Navigate to **API Keys**
4. Click **New API Key**
5. Give it a name (e.g., "Nextcloud Bridge")
6. Copy the generated key

## API Endpoints

The app exposes the following internal API endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get current configuration status |
| POST | `/api/config` | Save Immich configuration |
| GET | `/api/albums` | List all albums |
| GET | `/api/albums/{id}` | Get album details |
| GET | `/api/albums/{id}/assets` | List assets in an album |
| GET | `/api/assets/{id}/thumbnail` | Get asset thumbnail |
| GET | `/api/assets/{id}/original` | Get original asset |

## Security Notes

- API keys are stored in the Nextcloud database per-user
- All Immich API calls are proxied through Nextcloud (no direct client-to-Immich communication)
- The app respects Nextcloud's authentication and session management

## Limitations (V1)

- **Read-only**: No upload, delete, or edit functionality
- **Albums only**: Timeline/library view not yet implemented
- **No caching**: Thumbnails are fetched on each request (browser caching helps)

## License

AGPL-3.0-or-later

## Contributing

Contributions are welcome! Please open issues or pull requests on the project repository.
