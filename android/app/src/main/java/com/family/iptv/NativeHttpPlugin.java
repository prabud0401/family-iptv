package com.family.iptv;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;

@CapacitorPlugin(name = "NativeHttp")
public class NativeHttpPlugin extends Plugin {

    @PluginMethod
    public void request(PluginCall call) {
        String urlStr = call.getString("url", "");
        String method = call.getString("method", "GET").toUpperCase();
        JSObject headers = call.getObject("headers", new JSObject());
        String body = call.getString("body", null);

        new Thread(() -> {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setInstanceFollowRedirects(true);

                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    conn.setRequestProperty(key, headers.getString(key));
                }

                if (conn.getRequestProperty("User-Agent") == null) {
                    conn.setRequestProperty("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                }

                if (body != null && (method.equals("POST") || method.equals("PUT"))) {
                    conn.setDoOutput(true);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.getBytes("UTF-8"));
                    }
                }

                int status = conn.getResponseCode();
                StringBuilder sb = new StringBuilder();

                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(
                            status >= 400 ? conn.getErrorStream() : conn.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                }

                String responseData = sb.toString();

                JSObject respHeaders = new JSObject();
                for (String key : conn.getHeaderFields().keySet()) {
                    if (key != null) {
                        respHeaders.put(key.toLowerCase(), conn.getHeaderField(key));
                    }
                }

                conn.disconnect();

                JSObject result = new JSObject();
                result.put("status", status);
                result.put("data", responseData);
                result.put("responseHeaders", respHeaders);
                result.put("url", conn.getURL().toString());

                call.resolve(result);

            } catch (Exception e) {
                JSObject result = new JSObject();
                result.put("status", 0);
                result.put("data", "");
                result.put("error", e.getMessage());
                call.resolve(result);
            }
        }).start();
    }
}
