<?php

declare(strict_types=1);

namespace OCA\ImmichBridge\Controller;

use OCA\ImmichBridge\AppInfo\Application;
use OCA\ImmichBridge\Service\ImmichClient;
use OCA\ImmichBridge\Service\UserConfigService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataDisplayResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IUserSession;
use Psr\Log\LoggerInterface;

class ApiController extends Controller {

    private IUserSession $userSession;
    private UserConfigService $configService;
    private ImmichClient $immichClient;
    private IRootFolder $rootFolder;
    private LoggerInterface $logger;

    public function __construct(
        IRequest $request,
        IUserSession $userSession,
        UserConfigService $configService,
        ImmichClient $immichClient,
        IRootFolder $rootFolder,
        LoggerInterface $logger
    ) {
        parent::__construct(Application::APP_ID, $request);
        $this->userSession = $userSession;
        $this->configService = $configService;
        $this->immichClient = $immichClient;
        $this->rootFolder = $rootFolder;
        $this->logger = $logger;
    }

    /**
     * Get the current user ID
     *
     * @return string|null
     */
    private function getUserId(): ?string {
        $user = $this->userSession->getUser();
        return $user?->getUID();
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get the current user's Immich configuration
     *
     * @return JSONResponse
     */
    public function getConfig(): JSONResponse {
        $userId = $this->getUserId();
        if ($userId === null) {
            return new JSONResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
        }

        $config = $this->configService->getConfigForUser($userId);

        if ($config === null) {
            return new JSONResponse([
                'configured' => false,
                'baseUrl' => null,
            ]);
        }

        return new JSONResponse([
            'configured' => true,
            'baseUrl' => $config->getBaseUrl(),
        ]);
    }

    /**
     * @NoAdminRequired
     *
     * Save the user's Immich configuration
     *
     * @return JSONResponse
     */
    public function setConfig(): JSONResponse {
        $userId = $this->getUserId();
        if ($userId === null) {
            return new JSONResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
        }

        $baseUrl = $this->request->getParam('baseUrl', '');
        $apiKey = $this->request->getParam('apiKey', '');

        // Basic validation
        if (empty($baseUrl)) {
            return new JSONResponse(['error' => 'Base URL is required'], Http::STATUS_BAD_REQUEST);
        }

        if (empty($apiKey)) {
            $existingConfig = $this->configService->getConfigForUser($userId);
            if ($existingConfig !== null && !empty($existingConfig->getApiKey())) {
                $apiKey = $existingConfig->getApiKey();
            } else {
                return new JSONResponse(['error' => 'API Key is required'], Http::STATUS_BAD_REQUEST);
            }
        }

        // Validate URL format
        if (!filter_var($baseUrl, FILTER_VALIDATE_URL)) {
            return new JSONResponse(['error' => 'Invalid URL format'], Http::STATUS_BAD_REQUEST);
        }

        try {
            $this->configService->saveConfigForUser($userId, $baseUrl, $apiKey);
            return new JSONResponse(['success' => true]);
        } catch (\Exception $e) {
            $this->logger->error('Failed to save Immich config: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => 'Failed to save configuration'], Http::STATUS_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * @NoAdminRequired
     *
     * Delete the user's Immich configuration (logout)
     *
     * @return JSONResponse
     */
    public function deleteConfig(): JSONResponse {
        $userId = $this->getUserId();
        if ($userId === null) {
            return new JSONResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
        }

        try {
            $this->configService->deleteConfigForUser($userId);
            return new JSONResponse(['success' => true]);
        } catch (\Exception $e) {
            $this->logger->error('Failed to delete Immich config: ' . $e->getMessage(), [
                'app' => 'immich_nc_app',
            ]);
            return new JSONResponse(['error' => 'Failed to delete configuration'], Http::STATUS_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get all albums from Immich
     *
     * @return JSONResponse
     */
    public function getAlbums(): JSONResponse {
        try {
            $albums = $this->immichClient->listAlbums();

            // Transform to simplified format
            $result = array_map(function ($album) {
                return [
                    'id' => $album['id'] ?? '',
                    'title' => $album['albumName'] ?? 'Untitled',
                    'assetCount' => $album['assetCount'] ?? 0,
                    'createdAt' => $album['createdAt'] ?? null,
                    'updatedAt' => $album['updatedAt'] ?? null,
                ];
            }, $albums);

            return new JSONResponse($result);
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch albums: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Search all assets with optional filters
     *
     * @return JSONResponse
     */
    public function searchAssets(): JSONResponse {
        try {
            $filters = [];
            
            if ($this->request->getParam('isFavorite') === 'true') {
                $filters['isFavorite'] = true;
            }

            $skip = (int)($this->request->getParam('skip', 0));
            $take = (int)($this->request->getParam('take', 100));

            $assets = $this->immichClient->getAllAssets($filters, $skip, $take);
            
            // getAllAssets returns an array of assets directly
            if (!is_array($assets)) {
                $assets = [];
            }
            
            return new JSONResponse([
                'assets' => array_map(fn($a) => [
                    'id' => $a['id'] ?? '',
                    'fileName' => $a['originalFileName'] ?? $a['originalPath'] ?? 'Unknown',
                    'type' => $a['type'] ?? 'IMAGE',
                    'isFavorite' => $a['isFavorite'] ?? false,
                ], $assets),
            ]);
        } catch (\Exception $e) {
            $this->logger->error('Failed to get assets: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get all tags
     *
     * @return JSONResponse
     */
    public function getTags(): JSONResponse {
        try {
            $tags = $this->immichClient->listTags();
            return new JSONResponse(array_map(fn($t) => [
                'id' => $t['id'] ?? '',
                'name' => $t['name'] ?? $t['value'] ?? 'Unknown',
                'value' => $t['value'] ?? $t['name'] ?? '',
            ], $tags));
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch tags: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get preview-sized image for an asset (used by the lightbox)
     *
     * @param string $assetId
     * @return DataDisplayResponse|JSONResponse
     */
    public function getPreview(string $assetId): DataDisplayResponse|JSONResponse {
        try {
            $result = $this->immichClient->streamPreview($assetId);

            $response = new DataDisplayResponse($result['body']);
            $response->addHeader('Content-Type', $result['contentType']);
            $response->cacheFor(3600); // Cache for 1 hour

            return $response;
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch preview: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get a specific album from Immich
     *
     * @param string $albumId
     * @return JSONResponse
     */
    public function getAlbum(string $albumId): JSONResponse {
        try {
            $album = $this->immichClient->getAlbum($albumId);

            return new JSONResponse([
                'id' => $album['id'] ?? '',
                'title' => $album['albumName'] ?? 'Untitled',
                'assetCount' => $album['assetCount'] ?? 0,
            ]);
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch album: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get assets in an album
     *
     * @param string $albumId
     * @return JSONResponse
     */
    public function getAssets(string $albumId): JSONResponse {
        try {
            $assets = $this->immichClient->listAssetsByAlbum($albumId);

            // Transform to simplified format
            $result = array_map(function ($asset) {
                return [
                    'id' => $asset['id'] ?? '',
                    'fileName' => $asset['originalFileName'] ?? 'Unknown',
                ];
            }, $assets);

            return new JSONResponse($result);
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch assets: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get thumbnail for an asset
     *
     * @param string $assetId
     * @return DataDisplayResponse|JSONResponse
     */
    public function getThumbnail(string $assetId): DataDisplayResponse|JSONResponse {
        try {
            $size = (string) $this->request->getParam('size', '');
            $key = (string) $this->request->getParam('key', '');
            $format = (string) $this->request->getParam('format', '');

            try {
                $result = ($size !== '' || $key !== '' || $format !== '')
                    ? $this->immichClient->streamThumbnailVariant($assetId, $size, $key, $format)
                    : $this->immichClient->streamThumbnail($assetId);
            } catch (\Exception $e) {
                $result = $this->immichClient->streamThumbnail($assetId);
            }

            $response = new DataDisplayResponse($result['body']);
            $response->addHeader('Content-Type', $result['contentType']);
            $response->cacheFor(3600); // Cache for 1 hour

            return $response;
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch thumbnail: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Get original asset
     *
     * @param string $assetId
     * @return DataDisplayResponse|JSONResponse
     */
    public function getOriginal(string $assetId): DataDisplayResponse|JSONResponse {
        try {
            $result = $this->immichClient->streamOriginal($assetId);

            $response = new DataDisplayResponse($result['body']);
            $response->addHeader('Content-Type', $result['contentType']);
            $response->cacheFor(3600); // Cache for 1 hour

            return $response;
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch original: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_BAD_GATEWAY);
        }
    }

    /**
     * @NoAdminRequired
     *
     * Save asset to Nextcloud folder
     *
     * @param string $assetId
     * @return JSONResponse
     */
    public function saveToNextcloud(string $assetId): JSONResponse {
        try {
            $userId = $this->getUserId();
            if (!$userId) {
                return new JSONResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
            }

            $targetPath = $this->request->getParam('targetPath', '/');
            $fileName = $this->request->getParam('fileName', 'image.jpg');

            // Sanitize filename
            $fileName = basename($fileName);
            if (empty($fileName)) {
                $fileName = 'image_' . $assetId . '.jpg';
            }

            // Get the original image from Immich
            $result = $this->immichClient->streamOriginal($assetId);

            // Get user's folder
            $userFolder = $this->rootFolder->getUserFolder($userId);
            
            // Ensure target path exists and get the folder
            $targetPath = trim($targetPath, '/');
            if (empty($targetPath)) {
                $folder = $userFolder;
            } else {
                if (!$userFolder->nodeExists($targetPath)) {
                    return new JSONResponse(['error' => 'Target folder does not exist'], Http::STATUS_BAD_REQUEST);
                }
                $folder = $userFolder->get($targetPath);
                if ($folder->getType() !== \OCP\Files\FileInfo::TYPE_FOLDER) {
                    return new JSONResponse(['error' => 'Target is not a folder'], Http::STATUS_BAD_REQUEST);
                }
            }

            // Check if file already exists, add suffix if needed
            $finalName = $fileName;
            $counter = 1;
            $pathInfo = pathinfo($fileName);
            $baseName = $pathInfo['filename'] ?? 'image';
            $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';
            
            while ($folder->nodeExists($finalName)) {
                $finalName = $baseName . '_' . $counter . $extension;
                $counter++;
            }

            // Create the file
            $file = $folder->newFile($finalName);
            $file->putContent($result['body']);

            $this->logger->info('Saved Immich asset to Nextcloud: ' . $targetPath . '/' . $finalName, [
                'app' => 'immich_bridge',
            ]);

            return new JSONResponse([
                'success' => true,
                'path' => $targetPath . '/' . $finalName
            ]);
        } catch (\Exception $e) {
            $this->logger->error('Failed to save to Nextcloud: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
            ]);
            return new JSONResponse(['error' => $e->getMessage()], Http::STATUS_INTERNAL_SERVER_ERROR);
        }
    }
}
