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

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private File lastDownloadedApk = null;

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

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        final String apkUrl = call.getString("url");
        final String fileName = call.getString("fileName", "vibe-memory-update.apk");

        if (apkUrl == null || apkUrl.trim().isEmpty()) {
            call.reject("Missing APK download URL");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            InputStream input = null;
            FileOutputStream output = null;
            try {
                File updateDir = new File(getContext().getCacheDir(), "updates");
                if (!updateDir.exists()) {
                    updateDir.mkdirs();
                }

                String safeName = fileName.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]", "_");
                if (!safeName.endsWith(".apk")) {
                    safeName += ".apk";
                }
                File targetFile = new File(updateDir, safeName);
                if (targetFile.exists()) {
                    targetFile.delete();
                }

                String currentUrl = apkUrl;
                int redirectCount = 0;
                while (redirectCount < 8) {
                    URL url = new URL(currentUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "VibeMemoryNotebook-Updater/1.0");
                    connection.connect();

                    int status = connection.getResponseCode();
                    if (status == HttpURLConnection.HTTP_MOVED_TEMP
                            || status == HttpURLConnection.HTTP_MOVED_PERM
                            || status == HttpURLConnection.HTTP_SEE_OTHER
                            || status == 307
                            || status == 308) {
                        String nextUrl = connection.getHeaderField("Location");
                        connection.disconnect();
                        currentUrl = nextUrl;
                        redirectCount++;
                        continue;
                    }
                    break;
                }

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    call.reject("HTTP " + responseCode + ": 下载安装包失败");
                    return;
                }

                int totalBytes = connection.getContentLength();
                input = connection.getInputStream();
                output = new FileOutputStream(targetFile);

                byte[] buffer = new byte[16384];
                long downloadedBytes = 0;
                int count;
                long lastNotifyTime = 0;

                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                    downloadedBytes += count;

                    long now = System.currentTimeMillis();
                    if (now - lastNotifyTime >= 120 || downloadedBytes == totalBytes) {
                        lastNotifyTime = now;
                        int progress = totalBytes > 0
                                ? (int) Math.min(100, (downloadedBytes * 100L) / totalBytes)
                                : -1;
                        JSObject progressObj = new JSObject();
                        progressObj.put("progress", progress);
                        progressObj.put("downloadedBytes", downloadedBytes);
                        progressObj.put("totalBytes", totalBytes);
                        progressObj.put("status", "downloading");
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                output.flush();
                lastDownloadedApk = targetFile;

                JSObject doneObj = new JSObject();
                doneObj.put("progress", 100);
                doneObj.put("downloadedBytes", downloadedBytes);
                doneObj.put("totalBytes", downloadedBytes);
                doneObj.put("status", "completed");
                notifyListeners("downloadProgress", doneObj);

                getBridge().executeOnMainThread(() -> {
                    installApkInternal(targetFile, call);
                });
            } catch (Exception e) {
                call.reject("下载更新包出错: " + e.getMessage());
            } finally {
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                    if (connection != null) connection.disconnect();
                } catch (Exception ignored) {
                }
            }
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
