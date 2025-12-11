<?php

declare(strict_types=1);

namespace OCA\ImmichBridge\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

class Version0001Date20231201000000 extends SimpleMigrationStep {

    /**
     * @param IOutput $output
     * @param Closure $schemaClosure The `\Closure` returns a `ISchemaWrapper`
     * @param array $options
     * @return null|ISchemaWrapper
     */
    public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
        /** @var ISchemaWrapper $schema */
        $schema = $schemaClosure();

        if (!$schema->hasTable('immich_bridge_usercfg')) {
            $table = $schema->createTable('immich_bridge_usercfg');
            
            $table->addColumn('id', Types::BIGINT, [
                'autoincrement' => true,
                'notnull' => true,
                'unsigned' => true,
            ]);
            
            $table->addColumn('user_id', Types::STRING, [
                'notnull' => true,
                'length' => 64,
            ]);
            
            $table->addColumn('base_url', Types::STRING, [
                'notnull' => true,
                'length' => 512,
            ]);
            
            $table->addColumn('api_key', Types::STRING, [
                'notnull' => true,
                'length' => 512,
            ]);

            $table->setPrimaryKey(['id']);
            $table->addUniqueIndex(['user_id'], 'immich_bridge_user_idx');
        }

        return $schema;
    }
}
