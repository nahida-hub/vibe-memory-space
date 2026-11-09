package com.vibememory.notebook;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private File lastDownloadedApk = null;
    private final AtomicInteger activeDownloadTaskId = new AtomicInteger(0);
    private volatile HttpURLConnection activeDownloadConn = null;

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo info = pm.getPackageInfo(context.getPackageName(), 0);
            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = info.getLongVersionCode();
            } else {
                versionCode = info.versionCode;
            }
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName != null ? info.versionName : "0.1.0");
            ret.put("versionCode", versionCode);
            ret.put("packageName", context.getPackageName());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read package info: " + e.getMessage());
        }
    }

    private List<String> buildCandidateUrlList(String primaryUrl, JSArray urlsArray) {
        Set<String> candidates = new LinkedHashSet<>();
        if (urlsArray != null) {
            try {
                List<String> list = urlsArray.toList();
                for (Object item : list) {
                    if (item instanceof String && !((String) item).trim().isEmpty()) {
                        candidates.add(((String) item).trim());
                    }
                }
            } catch (Exception ignored) {
            }
        }
        if (primaryUrl != null && !primaryUrl.trim().isEmpty()) {
            String trimmed = primaryUrl.trim();
            candidates.add(trimmed);

            String rawGithubUrl = trimmed;
            String[] prefixes = new String[]{
                    "https://gh-proxy.com/",
                    "https://ghfast.top/",
                    "https://ghproxy.net/"
            };
            for (String p : prefixes) {
                if (rawGithubUrl.startsWith(p)) {
                    rawGithubUrl = rawGithubUrl.substring(p.length());
                    break;
                }
            }
            if (rawGithubUrl.startsWith("https://github.com/")
                    || rawGithubUrl.startsWith("https://raw.githubusercontent.com/")) {
                for (String p : prefixes) {
                    candidates.add(p + rawGithubUrl);
                }
                candidates.add(rawGithubUrl);
            }
        }
        return new ArrayList<>(candidates);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        activeDownloadTaskId.incrementAndGet();
        HttpURLConnection conn = activeDownloadConn;
        activeDownloadConn = null;
        if (conn != null) {
            new Thread(() -> {
                try {
                    conn.disconnect();
                } catch (Exception ignored) {
                }
            }).start();
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        final String apkUrl = call.getString("url");
        final JSArray urlsArray = call.getArray("urls");
        final String fileName = call.getString("fileName", "vibe-memory-update.apk");
        final Long expectedBytesOpt = call.getLong("expectedBytes", -1L);
        final long expectedBytes = expectedBytesOpt != null ? expectedBytesOpt : -1L;

        final List<String> candidateUrls = buildCandidateUrlList(apkUrl, urlsArray);
        if (candidateUrls.isEmpty()) {
            call.reject("Missing APK download URL");
            return;
        }

        final int taskId = activeDownloadTaskId.incrementAndGet();
        HttpURLConnection prevConn = activeDownloadConn;
        if (prevConn != null) {
            try {
                prevConn.disconnect();
            } catch (Exception ignored) {
            }
        }

        new Thread(() -> {
            File updateDir = new File(getContext().getCacheDir(), "updates");
            if (!updateDir.exists()) {
                updateDir.mkdirs();
            }

            String safeName = fileName.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]", "_");
            if (!safeName.endsWith(".apk")) {
                safeName += ".apk";
            }
            File targetFile = new File(updateDir, safeName);

            String lastError = "网络连接超时";

            for (int routeIdx = 0; routeIdx < candidateUrls.size(); routeIdx++) {
                if (activeDownloadTaskId.get() != taskId) {
                    call.reject("下载已取消");
                    return;
                }

                String candidateUrl = candidateUrls.get(routeIdx);
                String channelLabel = candidateUrl.startsWith("https://gh-proxy.com/")
                        ? "加速节点 1 (gh-proxy)"
                        : candidateUrl.startsWith("https://ghfast.top/")
                        ? "加速节点 2 (ghfast)"
                        : candidateUrl.startsWith("https://ghproxy.net/")
                        ? "加速节点 3 (ghproxy)"
                        : "GitHub 源站直连";

                JSObject initObj = new JSObject();
                initObj.put("progress", 1);
                initObj.put("downloadedBytes", 0);
                initObj.put("totalBytes", expectedBytes > 0 ? expectedBytes : 0);
                initObj.put("status", "connecting");
                initObj.put("channelLabel", channelLabel);
                notifyListeners("downloadProgress", initObj);

                HttpURLConnection connection = null;
                InputStream input = null;
                FileOutputStream output = null;

                try {
                    if (targetFile.exists()) {
                        targetFile.delete();
                    }

                    String currentUrl = candidateUrl;
                    int redirectCount = 0;
                    while (redirectCount < 8) {
                        if (activeDownloadTaskId.get() != taskId) {
                            call.reject("下载已取消");
                            return;
                        }
                        URL url = new URL(currentUrl);
                        connection = (HttpURLConnection) url.openConnection();
                        activeDownloadConn = connection;
                        connection.setConnectTimeout(8000);
                        connection.setReadTimeout(12000);
                        connection.setInstanceFollowRedirects(false);
                        connection.setRequestProperty("Accept-Encoding", "identity");
                        connection.setRequestProperty(
                                "User-Agent",
                                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                        );
                        connection.connect();

                        int status = connection.getResponseCode();
                        if (status == HttpURLConnection.HTTP_MOVED_TEMP
                                || status == HttpURLConnection.HTTP_MOVED_PERM
                                || status == HttpURLConnection.HTTP_SEE_OTHER
                                || status == 307
                                || status == 308) {
                            String nextLocation = connection.getHeaderField("Location");
                            connection.disconnect();
                            if (nextLocation == null || nextLocation.isEmpty()) {
                                break;
                            }
                            currentUrl = new URL(url, nextLocation).toString();
                            redirectCount++;
                            continue;
                        }
                        break;
                    }

                    int responseCode = connection.getResponseCode();
                    if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_PARTIAL) {
                        lastError = channelLabel + " 响应 HTTP " + responseCode;
                        continue;
                    }

                    long headerLength = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                            ? connection.getContentLengthLong()
                            : connection.getContentLength();
                    long totalBytes = headerLength > 0 ? headerLength : expectedBytes;

                    input = connection.getInputStream();
                    output = new FileOutputStream(targetFile);

                    byte[] buffer = new byte[16384];
                    long downloadedBytes = 0;
                    int count;
                    long lastNotifyTime = 0;

                    while ((count = input.read(buffer)) != -1) {
                        if (activeDownloadTaskId.get() != taskId) {
                            call.reject("下载已取消");
                            return;
                        }
                        output.write(buffer, 0, count);
                        downloadedBytes += count;

                        long now = System.currentTimeMillis();
                        if (now - lastNotifyTime >= 80 || (totalBytes > 0 && downloadedBytes >= totalBytes)) {
                            lastNotifyTime = now;
                            int progress = totalBytes > 0
                                    ? (int) Math.min(99, Math.max(1, (downloadedBytes * 100L) / totalBytes))
                                    : (int) Math.min(95, Math.max(2, (downloadedBytes * 100L) / (4L * 1024L * 1024L)));
                            JSObject progressObj = new JSObject();
                            progressObj.put("progress", progress);
                            progressObj.put("downloadedBytes", downloadedBytes);
                            progressObj.put("totalBytes", totalBytes > 0 ? totalBytes : 0);
                            progressObj.put("status", "downloading");
                            progressObj.put("channelLabel", channelLabel);
                            notifyListeners("downloadProgress", progressObj);
                        }
                    }

                    output.flush();
                    output.close();
                    output = null;

                    if (downloadedBytes < 100 * 1024) {
                        lastError = channelLabel + " 返回的安装包不完整 (" + downloadedBytes + " B)";
                        continue;
                    }

                    lastDownloadedApk = targetFile;

                    JSObject doneObj = new JSObject();
                    doneObj.put("progress", 100);
                    doneObj.put("downloadedBytes", downloadedBytes);
                    doneObj.put("totalBytes", downloadedBytes);
                    doneObj.put("status", "completed");
                    doneObj.put("channelLabel", channelLabel);
                    notifyListeners("downloadProgress", doneObj);

                    getBridge().executeOnMainThread(() -> {
                        installApkInternal(targetFile, call);
                    });
                    return;
                } catch (Exception e) {
                    lastError = channelLabel + " 连接异常: " + e.getMessage();
                } finally {
                    try {
                        if (output != null) output.close();
                        if (input != null) input.close();
                        if (connection != null) connection.disconnect();
                    } catch (Exception ignored) {
                    }
                }
            }

            call.reject("所有下载通道均未成功 (" + lastError + ")，请点击下方「用系统浏览器下载」");
        }).start();
    }

    @PluginMethod
    public void installCachedApk(PluginCall call) {
        if (lastDownloadedApk == null || !lastDownloadedApk.exists()) {
            call.reject("暂无已下载的安装包，请重新点击更新下载");
            return;
        }
        getBridge().executeOnMainThread(() -> {
            installApkInternal(lastDownloadedApk, call);
        });
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is empty");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开外部链接: " + e.getMessage());
        }
    }

    /**
     * 将生成的拍立得分享海报直接存入手机系统相册 (Pictures/记忆手账)
     */
    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName", "记忆手账-" + System.currentTimeMillis() + ".png");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("图片数据为空");
            return;
        }

        new Thread(() -> {
            try {
                String pureBase64 = base64Data;
                int commaIdx = base64Data.indexOf(',');
                if (commaIdx != -1) {
                    pureBase64 = base64Data.substring(commaIdx + 1);
                }
                byte[] imageBytes = Base64.decode(pureBase64, Base64.DEFAULT);

                String safeName = fileName.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]", "_");
                if (!safeName.toLowerCase().endsWith(".png")) {
                    safeName += ".png";
                }

                Context context = getContext();
                ContentResolver resolver = context.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/记忆手账");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                }

                Uri imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (imageUri == null) {
                    call.reject("系统相册创建图片记录失败");
                    return;
                }

                try (OutputStream out = resolver.openOutputStream(imageUri)) {
                    if (out == null) {
                        call.reject("无法写入系统相册输出流");
                        return;
                    }
                    out.write(imageBytes);
                    out.flush();
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(imageUri, values, null, null);
                }

                JSObject res = new JSObject();
                res.put("saved", true);
                res.put("uri", imageUri.toString());
                res.put("album", "相册/记忆手账/" + safeName);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("保存到相册失败: " + e.getMessage());
            }
        }).start();
    }

    /**
     * 将生成的拍立得分享海报通过 Android 原生分享面板发送给微信好友/朋友圈/小红书等
     */
    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName", "记忆手账分享卡.png");
        String title = call.getString("title", "分享手账卡片");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("图片数据为空");
            return;
        }

        new Thread(() -> {
            try {
                String pureBase64 = base64Data;
                int commaIdx = base64Data.indexOf(',');
                if (commaIdx != -1) {
                    pureBase64 = base64Data.substring(commaIdx + 1);
                }
                byte[] imageBytes = Base64.decode(pureBase64, Base64.DEFAULT);

                File shareDir = new File(getContext().getCacheDir(), "shared");
                if (!shareDir.exists()) {
                    shareDir.mkdirs();
                }

                String safeName = fileName.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]", "_");
                if (!safeName.toLowerCase().endsWith(".png")) {
                    safeName += ".png";
                }
                File imageFile = new File(shareDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                    fos.write(imageBytes);
                    fos.flush();
                }

                Context context = getContext();
                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        imageFile
                );

                getBridge().executeOnMainThread(() -> {
                    try {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType("image/png");
                        shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        shareIntent.setClipData(ClipData.newRawUri(title, contentUri));
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(shareIntent, title);
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(chooser);

                        JSObject res = new JSObject();
                        res.put("shared", true);
                        call.resolve(res);
                    } catch (Exception e) {
                        call.reject("调起系统分享失败: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                call.reject("生成分享文件失败: " + e.getMessage());
            }
        }).start();
    }

    private void installApkInternal(File apkFile, PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                boolean canInstall = context.getPackageManager().canRequestPackageInstalls();
                if (!canInstall) {
                    Intent permIntent = new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + context.getPackageName())
                    );
                    permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(permIntent);

                    JSObject res = new JSObject();
                    res.put("installed", false);
                    res.put("needsPermission", true);
                    res.put("message", "请开启「允许安装未知应用」权限后，返回点击「立即安装」");
                    call.resolve(res);
                    return;
                }
            }

            Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(installIntent);

            JSObject res = new JSObject();
            res.put("installed", true);
            res.put("needsPermission", false);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("调起系统安装器失败: " + e.getMessage());
        }
    }
}
