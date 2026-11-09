import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const versionName = (pkg.version || "0.1.0").replace(/^[vV]/, "");
const versionCode = typeof pkg.versionCode === "number" ? pkg.versionCode : 1;
const today = new Date().toISOString().slice(0, 10);
const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO || pkg.githubRepo || "";

console.log(
  `🔖 [0/3] 同步版本号 v${versionName} (Build ${versionCode}) 至前端与 Android 原生配置...`
);

// 1. 同步 src/utils/versionInfo.ts
const versionInfoPath = path.join(rootDir, "src", "utils", "versionInfo.ts");
const versionInfoContent = `// 此文件由构建脚本 (scripts/build-android-bundle.mjs / scripts/bump-version.mjs) 自动同步
export const APP_VERSION = "${versionName}";
export const APP_VERSION_CODE = ${versionCode};
export const BUILD_DATE = "${today}";
export const DEFAULT_GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || "${githubRepo}";
export const DEFAULT_UPDATE_JSON_URL = process.env.NEXT_PUBLIC_UPDATE_JSON_URL || "";
`;
fs.writeFileSync(versionInfoPath, versionInfoContent, "utf8");

// 2. 同步 public/version.json
const versionJsonPath = path.join(rootDir, "public", "version.json");
const versionJson = {
  versionName,
  versionCode,
  publishedAt: today,
  releaseNotes:
    pkg.releaseNotes ||
    `v${versionName} 版本更新：支持手账便签墙、拍立得照片与在线覆盖更新。`,
  apkUrl: githubRepo
    ? `https://github.com/${githubRepo}/releases/download/v${versionName}/记忆手账.apk`
    : "http://192.168.31.132:3000/记忆手账.apk",
};
fs.writeFileSync(
  versionJsonPath,
  JSON.stringify(versionJson, null, 2) + "\n",
  "utf8"
);

// 3. 同步 android/app/build.gradle
const gradlePath = path.join(rootDir, "android", "app", "build.gradle");
if (fs.existsSync(gradlePath)) {
  let gradleContent = fs.readFileSync(gradlePath, "utf8");
  gradleContent = gradleContent
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
  fs.writeFileSync(gradlePath, gradleContent, "utf8");
}

const apiDir = path.join(rootDir, "src", "app", "api");
const backupApiDir = path.join(rootDir, "src", "_api_server_backup");

console.log("📦 [1/3] 准备编译独立离线静态包 (out/) ...");

// 避免将上一次供局域网下载的 public/记忆手账.apk 打包进静态资源包内导致 APK 体积翻倍
const publicApkPath = path.join(rootDir, "public", "记忆手账.apk");
if (fs.existsSync(publicApkPath)) {
  fs.unlinkSync(publicApkPath);
}

let movedApi = false;
try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, backupApiDir);
    movedApi = true;
  }

  execSync("STATIC_EXPORT=true npx next build", {
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "true" },
  });
} finally {
  if (movedApi && fs.existsSync(backupApiDir)) {
    fs.renameSync(backupApiDir, apiDir);
  }
}

console.log("🤖 [2/3] 检查并初始化 Capacitor Android 原生工程...");
if (!fs.existsSync(path.join(rootDir, "android"))) {
  execSync("npx cap add android", { stdio: "inherit" });
}

console.log("🔄 [3/3] 将最新手账静态资源同步至 Android 原生工程 (android/)...");
execSync("npx cap sync android", { stdio: "inherit" });

console.log(
  `\n✅ Capacitor Android 原生工程与静态离线包 (v${versionName}, Build ${versionCode}) 已全部同步就绪！`
);
