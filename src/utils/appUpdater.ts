import { Capacitor, registerPlugin, PluginListenerHandle } from "@capacitor/core";
import {
  APP_VERSION,
  APP_VERSION_CODE,
  DEFAULT_GITHUB_REPO,
  DEFAULT_UPDATE_JSON_URL,
} from "./versionInfo";

export interface NativeAppInfo {
  versionName: string;
  versionCode: number;
  packageName: string;
}

export interface DownloadProgressEvent {
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  status: "downloading" | "completed";
}

export interface InstallResult {
  installed: boolean;
  needsPermission?: boolean;
  message?: string;
}

interface AppUpdaterPluginInterface {
  getAppInfo(): Promise<NativeAppInfo>;
  downloadAndInstallApk(options: {
    url: string;
    fileName?: string;
  }): Promise<InstallResult>;
  installCachedApk(): Promise<InstallResult>;
  openExternalUrl(options: { url: string }): Promise<void>;
  addListener(
    eventName: "downloadProgress",
    listenerFunc: (event: DownloadProgressEvent) => void
  ): Promise<PluginListenerHandle>;
}

export const AppUpdaterNative =
  registerPlugin<AppUpdaterPluginInterface>("AppUpdater");

export interface UpdateConfig {
  githubRepo: string;
  customJsonUrl: string;
  useMirror: boolean;
  autoCheckOnLaunch: boolean;
}

export const UPDATE_CONFIG_STORAGE_KEY = "vibe_memory_update_config_v1";
export const IGNORED_VERSION_STORAGE_KEY = "vibe_memory_ignored_version_v1";

export const DEFAULT_LAN_UPDATE_JSON_URL =
  "http://192.168.31.132:3000/version.json";

export const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
  githubRepo: DEFAULT_GITHUB_REPO,
  customJsonUrl: DEFAULT_UPDATE_JSON_URL || DEFAULT_LAN_UPDATE_JSON_URL,
  useMirror: true,
  autoCheckOnLaunch: true,
};

export interface RemoteReleaseInfo {
  versionName: string;
  versionCode?: number;
  releaseNotes: string;
  publishedAt: string;
  apkUrl: string;
  rawApkUrl: string;
  apkSizeBytes?: number;
  htmlUrl?: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  currentVersionCode: number;
  latest?: RemoteReleaseInfo;
  error?: string;
}

export function loadUpdateConfig(): UpdateConfig {
  if (typeof window === "undefined") return DEFAULT_UPDATE_CONFIG;
  try {
    const raw = localStorage.getItem(UPDATE_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_UPDATE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_UPDATE_CONFIG,
      ...parsed,
      githubRepo: normalizeGithubRepo(
        parsed.githubRepo ?? DEFAULT_UPDATE_CONFIG.githubRepo
      ),
    };
  } catch {
    return DEFAULT_UPDATE_CONFIG;
  }
}

export function saveUpdateConfig(config: UpdateConfig): UpdateConfig {
  const normalized: UpdateConfig = {
    ...config,
    githubRepo: normalizeGithubRepo(config.githubRepo),
    customJsonUrl: (config.customJsonUrl || "").trim(),
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        UPDATE_CONFIG_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      // ignore
    }
  }
  return normalized;
}

export function normalizeGithubRepo(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  try {
    const cleaned = trimmed
      .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "");
    const parts = cleaned.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return cleaned;
  } catch {
    return trimmed;
  }
}

export async function getCurrentAppVersion(): Promise<NativeAppInfo> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await AppUpdaterNative.getAppInfo();
    } catch {
      // fallback to build constants
    }
  }
  return {
    versionName: APP_VERSION,
    versionCode: APP_VERSION_CODE,
    packageName: "com.vibememory.notebook",
  };
}

export function cleanVersionString(v: string): string {
  return (v || "").trim().replace(/^[vV]/, "");
}

/**
 * 语义化版本号对比：若 a > b 返回 1，a < b 返回 -1，相等返回 0
 */
export function compareSemver(a: string, b: string): number {
  const pa = cleanVersionString(a)
    .split(/[.-]/)
    .map((n) => parseInt(n, 10) || 0);
  const pb = cleanVersionString(b)
    .split(/[.-]/)
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function applyMirrorIfNeeded(url: string, useMirror: boolean): string {
  if (!url) return "";
  if (
    useMirror &&
    (url.startsWith("https://github.com/") ||
      url.startsWith("https://raw.githubusercontent.com/"))
  ) {
    return `https://ghfast.top/${url}`;
  }
  return url;
}

export async function checkForAppUpdate(
  customConfig?: UpdateConfig
): Promise<UpdateCheckResult> {
  const config = customConfig || loadUpdateConfig();
  const current = await getCurrentAppVersion();

  const repo = normalizeGithubRepo(config.githubRepo);
  const jsonUrl =
    (config.customJsonUrl || "").trim() ||
    (!repo ? DEFAULT_LAN_UPDATE_JSON_URL : "");

  if (!repo && !jsonUrl) {
    return {
      hasUpdate: false,
      currentVersion: current.versionName,
      currentVersionCode: current.versionCode,
      error: "请先在「设置 → 版本与更新」中填入你的 GitHub 仓库名（如 owner/repo）或更新源地址",
    };
  }

  try {
    // 1. 若配置了 GitHub 仓库且未显式覆盖自定义 JSON，优先查 GitHub Releases；否则请求 version.json 更新源
    if (jsonUrl && !repo) {
      const sep = jsonUrl.includes("?") ? "&" : "?";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${jsonUrl}${sep}_t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) {
        throw new Error(`请求更新源失败 (HTTP ${res.status})`);
      }
      const data = await res.json();
      const remoteVersionName = cleanVersionString(
        data.versionName || data.version || ""
      );
      const remoteVersionCode =
        typeof data.versionCode === "number" ? data.versionCode : undefined;
      const rawApkUrl = data.apkUrl || data.downloadUrl || "";

      const isNewer =
        remoteVersionCode && current.versionCode
          ? remoteVersionCode > current.versionCode ||
            compareSemver(remoteVersionName, current.versionName) > 0
          : compareSemver(remoteVersionName, current.versionName) > 0;

      return {
        hasUpdate: isNewer,
        currentVersion: current.versionName,
        currentVersionCode: current.versionCode,
        latest: {
          versionName: remoteVersionName,
          versionCode: remoteVersionCode,
          releaseNotes:
            data.releaseNotes || data.changelog || "常规优化与体验改进",
          publishedAt: data.publishedAt || "",
          rawApkUrl,
          apkUrl: applyMirrorIfNeeded(rawApkUrl, config.useMirror),
          apkSizeBytes: data.apkSizeBytes,
          htmlUrl: data.htmlUrl,
        },
      };
    }

    // 2. 从 GitHub Releases API 获取最新发布版本
    const releaseApiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    const res = await fetch(releaseApiUrl, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });

    if (res.status === 404) {
      return {
        hasUpdate: false,
        currentVersion: current.versionName,
        currentVersionCode: current.versionCode,
        error: `仓库 ${repo} 尚未发布任何 Release（推送代码后 GitHub Actions 会自动生成首个 Release）`,
      };
    }

    if (!res.ok) {
      throw new Error(`GitHub API 响应异常 (HTTP ${res.status})`);
    }

    const release = await res.json();
    const remoteVersionName = cleanVersionString(
      release.tag_name || release.name || "0.1.0"
    );

    const assets: Array<{
      name: string;
      browser_download_url: string;
      size: number;
    }> = Array.isArray(release.assets) ? release.assets : [];

    const apkAsset = assets.find((a) =>
      a.name.toLowerCase().endsWith(".apk")
    );
    const rawApkUrl = apkAsset ? apkAsset.browser_download_url : "";
    const isNewer = compareSemver(remoteVersionName, current.versionName) > 0;

    return {
      hasUpdate: isNewer,
      currentVersion: current.versionName,
      currentVersionCode: current.versionCode,
      latest: {
        versionName: remoteVersionName,
        releaseNotes:
          (release.body || "").trim() || "包含功能更新与细节体验优化。",
        publishedAt: release.published_at
          ? new Date(release.published_at).toISOString().slice(0, 10)
          : "",
        rawApkUrl,
        apkUrl: applyMirrorIfNeeded(rawApkUrl, config.useMirror),
        apkSizeBytes: apkAsset?.size,
        htmlUrl: release.html_url,
      },
    };
  } catch (err: any) {
    return {
      hasUpdate: false,
      currentVersion: current.versionName,
      currentVersionCode: current.versionCode,
      error: err?.message || "检查更新失败，请检查网络连接",
    };
  }
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
