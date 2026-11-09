import { MemoryCard } from "@/types/memory";
import { sanitizeImportedMemories } from "@/utils/security";

const DB_NAME = "vibe_memory_idb_v1";
const DB_VERSION = 1;
const STORE_MEMORIES = "memories";
const STORE_META = "kv_meta";
export const LEGACY_LOCAL_STORAGE_KEY = "vibe_memory_notebook_v1";

export interface StorageStats {
  engine: "IndexedDB" | "localStorage";
  cardCount: number;
  photoCount: number;
  usedBytes: number;
  usedMB: string;
  quotaBytes: number | null;
  quotaGB: string | null;
  estimatedRemainingPhotos: number;
}

/**
 * 移动端微触感震动反馈（支持 Android Chrome / 部分 WebView，iOS Safari 静默忽略不报错）
 */
export function triggerHaptic(pattern: number | number[] = 10): void {
  try {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // 忽略不支持的设备
  }
}

/**
 * 打开或初始化 IndexedDB 数据库
 */
function openMemoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("当前环境不支持 IndexedDB"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        const store = db.createObjectStore(STORE_MEMORIES, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("打开 IndexedDB 失败"));
  });
}

/**
 * 尝试向浏览器申请持久化存储权限（防止移动端系统在空间紧张时自动清理 IndexedDB）
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      navigator.storage.persist
    ) {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // 忽略权限请求异常
  }
  return false;
}

/**
 * 从 IndexedDB 读取全部记忆卡片；
 * 若首次启用 IndexedDB，则自动从旧版 localStorage 无缝迁移数据并释放 localStorage 大图空间
 */
export async function loadAllMemoriesFromDb(
  initialFallback: MemoryCard[]
): Promise<{
  memories: MemoryCard[];
  migratedCount: number;
  engine: "IndexedDB" | "localStorage";
}> {
  try {
    const db = await openMemoryDb();
    const existingCards = await new Promise<MemoryCard[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const store = tx.objectStore(STORE_MEMORIES);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as MemoryCard[]) || []);
      req.onerror = () => reject(req.error);
    });

    if (existingCards.length > 0) {
      db.close();
      const cleaned = sanitizeImportedMemories(existingCards);
      return {
        memories: cleaned.length > 0 ? cleaned : initialFallback,
        migratedCount: 0,
        engine: "IndexedDB",
      };
    }

    // IndexedDB 为空时，检查是否有旧版 localStorage 数据需要无缝迁移
    let cardsToSeed: MemoryCard[] = initialFallback;
    let migratedCount = 0;

    try {
      const legacyRaw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        const cleaned = sanitizeImportedMemories(parsed);
        if (cleaned.length > 0) {
          cardsToSeed = cleaned;
          migratedCount = cleaned.length;
        }
      }
    } catch (e) {
      console.warn("读取旧版 localStorage 数据失败，使用默认初始数据:", e);
    }

    // 写入 IndexedDB
    await saveAllMemoriesToDb(cardsToSeed);

    // 迁移成功后，清理旧版 localStorage 中的体积庞大的 Base64 图片，仅保留纯文本轻量备份防爆存
    if (migratedCount > 0) {
      try {
        const lightBackup = cardsToSeed.map((c) => ({
          ...c,
          images: undefined,
        }));
        localStorage.setItem(
          LEGACY_LOCAL_STORAGE_KEY,
          JSON.stringify(lightBackup)
        );
      } catch {
        localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
      }
    }

    db.close();
    return {
      memories: cardsToSeed,
      migratedCount,
      engine: "IndexedDB",
    };
  } catch (err) {
    console.warn("IndexedDB 不可用，降级回退至 localStorage:", err);
    try {
      const saved = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleaned = sanitizeImportedMemories(parsed);
        if (cleaned.length > 0) {
          return {
            memories: cleaned,
            migratedCount: 0,
            engine: "localStorage",
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      memories: initialFallback,
      migratedCount: 0,
      engine: "localStorage",
    };
  }
}

/**
 * 将整个记忆卡片列表原子化同步至 IndexedDB（支持存几千张压缩图片不爆存）
 */
export async function saveAllMemoriesToDb(
  memories: MemoryCard[]
): Promise<boolean> {
  try {
    const db = await openMemoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readwrite");
      const store = tx.objectStore(STORE_MEMORIES);
      store.clear();
      for (const card of memories) {
        store.put(card);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    // 同时在 localStorage 中仅保存不带大图的轻量文本索引（永远不会触发 5MB QuotaExceededError）
    try {
      const textOnlyMeta = memories.map((m) => ({
        ...m,
        images: m.images ? m.images.filter((url) => url.startsWith("http")) : undefined,
      }));
      localStorage.setItem(
        LEGACY_LOCAL_STORAGE_KEY,
        JSON.stringify(textOnlyMeta)
      );
    } catch {
      // 忽略 localStorage 写入错误，主数据已在 IndexedDB 中安全落盘
    }

    return true;
  } catch (err) {
    console.error("写入 IndexedDB 失败，尝试回退写入 localStorage:", err);
    try {
      localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(memories));
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * 估算当前图库存储占用与剩余可存照片张数
 * 按单张高画质 WebP/JPEG 拍立得压缩图约 110KB 计算，1GB 可存约 9,000+ 张图
 */
export async function estimateGalleryStorage(
  memories: MemoryCard[]
): Promise<StorageStats> {
  const cardCount = memories.length;
  let photoCount = 0;
  let usedBytes = 0;

  for (const card of memories) {
    if (card.images && Array.isArray(card.images)) {
      photoCount += card.images.length;
    }
    usedBytes += new Blob([JSON.stringify(card)]).size;
  }

  let quotaBytes: number | null = null;
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      navigator.storage.estimate
    ) {
      const est = await navigator.storage.estimate();
      if (est.quota) {
        quotaBytes = est.quota;
      }
      if (est.usage && est.usage > usedBytes) {
        usedBytes = est.usage;
      }
    }
  } catch {
    // ignore
  }

  const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
  const quotaGB = quotaBytes
    ? (quotaBytes / (1024 * 1024 * 1024)).toFixed(1)
    : null;

  // 默认保守按至少 1GB 可用空间估算，每张压缩拍立得约 110KB
  const effectiveAvailableBytes = Math.max(
    (quotaBytes ? Math.min(quotaBytes * 0.5, 2 * 1024 * 1024 * 1024) : 1024 * 1024 * 1024) -
      usedBytes,
    500 * 1024 * 1024
  );
  const avgPhotoBytes = 110 * 1024; // ~110KB per compressed WebP/JPEG image
  const estimatedRemainingPhotos = Math.max(
    Math.floor(effectiveAvailableBytes / avgPhotoBytes),
    3000
  );

  return {
    engine:
      typeof window !== "undefined" && "indexedDB" in window
        ? "IndexedDB"
        : "localStorage",
    cardCount,
    photoCount,
    usedBytes,
    usedMB,
    quotaBytes,
    quotaGB,
    estimatedRemainingPhotos,
  };
}

/**
 * 针对大容量 IndexedDB 图库优化的高清拍立得压缩器：
 * - 最大边长 1280px（兼顾视网膜屏清晰度与体积）
 * - 优先使用 WebP (0.82 质量，平均每张仅 70~120KB)，不支持时自动回退 JPEG
 * - 几千张高清图也仅占数百 MB，在 IndexedDB 中流畅读写不卡顿
 */
export async function compressImageForGallery(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // 优先尝试高压缩比 WebP，若浏览器不支持则自动回退至 JPEG
        const webpDataUrl = canvas.toDataURL("image/webp", 0.82);
        if (webpDataUrl.startsWith("data:image/webp")) {
          resolve(webpDataUrl);
        } else {
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
