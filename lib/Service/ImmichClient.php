<?php

declare(strict_types=1);

namespace OCA\ImmichBridge\Service;

use OCA\ImmichBridge\Db\UserConfig;
use OCP\Http\Client\IClientService;
use OCP\IUserSession;
use Psr\Log\LoggerInterface;

class ImmichClient {

    private UserConfigService $configService;
    private IUserSession $userSession;
    private IClientService $clientService;
    private LoggerInterface $logger;

    public function __construct(
        UserConfigService $configService,
        IUserSession $userSession,
        IClientService $clientService,
        LoggerInterface $logger
    ) {
        $this->configService = $configService;
        $this->userSession = $userSession;
        $this->clientService = $clientService;
        $this->logger = $logger;
    }

    /**
     * Get the current user's configuration
     *
     * @return UserConfig
     * @throws \Exception if not configured
     */
    private function getConfig(): UserConfig {
        $user = $this->userSession->getUser();
        if ($user === null) {
            throw new \Exception('User not logged in');
        }

        $config = $this->configService->getConfigForUser($user->getUID());
        if ($config === null) {
            throw new \Exception('Immich not configured');
        }

        return $config;
    }

    /**
     * Build the full URL for an Immich API endpoint
     *
     * @param string $endpoint
     * @return string
     */
    private function buildUrl(string $endpoint): string {
        $config = $this->getConfig();
        $baseUrl = rtrim($config->getBaseUrl(), '/');
        return $baseUrl . '/' . ltrim($endpoint, '/');
    }

    /**
     * Get HTTP headers for Immich API requests
     *
     * @return array
     */
    private function getHeaders(): array {
        $config = $this->getConfig();
        return [
            'x-api-key' => $config->getApiKey(),
            'Accept' => 'application/json',
        ];
    }

    /**
     * Make a GET request to the Immich API
     *
     * @param string $endpoint
     * @return array
     * @throws \Exception
     */
    private function get(string $endpoint): array {
        $client = $this->clientService->newClient();
        $url = $this->buildUrl($endpoint);

        try {
            $response = $client->get($url, [
                'headers' => $this->getHeaders(),
                'timeout' => 30,
            ]);

            $body = $response->getBody();
            return json_decode($body, true) ?? [];
        } catch (\Exception $e) {
            $this->logger->error('Immich API error: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
                'endpoint' => $endpoint,
            ]);
            throw new \Exception('Failed to connect to Immich: ' . $e->getMessage());
        }
    }

    /**
     * Get a binary stream from the Immich API
     *
     * @param string $endpoint
     * @return array{body: string, contentType: string}
     * @throws \Exception
     */
    private function getBinary(string $endpoint): array {
        $client = $this->clientService->newClient();
        $url = $this->buildUrl($endpoint);

        try {
            $response = $client->get($url, [
                'headers' => [
                    'x-api-key' => $this->getConfig()->getApiKey(),
                ],
                'timeout' => 60,
            ]);

            $contentType = $response->getHeader('Content-Type');
            if (is_array($contentType)) {
                $contentType = $contentType[0] ?? 'application/octet-stream';
            }

            return [
                'body' => $response->getBody(),
                'contentType' => $contentType,
            ];
        } catch (\Exception $e) {
            $this->logger->error('Immich API binary error: ' . $e->getMessage(), [
                'app' => 'immich_bridge',
                'endpoint' => $endpoint,
            ]);
            throw new \Exception('Failed to fetch from Immich: ' . $e->getMessage());
        }
    }

    /**
     * List all albums
     *
     * @return array
     */
    public function listAlbums(): array {
        return $this->get('albums');
    }

    /**
     * Get a specific album
     *
     * @param string $albumId
     * @return array
     */
    public function getAlbum(string $albumId): array {
        return $this->get('albums/' . urlencode($albumId));
    }

    /**
     * List assets in an album
     *
     * @param string $albumId
     * @return array
     */
    public function listAssetsByAlbum(string $albumId): array {
        $album = $this->getAlbum($albumId);
        return $album['assets'] ?? [];
    }

    /**
     * Get thumbnail for an asset
     *
     * @param string $assetId
     * @return array{body: string, contentType: string}
     */
    public function streamThumbnail(string $assetId): array {
        return $this->getBinary('assets/' . urlencode($assetId) . '/thumbnail');
    }

    public function streamThumbnailVariant(string $assetId, string $size = '', string $key = '', string $format = ''): array {
        $params = [];
        if ($size !== '') {
            $params['size'] = $size;
        }
        if ($key !== '') {
            $params['key'] = $key;
        }
        if ($format !== '') {
            $params['format'] = $format;
        }

        $endpoint = 'assets/' . urlencode($assetId) . '/thumbnail';
        if (!empty($params)) {
            $endpoint .= '?' . http_build_query($params);
        }

        return $this->getBinary($endpoint);
    }

    /**
     * Get preview image for an asset (larger than grid thumbnail)
     *
     * Immich supports generating different thumbnail variants. The exact query
     * parameters have changed over time, so this method tries a best-effort
     * request and falls back to the standard thumbnail if unsupported.
     *
     * @param string $assetId
     * @return array{body: string, contentType: string}
     */
    public function streamPreview(string $assetId): array {
        $encoded = urlencode($assetId);

        // Immich generates multiple sizes (thumbnail vs preview). The API has used different
        // query parameters across versions, so we try a few common variants.
        $candidates = [
            'assets/' . $encoded . '/thumbnail?key=preview',
            'assets/' . $encoded . '/thumbnail?key=preview&format=WEBP',
            'assets/' . $encoded . '/thumbnail?size=preview',
        ];

        foreach ($candidates as $endpoint) {
            try {
                $result = $this->getBinary($endpoint);

                $ct = strtolower($result['contentType'] ?? '');
                if (str_starts_with($ct, 'image/')) {
                    return $result;
                }
            } catch (\Exception $e) {
                // try next
            }
        }

        return $this->streamThumbnail($assetId);
    }

    /**
     * Get original asset
     *
     * @param string $assetId
     * @return array{body: string, contentType: string}
     */
    public function streamOriginal(string $assetId): array {
        return $this->getBinary('assets/' . urlencode($assetId) . '/original');
    }
}
