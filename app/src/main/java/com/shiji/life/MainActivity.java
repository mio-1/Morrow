package com.shiji.life;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.graphics.Color;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.webkit.*;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net/assets/";
    private static final String API = "https://c-api.bill.youqian.pro";
    private static final String RELEASE_PAGE = "https://github.com/mio-1/Morrow/releases/";
    private static final String RELEASE_DOWNLOAD = RELEASE_PAGE + "download/";
    private static final String RELEASE_INFO = RELEASE_PAGE + "latest/download/build-info.json";
    private static final String KEY_ALIAS = "shiji.session.v1";
    private WebView web;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private AtomicFile stateFile;
    private volatile String activeDownloadId;
    private volatile String cancelledDownloadId;
    private volatile HttpURLConnection activeDownloadConnection;

    @Override public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(Color.rgb(246,247,243));
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        stateFile = new AtomicFile(new File(getFilesDir(), "workspace.json"));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(246,247,243));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(246,247,243));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                         insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) {
                return !r.getUrl().toString().startsWith(ORIGIN);
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest r) {
                String url = r.getUrl().toString();
                if (url.startsWith(ORIGIN)) {
                    String path = Uri.decode(r.getUrl().getPath().substring("/assets/".length()));
                    if (path.contains("..") || path.contains("\\")) return blocked();
                    try {
                        String mime = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "text/html";
                        return new WebResourceResponse(mime, "UTF-8", getAssets().open(path));
                    } catch (IOException e) { return blocked(); }
                }
                return blocked();
            }
        });
        web.addJavascriptInterface(new Bridge(), "NativeHub");
        root.addView(web,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        web.loadUrl(ORIGIN + "index.html");
    }

    private WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", null,
                new ByteArrayInputStream(new byte[0]));
    }

    public class Bridge {
        @JavascriptInterface public void call(String id, String action, String payload) {
            if (id == null || id.length() > 100 || payload == null || payload.length() > 8000000) return;
            if ("cancelDownload".equals(action)) {
                try {
                    String downloadId = new JSONObject(payload).optString("downloadId");
                    if (!downloadId.isEmpty() && downloadId.equals(activeDownloadId)) {
                        cancelledDownloadId = downloadId;
                        HttpURLConnection connection = activeDownloadConnection;
                        if (connection != null) connection.disconnect();
                    }
                    sendResult(id, ok());
                } catch (Exception e) { sendResult(id, error("取消下载失败")); }
                return;
            }
            if ("downloadUpdate".equals(action)) activeDownloadId = id;
            ("checkUpdate".equals(action) || "downloadUpdate".equals(action) || "installUpdate".equals(action)
                ? updateExecutor : executor).execute(() -> {
                JSONObject result;
                try {
                    JSONObject args = new JSONObject(payload);
                    switch (action) {
                        case "load":
                            JSONObject state = new JSONObject();
                            try (InputStream in = stateFile.openRead()) { state = new JSONObject(read(in, 8000000)); }
                            catch (FileNotFoundException e) { /* first launch: no saved workspace */ }
                            result = ok().put("state", state).put("connected", !readToken().isEmpty())
                                .put("currentVersion", getPackageManager().getPackageInfo(getPackageName(), 0).versionName);
                            break;
                        case "save":
                            JSONObject saved = args.getJSONObject("state");
                            // The Web layer owns schema migration; the bridge only stores versioned JSON.
                            if (saved.optInt("version", 0) < 1) throw new UserError("数据版本无效，请重新打开 App");
                            FileOutputStream out = null;
                            try {
                                out = stateFile.startWrite();
                                out.write(saved.toString().getBytes(StandardCharsets.UTF_8));
                                stateFile.finishWrite(out);
                            } catch (Exception e) { stateFile.failWrite(out); throw e; }
                            result = ok();
                            break;
                        case "login":
                            String phone = args.optString("phone").trim(), password = args.optString("password");
                            if (phone.isEmpty() || password.isEmpty()) throw new UserError("请输入手机号和密码");
                            JSONObject body = new JSONObject().put("username", phone).put("type", "account")
                                    .put("password", Base64.encodeToString(password.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP));
                            JSONObject login = http("/auth/login", body, "");
                            JSONObject session = login.optJSONObject("data");
                            if (session == null || session.optString("access_token").isEmpty()) throw new UserError("登录未成功，请核对手机号和密码。未自动重试。");
                            storeToken(session.getString("access_token"));
                            try { result = sync(); }
                            catch (Exception e) { result = error("登录成功，但资产同步尚未完成。请回首页重试同步。").put("connected",true); }
                            break;
                        case "sync": result = sync(); break;
                        case "checkUpdate": result = checkUpdate(); break;
                        case "installUpdate": result = installUpdate(); break;
                        case "downloadUpdate":
                            try { result = downloadUpdate(id); }
                            catch (Exception e) {
                                if (id.equals(cancelledDownloadId)) result = error("下载已取消").put("cancelled", true);
                                else throw e;
                            } finally {
                                if (id.equals(activeDownloadId)) activeDownloadId = null;
                                if (id.equals(cancelledDownloadId)) cancelledDownloadId = null;
                                activeDownloadConnection = null;
                            }
                            break;
                        case "logout":
                            getSharedPreferences("vault", MODE_PRIVATE).edit().clear().commit();
                            result = ok(); break;
                        default: throw new UserError("暂不支持这个操作");
                    }
                } catch (UserError e) { result = error(e.getMessage()); }
                catch (SocketTimeoutException e) { result = error("连接超时，请稍后重试；本地数据已保留"); }
                catch (IOException e) { result = error("暂时无法连接小青账，请检查网络后重试"); }
                catch (Exception e) { result = error("操作未完成，本地数据已保留；请重试或重新登录"); }
                sendResult(id, result);
            });
        }
    }

    private void sendResult(String id, JSONObject result) {
        final String js = "window.onNativeResult(" + JSONObject.quote(id) + "," + result.toString() + ")";
        runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) web.evaluateJavascript(js, null); });
    }

    private void checkDownloadCancelled(String id) throws UserError {
        if (id.equals(cancelledDownloadId)) throw new UserError("下载已取消");
    }

    private void sendProgress(String id, long loaded, long total) {
        final String js = "window.onNativeProgress(" + JSONObject.quote(id) + "," + loaded + "," + total + ")";
        runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) web.evaluateJavascript(js, null); });
    }

    private JSONObject sync() throws Exception {
        String token = readToken();
        if (token.isEmpty()) throw new UserError("请先登录小青账");
        JSONObject response = http("/bill/asset/list", null, token);
        if (!response.optBoolean("succ", false)) {
            if (response.optString("code").contains("401")) {
                getSharedPreferences("vault", MODE_PRIVATE).edit().clear().commit();
                return error("登录已过期，请重新登录；上次同步的数据仍保留").put("expired", true);
            }
            throw new UserError("小青账暂未返回资产数据，请稍后重试");
        }
        JSONArray raw = response.optJSONArray("data");
        if (raw == null) throw new UserError("资产数据格式发生变化，已保留上次数据");
        JSONArray accounts = new JSONArray();
        for (int i=0;i<raw.length();i++) {
            JSONObject a=raw.getJSONObject(i);
            if (a.getDouble("balance") == 0d) continue;
            JSONObject entry = new JSONObject().put("code",a.getString("code"))
                .put("name",a.optString("name","未命名账户")).put("balance",a.get("balance"))
                .put("bankName",a.optString("bankName",a.optString("bank",a.optString("institutionName",""))))
                .put("currency",a.optString("currency", ""))
                .put("reckonIn",a.optBoolean("reckonIn",false))
                .put("liabilities",a.optBoolean("liabilities",false))
                .put("status",a.optString("status")).put("type",a.optString("type"))
                .put("source","xiaoqing");
            accounts.put(entry);
        }
        return ok().put("accounts", accounts).put("syncedAt",System.currentTimeMillis());
    }

    private JSONObject checkUpdate() throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(RELEASE_INFO).openConnection(Proxy.NO_PROXY);
        con.setInstanceFollowRedirects(true);
        con.setConnectTimeout(10000); con.setReadTimeout(15000);
        con.setRequestProperty("User-Agent", "Morrow-Android-Update");
        try {
            int status = con.getResponseCode();
            android.content.pm.PackageInfo installed = getPackageManager().getPackageInfo(getPackageName(), 0);
            JSONObject result = ok().put("currentVersion", installed.versionName).put("currentCode", installed.versionCode);
            if (status == 404) return result.put("published", false);
            if (status != 200) throw new UserError("检查更新暂时不可用（" + status + "）");
            if (!"https".equalsIgnoreCase(con.getURL().getProtocol())) throw new UserError("更新地址不安全");
            JSONObject info;
            try (InputStream in = con.getInputStream()) { info = new JSONObject(read(in, 2048)); }
            String version = info.optString("version"), digest = info.optString("sha256");
            int latestCode = info.optInt("versionCode", -1);
            if (!getPackageName().equals(info.optString("package")) || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")
                || latestCode < 1 || !digest.matches("(?i)[0-9a-f]{64}"))
                throw new UserError("更新信息格式无效");
            String tag = "v" + version, apkName = "Morrow-" + tag + "-vc" + latestCode + ".apk";
            String apkUrl = RELEASE_DOWNLOAD + tag + "/" + apkName;
            return result.put("published", true).put("latestVersion", tag).put("latestCode", latestCode)
                .put("apkUrl", apkUrl).put("apkName", apkName).put("digest", digest);
        } catch (IOException e) { throw new UserError("暂时无法检查更新，请检查网络后重试"); }
        finally { con.disconnect(); }
    }

    private JSONObject downloadUpdate(String id) throws Exception {
        checkDownloadCancelled(id);
        JSONObject release = checkUpdate();
        checkDownloadCancelled(id);
        if (!release.optBoolean("published") || release.getInt("latestCode") <= release.getInt("currentCode"))
            throw new UserError("当前已是最新版本");
        if (!getPackageManager().canRequestPackageInstalls()) {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getPackageName()))));
            throw new UserError("请允许 Morrow 安装应用，返回后再次点击下载安装");
        }
        String name = release.getString("apkName"), expected = release.optString("digest");
        if (expected.startsWith("sha256:")) expected = expected.substring(7);
        if (!expected.matches("(?i)[0-9a-f]{64}")) {
            String checksumUrl = release.optString("checksumUrl");
            if (!checksumUrl.startsWith(RELEASE_DOWNLOAD) || !checksumUrl.endsWith("/SHA256.txt"))
                throw new UserError("发布版本缺少校验文件，已停止下载");
            String checksum = downloadText(checksumUrl, 2048);
            java.util.regex.Matcher match = java.util.regex.Pattern.compile("(?im)^([0-9a-f]{64})\\s+\\*?" +
                java.util.regex.Pattern.quote(name) + "\\s*$").matcher(checksum);
            if (!match.find()) throw new UserError("安装包校验信息无效，已停止下载");
            expected = match.group(1);
        }
        checkDownloadCancelled(id);
        File apk = new File(getCacheDir(), "morrow-update.apk");
        File part = new File(getCacheDir(), "morrow-update.apk.part");
        if (part.exists()) part.delete();
        try {
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            HttpURLConnection con = releaseConnection(release.getString("apkUrl"));
            activeDownloadConnection = con;
            try {
                checkDownloadCancelled(id);
                if (con.getResponseCode() != 200) throw new UserError("安装包下载失败（" + con.getResponseCode() + "）");
                if (!"https".equalsIgnoreCase(con.getURL().getProtocol())) throw new UserError("下载地址不安全");
                long size = 0, total = con.getContentLengthLong(), lastProgress = 0;
                try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(part)) {
                    byte[] bytes = new byte[32768]; int count;
                    while ((count = in.read(bytes)) != -1) {
                        checkDownloadCancelled(id);
                        size += count;
                        if (size > 200L * 1024 * 1024) throw new UserError("安装包超过大小限制");
                        hash.update(bytes, 0, count); out.write(bytes, 0, count);
                        long now = System.currentTimeMillis();
                        if (now - lastProgress >= 150 || (total > 0 && size >= total)) {
                            sendProgress(id, size, total); lastProgress = now;
                        }
                    }
                }
                checkDownloadCancelled(id);
                sendProgress(id, size, total);
                if (size == 0) throw new UserError("安装包为空");
                StringBuilder actual = new StringBuilder();
                for (byte b : hash.digest()) actual.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
                if (!actual.toString().equalsIgnoreCase(expected)) throw new UserError("安装包校验失败，请重试");
                checkDownloadCancelled(id);
                if (apk.exists() && !apk.delete()) throw new IOException("Could not replace cached APK");
                if (!part.renameTo(apk)) throw new IOException("Could not save downloaded APK");
            } finally { activeDownloadConnection = null; con.disconnect(); }
        } finally { if (part.exists()) part.delete(); }
        checkDownloadCancelled(id);
        return ok().put("downloaded", true);
    }

    private JSONObject installUpdate() throws Exception {
        File apk = new File(getCacheDir(), "morrow-update.apk");
        if (!apk.isFile() || apk.length() == 0) throw new UserError("安装包不存在，请重新下载");
        if (!getPackageManager().canRequestPackageInstalls()) throw new UserError("请允许 Morrow 安装应用后重试");
        Uri uri = Uri.parse("content://" + getPackageName() + ".updates/update.apk");
        Intent install = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        runOnUiThread(() -> startActivity(install));
        return ok();
    }

    private String downloadText(String url, int max) throws Exception {
        HttpURLConnection con = releaseConnection(url);
        try {
            if (con.getResponseCode() != 200) throw new UserError("无法读取安装包校验信息");
            if (!"https".equalsIgnoreCase(con.getURL().getProtocol())) throw new UserError("校验地址不安全");
            try (InputStream in = con.getInputStream()) { return read(in, max); }
        } finally { con.disconnect(); }
    }

    private HttpURLConnection releaseConnection(String url) throws Exception {
        if (!url.startsWith(RELEASE_DOWNLOAD)) throw new UserError("更新地址无效");
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection(Proxy.NO_PROXY);
        con.setInstanceFollowRedirects(true);
        con.setConnectTimeout(15000); con.setReadTimeout(30000);
        con.setRequestProperty("User-Agent", "Morrow-Android-Update");
        return con;
    }

    private JSONObject http(String path, JSONObject payload, String token) throws Exception {
        // Fixed host and caller-defined read-only paths; no automatic redirects or proxy interception.
        HttpURLConnection con = (HttpURLConnection) new URL(API+path).openConnection(Proxy.NO_PROXY);
        con.setInstanceFollowRedirects(false);
        con.setConnectTimeout(15000); con.setReadTimeout(20000);
        con.setRequestProperty("Accept","application/json");
        try {
            if (!token.isEmpty()) con.setRequestProperty("Authorization","Bearer "+token);
            if (payload != null) {
                con.setRequestMethod("POST"); con.setDoOutput(true);
                con.setRequestProperty("Content-Type","application/json; charset=utf-8");
                try (OutputStream out=con.getOutputStream()) { out.write(payload.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            int status=con.getResponseCode();
            if(status==401) return new JSONObject().put("succ",false).put("code","OAUTH_TOKEN_FAILURE-401");
            if(status < 200 || status >= 300) throw new UserError("服务暂时不可用（"+status+"），请稍后重试");
            try(InputStream in=con.getInputStream()) { return new JSONObject(read(in,5000000)); }
        } finally { con.disconnect(); }
    }

    private String read(InputStream in,int max) throws IOException {
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int len;
        while((len=in.read(buf))!=-1) { if(out.size()+len>max) throw new IOException("Response too large");out.write(buf,0,len); }
        return new String(out.toByteArray(),StandardCharsets.UTF_8);
    }

    private javax.crypto.SecretKey key() throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        if(!ks.containsAlias(KEY_ALIAS)) {
            KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            gen.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            gen.generateKey();
        }
        return (javax.crypto.SecretKey)ks.getKey(KEY_ALIAS,null);
    }
    private void storeToken(String token) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        String value=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+
            Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
        if(!getSharedPreferences("vault",MODE_PRIVATE).edit().putString("session",value).commit()) throw new IOException("Vault write failed");
    }
    private String readToken() throws Exception {
        String value=getSharedPreferences("vault",MODE_PRIVATE).getString("session","");if(value.isEmpty())return "";
        try {
            String[] parts=value.split(":");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
        } catch(Exception e) { getSharedPreferences("vault",MODE_PRIVATE).edit().clear().commit();return ""; }
    }
    private JSONObject ok() throws JSONException {return new JSONObject().put("ok",true);}
    private JSONObject error(String message) {try{return new JSONObject().put("ok",false).put("error",message);}catch(JSONException e){throw new RuntimeException(e);}}
    private static class UserError extends Exception {UserError(String message){super(message);}}
    @Override public void onBackPressed(){web.evaluateJavascript("window.hubBack ? window.hubBack() : false",value->{if("false".equals(value))finish();});}
    @Override public void onDestroy(){executor.shutdown();updateExecutor.shutdown();web.removeJavascriptInterface("NativeHub");web.destroy();super.onDestroy();}
}
