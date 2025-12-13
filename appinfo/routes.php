<?php

declare(strict_types=1);

return [
    'routes' => [
        // Page routes
        ['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
        
        // API routes
        ['name' => 'api#getConfig', 'url' => '/api/config', 'verb' => 'GET'],
        ['name' => 'api#setConfig', 'url' => '/api/config', 'verb' => 'POST'],
        ['name' => 'api#deleteConfig', 'url' => '/api/config/delete', 'verb' => 'POST'],
        ['name' => 'api#getAlbums', 'url' => '/api/albums', 'verb' => 'GET'],
        ['name' => 'api#getAlbum', 'url' => '/api/albums/{albumId}', 'verb' => 'GET'],
        ['name' => 'api#getAssets', 'url' => '/api/albums/{albumId}/assets', 'verb' => 'GET'],
        ['name' => 'api#getTimeline', 'url' => '/api/photos/all', 'verb' => 'GET'],
        ['name' => 'api#getTags', 'url' => '/api/tags', 'verb' => 'GET'],
        ['name' => 'api#getThumbnail', 'url' => '/api/assets/{assetId}/thumbnail', 'verb' => 'GET'],
        ['name' => 'api#getPreview', 'url' => '/api/assets/{assetId}/preview', 'verb' => 'GET'],
        ['name' => 'api#getOriginal', 'url' => '/api/assets/{assetId}/original', 'verb' => 'GET'],
        ['name' => 'api#saveToNextcloud', 'url' => '/api/assets/{assetId}/save-to-nextcloud', 'verb' => 'POST'],
    ]
];
