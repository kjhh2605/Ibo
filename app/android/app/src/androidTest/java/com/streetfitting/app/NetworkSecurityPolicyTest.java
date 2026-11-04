package com.streetfitting.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NetworkSecurityPolicyTest {
    @Test
    public void debugCleartextIsLimitedToLocalRelayHosts() {
        NetworkSecurityPolicy policy = NetworkSecurityPolicy.getInstance();
        assertTrue(policy.isCleartextTrafficPermitted("10.0.2.2"));
        assertTrue(policy.isCleartextTrafficPermitted("localhost"));
        assertTrue(policy.isCleartextTrafficPermitted("127.0.0.1"));
        assertTrue(policy.isCleartextTrafficPermitted("::1"));
        assertFalse(policy.isCleartextTrafficPermitted());
        assertFalse(policy.isCleartextTrafficPermitted("example.com"));
        assertFalse(policy.isCleartextTrafficPermitted("192.168.1.1"));
        assertFalse(policy.isCleartextTrafficPermitted("10.0.2.3"));
        assertFalse(policy.isCleartextTrafficPermitted("child.localhost"));
        assertFalse(policy.isCleartextTrafficPermitted("localhost.example.com"));
    }
}
