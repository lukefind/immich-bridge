<?php

declare(strict_types=1);

namespace OCA\ImmichBridge\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;
use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * @extends QBMapper<UserConfig>
 */
class UserConfigMapper extends QBMapper {

    public function __construct(IDBConnection $db) {
        parent::__construct($db, 'immich_bridge_usercfg', UserConfig::class);
    }

    /**
     * Find configuration by user ID
     *
     * @param string $userId
     * @return UserConfig|null
     */
    public function findByUserId(string $userId): ?UserConfig {
        $qb = $this->db->getQueryBuilder();

        $qb->select('*')
            ->from($this->getTableName())
            ->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId, IQueryBuilder::PARAM_STR)));

        try {
            return $this->findEntity($qb);
        } catch (DoesNotExistException $e) {
            return null;
        } catch (MultipleObjectsReturnedException $e) {
            // This shouldn't happen due to unique index, but handle it gracefully
            return null;
        }
    }

    /**
     * Insert a new configuration
     *
     * @param UserConfig $entity
     * @return UserConfig
     */
    public function insert(\OCP\AppFramework\Db\Entity $entity): UserConfig {
        return parent::insert($entity);
    }

    /**
     * Update an existing configuration
     *
     * @param UserConfig $entity
     * @return UserConfig
     */
    public function update(\OCP\AppFramework\Db\Entity $entity): UserConfig {
        return parent::update($entity);
    }
}
