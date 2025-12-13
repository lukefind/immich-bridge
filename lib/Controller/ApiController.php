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
use OCP\IRequest;
use OCP\IUserSession;
use Psr\Log\LoggerInterface;

class ApiController extends Controller {

    private IUserSession $userSession;
    private UserConfigService $configService;
    private ImmichClient $immichClient;
    private LoggerInterface $logger;

    public function __construct(
        IRequest $request,
        IUserSession $userSession,
        UserConfigService $configService,
        ImmichClient $immichClient,
        LoggerInterface $logger
    ) {
        parent::__construct(Application::APP_ID, $request);
        $this->userSession = $userSession;
        $this->configService = $configService;
        $this->immichClient = $immichClient;
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
            $result = $this->immichClient->streamThumbnail($assetId);

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
}
