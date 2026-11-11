package com.acme.erp.netsuite;

import com.netsuite.webservices.platform.common_2021_2.ItemSearchBasic;
import com.netsuite.webservices.platform.core_2021_2.SearchDateField;
import com.netsuite.webservices.platform.core_2021_2.SearchResult;
import com.netsuite.webservices.platform.core_2021_2.types.SearchDateFieldOperator;
import com.netsuite.webservices.platform_2021_2.NetSuitePortType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Calendar;

@Service
public class ItemSyncService {
    private final NetSuiteSessionManager sessions;
    private final ProductCatalogClient catalog;

    public ItemSyncService(NetSuiteSessionManager sessions, ProductCatalogClient catalog) {
        this.sessions = sessions;
        this.catalog = catalog;
    }

    @Scheduled(cron = "${itemsync.cron}")
    public void syncChangedItems() throws Exception {
        NetSuitePortType port = sessions.port();

        Calendar since = Calendar.getInstance();
        since.add(Calendar.HOUR, -1);
        SearchDateField modified = new SearchDateField();
        modified.setOperator(SearchDateFieldOperator.after);
        modified.setSearchValue(since);
        ItemSearchBasic search = new ItemSearchBasic();
        search.setLastModifiedDate(modified);

        SearchResult result = port.search(search);
        catalog.upsert(result.getRecordList());
        for (int page = 2; page <= result.getTotalPages(); page++) {
            SearchResult next = port.searchMoreWithId(result.getSearchId(), page);
            catalog.upsert(next.getRecordList());
        }
    }
}
