<?php

declare(strict_types=1);

namespace Acme\CrmSync\NetSuite;

use NetSuite\NetSuiteService;

final class ServiceFactory
{
    public static function create(): NetSuiteService
    {
        $config = [
            'endpoint'           => $_ENV['NETSUITE_ENDPOINT'],
            'host'               => $_ENV['NETSUITE_HOST'],
            'account'            => $_ENV['NETSUITE_ACCOUNT'],
            'consumerKey'        => $_ENV['NETSUITE_CONSUMER_KEY'],
            'consumerSecret'     => $_ENV['NETSUITE_CONSUMER_SECRET'],
            'token'              => $_ENV['NETSUITE_TOKEN_KEY'],
            'tokenSecret'        => $_ENV['NETSUITE_TOKEN_SECRET'],
            'signatureAlgorithm' => 'sha256',
            'logging'            => true,
            'log_path'           => __DIR__ . '/../../var/log/netsuite',
        ];

        return new NetSuiteService($config);
    }
}
