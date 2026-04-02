package com.family.iptv;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeHttpPlugin.class);
        super.onCreate(savedInstanceState);

        android.webkit.WebView wv = getBridge().getWebView();
        WebSettings ws = wv.getSettings();
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setDomStorageEnabled(true);
        ws.setJavaScriptEnabled(true);
        try {
            java.lang.reflect.Method m = ws.getClass().getMethod("setSpatialNavigationEnabled", boolean.class);
            m.invoke(ws, true);
        } catch (Exception ignored) {}
    }
}
