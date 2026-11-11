package com.acme.erp.netsuite;

import com.netsuite.webservices.platform.core_2021_2.RecordList;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class ProductCatalogClient {
    private final RestTemplate rest = new RestTemplate();

    public void upsert(RecordList records) {
        if (records == null || records.getRecord() == null) return;
        rest.postForLocation("https://catalog.internal.example.com/api/items/bulk", records.getRecord());
    }
}
