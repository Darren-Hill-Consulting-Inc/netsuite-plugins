<?php

declare(strict_types=1);

namespace Acme\CrmSync\Sync;

use NetSuite\Classes\Customer;
use NetSuite\Classes\RecordRef;
use NetSuite\Classes\SearchStringField;
use NetSuite\Classes\CustomerSearchBasic;
use NetSuite\Classes\SearchRequest;
use NetSuite\Classes\UpsertRequest;
use NetSuite\NetSuiteService;
use Psr\Log\LoggerInterface;

final class CustomerSync
{
    public function __construct(
        private readonly NetSuiteService $service,
        private readonly LoggerInterface $log,
    ) {
    }

    public function findByExternalId(string $externalId): ?Customer
    {
        $field = new SearchStringField();
        $field->operator = 'is';
        $field->searchValue = $externalId;

        $search = new CustomerSearchBasic();
        $search->externalIdString = $field;

        $request = new SearchRequest();
        $request->searchRecord = $search;

        $response = $this->service->search($request);
        if (!$response->searchResult->status->isSuccess || $response->searchResult->totalRecords === 0) {
            return null;
        }

        return $response->searchResult->recordList->record[0];
    }

    public function upsert(array $account): string
    {
        $customer = new Customer();
        $customer->externalId = 'CRM-' . $account['id'];
        $customer->companyName = $account['name'];
        $customer->email = $account['billing_email'];
        $customer->subsidiary = new RecordRef();
        $customer->subsidiary->internalId = '1';

        $request = new UpsertRequest();
        $request->record = $customer;

        $response = $this->service->upsert($request);
        if (!$response->writeResponse->status->isSuccess) {
            $this->log->error('NetSuite upsert failed', ['account' => $account['id']]);
            throw new \RuntimeException($response->writeResponse->status->statusDetail[0]->message);
        }

        return $response->writeResponse->baseRef->internalId;
    }
}
