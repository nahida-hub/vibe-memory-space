"use client";

import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Sparkles,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  AppUpdaterNative,
  RemoteReleaseInfo,
  buildMirrorCandidateUrls,
  formatBytes,
  IGNORED_VERSION_STORAGE_KEY,
} from "@/utils/appUpdater";
import { triggerHaptic } from "@/utils/storageDb";

interface UpdateModalProps {
  isOpen: boolean;
  currentVersion: string;
  release: RemoteReleaseInfo | null;
  onClose: () => void;
}

export default function UpdateModal({
  isOpen,
  currentVersion,
  release,
  onClose,
}: UpdateModalProps) {
  const [downloadStatus, setDownloadStatus] = useState<
    "idle" | "downloading" | "ready_to_install" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [channelLabel, setChannelLabel] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [useDirectLink, setUseDirectLink] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDownloadStatus("idle");
      setProgress(0);
      setChannelLabel("");
      setStatusMessage(null);
      return;
    }

    let listenerHandle: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      AppUpdaterNative.addListener("downloadProgress", (ev) => {
        setProgress(ev.progress >= 0 ? ev.progress : 15);
        setDownloadedBytes(ev.downloadedBytes || 0);
        setTotalBytes(ev.totalBytes || 0);
        if (ev.channelLabel) {
          setChannelLabel(ev.channelLabel);
        }
        if (ev.status === "completed") {
          setDownloadStatus("ready_to_install");
        } else {
          setDownloadStatus("downloading");
        }
      }).then((h) => {
        listenerHandle = h;
      });
    }

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [isOpen]);

  if (!isOpen || !release) return null;

  const rawUrl = release.rawApkUrl || release.apkUrl;
  const candidateUrls = buildMirrorCandidateUrls(rawUrl, !useDirectLink);
  const targetApkUrl =
    candidateUrls[0] ||
    (useDirectLink
      ? release.rawApkUrl || release.apkUrl
      : release.apkUrl || release.rawApkUrl);

  const startDownloadWithMode = async (directMode: boolean) => {
    triggerHaptic(10);
    setStatusMessage(null);

    const urls = buildMirrorCandidateUrls(rawUrl, !directMode);
    const primaryUrl =
      urls[0] ||
      (directMode
        ? release.rawApkUrl || release.apkUrl
        : release.apkUrl || release.rawApkUrl);

    if (!primaryUrl) {
      if (release.htmlUrl) {
        handleOpenBrowser(release.htmlUrl);
      } else {
        setDownloadStatus("error");
        setStatusMessage("当前 Release 尚未附带 APK 安装包文件");
      }
      return;
    }

    // 如果是在网页浏览器中打开，直接跳转下载链接
    if (!Capacitor.isNativePlatform()) {
      window.open(primaryUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      setDownloadStatus("downloading");
      setProgress(1);
      setDownloadedBytes(0);
      setTotalBytes(release.apkSizeBytes || 0);
      setChannelLabel(directMode ? "GitHub 源站直连" : "加速节点 1 (gh-proxy)");

      const res = await AppUpdaterNative.downloadAndInstallApk({
        url: primaryUrl,
        urls,
        fileName: `vibe-memory-v${release.versionName}.apk`,
        expectedBytes: release.apkSizeBytes,
      });
      setDownloadStatus("ready_to_install");
      if (res.needsPermission) {
        setStatusMessage(
          res.message ||
            "请在系统设置中开启「允许安装未知应用」，然后返回点击下方「立即调起安装」"
        );
      } else {
        setStatusMessage("已调起系统安装器，请点击「继续安装 / 更新」");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("已取消")) {
        return;
      }
      setDownloadStatus("error");
      setStatusMessage(
        msg || "应用内下载失败，可尝试切换通道或使用浏览器下载"
      );
    }
  };

  const handleStartInAppUpdate = () => {
    startDownloadWithMode(useDirectLink);
  };

  const handleSwitchChannel = async () => {
    triggerHaptic(8);
    const nextDirect = !useDirectLink;
    setUseDirectLink(nextDirect);
    // 如果当前正卡在下载中，切换通道时立即中断旧连接并用新通道重新开始下载
    if (downloadStatus === "downloading") {
      try {
        await AppUpdaterNative.cancelDownload();
      } catch {
        // ignore
      }
      startDownloadWithMode(nextDirect);
    }
  };

  const handleCancelAndClose = async () => {
    if (downloadStatus === "downloading" && Capacitor.isNativePlatform()) {
      try {
        await AppUpdaterNative.cancelDownload();
      } catch {
        // ignore
      }
    }
    setDownloadStatus("idle");
    onClose();
  };

  const handleReinstallCached = async () => {
    triggerHaptic(8);
    try {
      const res = await AppUpdaterNative.installCachedApk();
      if (res.needsPermission) {
        setStatusMessage(
          res.message || "请先开启「允许安装未知应用」权限后再试"
        );
      }
    } catch (err: any) {
      setStatusMessage(err?.message || "请重新点击下载更新");
    }
  };

  const handleOpenBrowser = async (urlToOpen?: string) => {
    triggerHaptic(8);
    const url = urlToOpen || targetApkUrl || release.htmlUrl || "";
    if (!url) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await AppUpdaterNative.openExternalUrl({ url });
        return;
      } catch {
        // fallback
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleIgnoreThisVersion = () => {
    triggerHaptic(6);
    try {
      localStorage.setItem(IGNORED_VERSION_STORAGE_KEY, release.versionName);
    } catch {
      // ignore
    }
    onClose();
  };

  return (
    <div
      onClick={downloadStatus === "downloading" ? undefined : onClose}
      className="fixed inset-0 z-50 bg-[#261E16]/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#FBF6E9] border border-[#DFD2BA] paper-shadow overflow-hidden flex flex-col"
      >
        {/* 顶部手账风横幅 */}
        <div className="px-5 py-4 bg-[#F3E9D6] border-b border-[#E4D6BE] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#2C251E] text-[#E8C589] flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2C251E]">
                发现新版本 v{release.versionName}
              </h3>
              <p className="text-[11px] text-[#7D6E5D]">
                当前版本 v{currentVersion}
                {release.publishedAt ? ` · 发布于 ${release.publishedAt}` : ""}
                {release.apkSizeBytes
                  ? ` · ${formatBytes(release.apkSizeBytes)}`
                  : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancelAndClose}
            className="p-1.5 rounded-full text-[#7E7060] hover:text-[#2C251E] hover:bg-[#E6DAC4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体内容 */}
        <div className="p-5 space-y-4">
          {/* 更新日志卡片 */}
          <div className="p-3.5 rounded-2xl bg-[#FFFDF8] border border-[#E5D9C3] max-h-48 overflow-y-auto">
            <div className="text-[11px] font-semibold text-[#6E5F4F] mb-1.5">
              更新内容
            </div>
            <div className="text-xs text-[#2C251E] whitespace-pre-wrap leading-relaxed">
              {release.releaseNotes}
            </div>
          </div>

          {/* 数据无损保障提示 */}
          <div className="px-3.5 py-2.5 rounded-xl bg-[#EBF3E8] border border-[#CBE0C4] flex items-start gap-2 text-[11px] text-[#395434]">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#496044]" />
            <span>
              采用固定签名覆盖升级，你手机里的所有手账便签、拍立得照片与 AI
              配置将 <strong>100% 完整保留</strong>，请勿卸载旧版本。
            </span>
          </div>

          {/* 下载进度条 */}
          {downloadStatus === "downloading" && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-[#F4ECE0] border border-[#E2D5BE]">
              <div className="flex items-center justify-between text-xs font-medium text-[#3F3428]">
                <span className="truncate pr-2">
                  {channelLabel
                    ? `正在通过 ${channelLabel} 下载...`
                    : "正在下载更新包..."}
                </span>
                <span className="shrink-0 font-mono">
                  {progress >= 0 ? `${progress}%` : "下载中"}
                  {totalBytes > 0
                    ? ` (${formatBytes(downloadedBytes)} / ${formatBytes(
                        totalBytes
                      )})`
                    : downloadedBytes > 0
                    ? ` (${formatBytes(downloadedBytes)})`
                    : ""}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#E3D7C1] overflow-hidden">
                <div
                  className="h-full bg-[#496044] transition-all duration-200 rounded-full"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
            </div>
          )}

          {/* 状态消息反馈 */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                downloadStatus === "error"
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-[#F4ECE0] border border-[#DFD2BA] text-[#4A3E31]"
              }`}
            >
              {downloadStatus === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#496044]" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* 操作按钮组 */}
          <div className="space-y-2 pt-1">
            {downloadStatus === "ready_to_install" ? (
              <button
                type="button"
                onClick={handleReinstallCached}
                className="w-full py-3 rounded-2xl text-xs font-semibold bg-[#496044] text-white flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>下载已完成，点击调起系统安装</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={downloadStatus === "downloading"}
                onClick={handleStartInAppUpdate}
                className="w-full py-3 rounded-2xl text-xs font-semibold bg-[#2C251E] hover:bg-[#3B3229] disabled:opacity-60 text-[#FBF6E9] flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#E8C589]" />
                <span>
                  {downloadStatus === "downloading"
                    ? "正在下载安装包 (超时将自动切换节点)..."
                    : "立即下载并覆盖更新"}
                </span>
              </button>
            )}

            {/* 备选：切换直连/镜像 或 浏览器下载 */}
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-[#7D6E5D]">
              <div className="flex items-center gap-3">
                {release.rawApkUrl && (
                  <button
                    type="button"
                    onClick={handleSwitchChannel}
                    className="inline-flex items-center gap-1 hover:text-[#2C251E] underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>
                      {useDirectLink
                        ? "切换国内镜像加速"
                        : "切换 GitHub 直连"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenBrowser()}
                  className="inline-flex items-center gap-1 hover:text-[#2C251E] underline cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>用系统浏览器下载</span>
                </button>
              </div>

              {downloadStatus !== "downloading" && (
                <button
                  type="button"
                  onClick={handleIgnoreThisVersion}
                  className="hover:text-[#2C251E] cursor-pointer"
                >
                  忽略此版本
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
