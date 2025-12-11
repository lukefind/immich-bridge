<?php

declare(strict_types=1);

namespace OCA\ImmichBridge\Service;

use OCA\ImmichBridge\Db\UserConfig;
use OCA\ImmichBridge\Db\UserConfigMapper;

class UserConfigService {

    private UserConfigMapper $mapper;

    public function __construct(UserConfigMapper $mapper) {
        $this->mapper = $mapper;
    }

    /**
     * Get configuration for a specific user
     *
     * @param string $userId
     * @return UserConfig|null
     */
    public function getConfigForUser(string $userId): ?UserConfig {
        return $this->mapper->findByUserId($userId);
    }

    /**
     * Save configuration for a specific user
     *
     * @param string $userId
     * @param string $baseUrl
     * @param string $apiKey
     * @return UserConfig
     */
    public function saveConfigForUser(string $userId, string $baseUrl, string $apiKey): UserConfig {
        $existingConfig = $this->mapper->findByUserId($userId);

        if ($existingConfig !== null) {
            // Update existing config
            $existingConfig->setBaseUrl($baseUrl);
            $existingConfig->setApiKey($apiKey);
            return $this->mapper->update($existingConfig);
        } else {
            // Create new config
            $config = new UserConfig();
            $config->setUserId($userId);
            $config->setBaseUrl($baseUrl);
            $config->setApiKey($apiKey);
            return $this->mapper->insert($config);
        }
    }

    /**
     * Delete configuration for a specific user
     *
     * @param string $userId
     * @return void
     */
    public function deleteConfigForUser(string $userId): void {
        $existingConfig = $this->mapper->findByUserId($userId);
        if ($existingConfig !== null) {
            $this->mapper->delete($existingConfig);
        }
    }
}
