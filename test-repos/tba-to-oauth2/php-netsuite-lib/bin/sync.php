<?php

declare(strict_types=1);

// Run nightly by cron on the integration box: 30 1 * * * php bin/sync.php

require __DIR__ . '/../vendor/autoload.php';

use Acme\CrmSync\NetSuite\ServiceFactory;
use Acme\CrmSync\Sync\CustomerSync;
use Monolog\Handler\StreamHandler;
use Monolog\Logger;

Dotenv\Dotenv::createImmutable(dirname(__DIR__))->load();

$log = new Logger('crm-sync', [new StreamHandler('php://stderr')]);
$sync = new CustomerSync(ServiceFactory::create(), $log);

$accounts = json_decode(
    file_get_contents($_ENV['CRM_API_URL'] . '/accounts?updated_since=-1day', false, stream_context_create([
        'http' => ['header' => 'X-Api-Key: ' . $_ENV['CRM_API_KEY']],
    ])),
    true,
);

foreach ($accounts['data'] as $account) {
    $id = $sync->upsert($account);
    $log->info('synced', ['crm' => $account['id'], 'netsuite' => $id]);
}
