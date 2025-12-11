<?php

declare(strict_types=1);

namespace OCA\ImmichBridge\Db;

use OCP\AppFramework\Db\Entity;

/**
 * @method int getId()
 * @method void setId(int $id)
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method string getBaseUrl()
 * @method void setBaseUrl(string $baseUrl)
 * @method string getApiKey()
 * @method void setApiKey(string $apiKey)
 */
class UserConfig extends Entity {
    /** @var string */
    protected $userId;

    /** @var string */
    protected $baseUrl;

    /** @var string */
    protected $apiKey;

    public function __construct() {
        $this->addType('id', 'integer');
        $this->addType('userId', 'string');
        $this->addType('baseUrl', 'string');
        $this->addType('apiKey', 'string');
    }
}
