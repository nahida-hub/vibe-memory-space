import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const bumpType = process.argv[2] || "patch"; // patch | minor | major
const customNotes = process.argv.slice(3).join(" ").trim();

const parts = (pkg.version || "0.1.0")
  .replace(/^[vV]/, "")
  .split(".")
  .map((n) => parseInt(n, 10) || 0);

while (parts.length < 3) parts.push(0);

if (bumpType === "major") {
  parts[0] += 1;
  parts[1] = 0;
  parts[2] = 0;
} else if (bumpType === "minor") {
  parts[1] += 1;
  parts[2] = 0;
} else if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
  const customParts = bumpType.split(".").map((n) => parseInt(n, 10));
  parts[0] = customParts[0];
  parts[1] = customParts[1];
  parts[2] = customParts[2];
} else {
  parts[2] += 1;
}

const nextVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
const nextVersionCode = (typeof pkg.versionCode === "number" ? pkg.versionCode : 1) + 1;
const today = new Date().toISOString().slice(0, 10);

pkg.version = nextVersion;
pkg.versionCode = nextVersionCode;
if (customNotes) {
  pkg.releaseNotes = customNotes;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

// 同步更新 android/app/build.gradle
const gradlePath = path.join(rootDir, "android", "app", "build.gradle");
if (fs.existsSync(gradlePath)) {
  let gradleContent = fs.readFileSync(gradlePath, "utf8");
  gradleContent = gradleContent
    .replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${nextVersion}"`);
  fs.writeFileSync(gradlePath, gradleContent, "utf8");
}

// 同步更新 public/version.json
const versionJsonPath = path.join(rootDir, "public", "version.json");
const versionJson = {
  versionName: nextVersion,
  versionCode: nextVersionCode,
  publishedAt: today,
  releaseNotes:
    pkg.releaseNotes || `v${nextVersion} 版本更新：体验优化与功能改进。`,
  apkUrl: pkg.githubRepo
    ? `https://github.com/${pkg.githubRepo}/releases/download/v${nextVersion}/记忆手账.apk`
    : "http://192.168.31.132:3000/记忆手账.apk",
};
fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2) + "\n", "utf8");

// 同步更新 src/utils/versionInfo.ts
const versionInfoPath = path.join(rootDir, "src", "utils", "versionInfo.ts");
const versionInfoContent = `// 此文件由构建脚本 (scripts/build-android-bundle.mjs / scripts/bump-version.mjs) 自动同步
export const APP_VERSION = "${nextVersion}";
export const APP_VERSION_CODE = ${nextVersionCode};
export const BUILD_DATE = "${today}";
export const DEFAULT_GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || "${pkg.githubRepo || ""}";
export const DEFAULT_UPDATE_JSON_URL = process.env.NEXT_PUBLIC_UPDATE_JSON_URL || "";
`;
fs.writeFileSync(versionInfoPath, versionInfoContent, "utf8");

console.log(`✅ 版本号已升级至 v${nextVersion} (versionCode: ${nextVersionCode})`);
console.log(`   - package.json`);
console.log(`   - android/app/build.gradle`);
console.log(`   - public/version.json`);
console.log(`   - src/utils/versionInfo.ts`);
console.log(`\n💡 接下来只需执行：`);
console.log(`   - 本地编译新安装包：npm run apk:compile`);
console.log(`   - 或推送到 GitHub 自动发布更新：git add . && git commit -m "release: v${nextVersion}" && git push`);
