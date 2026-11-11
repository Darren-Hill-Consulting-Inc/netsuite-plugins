package com.acme.erp.netsuite;

import com.netsuite.webservices.platform.core_2021_2.Passport;
import com.netsuite.webservices.platform.core_2021_2.RecordRef;
import com.netsuite.webservices.platform.messages_2021_2.ApplicationInfo;
import com.netsuite.webservices.platform.messages_2021_2.SessionResponse;
import com.netsuite.webservices.platform_2021_2.NetSuitePortType;
import com.netsuite.webservices.platform_2021_2.NetSuiteServiceLocator;
import org.apache.axis.client.Stub;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URL;

/**
 * Keeps one logged-in SuiteTalk session for the item sync.
 * NetSuite allows one session per user, so do not run two instances.
 */
@Component
public class NetSuiteSessionManager {
    private static final Logger log = LoggerFactory.getLogger(NetSuiteSessionManager.class);
    private static final String MESSAGES_NS = "urn:messages_2021_2.platform.webservices.netsuite.com";

    private final NetSuiteProperties props;
    private NetSuitePortType port;

    public NetSuiteSessionManager(NetSuiteProperties props) {
        this.props = props;
    }

    public synchronized NetSuitePortType port() throws Exception {
        if (port == null) {
            NetSuiteServiceLocator locator = new NetSuiteServiceLocator();
            locator.setMaintainSession(true);
            port = locator.getNetSuitePort(new URL(props.getEndpoint()));

            ApplicationInfo appInfo = new ApplicationInfo();
            appInfo.setApplicationId(props.getApplicationId());
            ((Stub) port).setHeader(MESSAGES_NS, "applicationInfo", appInfo);
            ((Stub) port).setTimeout(10 * 60 * 1000);
            login();
        }
        return port;
    }

    private void login() throws Exception {
        Passport passport = new Passport();
        passport.setEmail(props.getEmail());
        passport.setPassword(props.getPassword());
        passport.setAccount(props.getAccount());
        RecordRef role = new RecordRef();
        role.setInternalId(props.getRole());
        passport.setRole(role);

        SessionResponse resp = port.login(passport);
        if (!resp.getStatus().isIsSuccess()) {
            throw new IllegalStateException("NetSuite login failed: " + resp.getStatus().getStatusDetail(0).getMessage());
        }
        log.info("Logged in to NetSuite account {}", props.getAccount());
    }

    public synchronized void logout() throws Exception {
        if (port != null) {
            port.logout();
            port = null;
        }
    }
}
