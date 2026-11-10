import { CardType, MemoryCard, PaperColor, ThreadColor } from "@/types/memory";

const VALID_CARD_TYPES = new Set<CardType>([
  "ai_insight",
  "exhibition",
  "milestone",
]);

const VALID_PAPER_COLORS = new Set<PaperColor>([
  "cream",
  "butter",
  "sage",
  "blush",
  "kraft",
]);

const VALID_THREAD_COLORS = new Set<ThreadColor>([
  "crimson",
  "amber",
  "sage",
  "slate",
  "gold",
]);

const VALID_TAPE_STYLES = new Set(["amber", "sage", "rose", "coffee"] as const);

/**
 * 校验并清洗外部 Base URL，防止 SSRF、明文 HTTP、file:// 伪协议及本地内网探测
 */
export function validateSafeAiEndpoint(
  rawBaseUrl: string,
  allowPrivateNetwork = false
): { ok: true; endpoint: string } | { ok: false; error: string } {
  const trimmed = (rawBaseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return { ok: false, error: "接口地址 (Base URL) 不能为空" };
  }

  // 严禁以 '-' 开头防止命令行参数注入
  if (trimmed.startsWith("-")) {
    return { ok: false, error: "非法的接口地址格式" };
  }

  let parsed: URL;
  try {
    parsed = new URL(
      trimmed.endsWith("/chat/completions")
        ? trimmed
        : `${trimmed}/chat/completions`
    );
  } catch {
    return { ok: false, error: "接口地址不是合法的 URL" };
  }

  // 强制要求 HTTPS 协议（阻断 file:, gopher:, http: 等不安全协议）
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "出于安全要求，AI 接口地址必须使用 https:// 加密协议",
    };
  }

  // 禁止 URL 中携带账号密码（user:pass@host）
  if (parsed.username || parsed.password) {
    return { ok: false, error: "接口地址不允许包含内嵌凭据" };
  }

  const host = parsed.hostname.toLowerCase();

  if (!allowPrivateNetwork && isPrivateOrLoopbackHost(host)) {
    return {
      ok: false,
      error: "安全拦截：禁止将服务端代理指向本地回环或内网私有地址",
    };
  }

  return { ok: true, endpoint: parsed.toString() };
}

/**
 * 检测是否为本地回环、链路本地、云元数据或私有内网地址（防 SSRF）
 */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc00:") ||
    host.startsWith("fd00:") ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.")
  ) {
    return true;
  }

  // IPv4 地址段校验
  const ipv4Match = host.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) || // 云厂商 Metadata / 链路本地
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) // CGNAT
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 校验 API Key 格式：剔除控制字符与换行符，防止 HTTP Header 注入或命令参数污染
 */
export function sanitizeApiKey(rawKey: string): {
  ok: boolean;
  apiKey: string;
  error?: string;
} {
  const trimmed = (rawKey || "").trim();
  if (!trimmed) {
    return { ok: false, apiKey: "", error: "未配置 API Key" };
  }
  if (trimmed.length > 512) {
    return { ok: false, apiKey: "", error: "API Key 长度超出安全上限" };
  }
  // 严禁包含换行、回车、空字节等控制字符或非可见 ASCII
  if (/[\r\n\0\x00-\x1F\x7F]/.test(trimmed)) {
    return { ok: false, apiKey: "", error: "API Key 包含非法控制字符" };
  }
  return { ok: true, apiKey: trimmed };
}

/**
 * 校验图片地址安全性：
 * - 仅允许安全的 Base64 位图 data:image/(webp|jpeg|jpg|png|gif);base64,...（排除 data:image/svg+xml 防内嵌脚本）
 * - 或合法的 https:// 图片地址
 */
export function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 8 * 1024 * 1024) return false; // 单张 Base64 上限 8MB

  if (/^data:image\/(webp|jpeg|jpg|png|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function clampString(val: unknown, maxLen: number, fallback = ""): string {
  if (typeof val !== "string") return fallback;
  return val.replace(/\0/g, "").trim().slice(0, maxLen);
}

/**
 * 清洗并校验单条 MemoryCard，防止恶意导入 JSON 触发 Stored XSS、原型链污染或前端渲染崩溃
 */
export function sanitizeMemoryCard(
  raw: unknown,
  indexFallback = 0
): MemoryCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  const rawContent = clampString(obj.rawContent, 20000);
  const title = clampString(obj.title, 200);
  const summary = clampString(obj.summary, 300);

  // 内容与图片均为空的无效记录直接丢弃
  const rawImages = Array.isArray(obj.images)
    ? obj.images.filter(isSafeImageUrl).slice(0, 9)
    : [];

  if (!rawContent && !title && rawImages.length === 0) {
    return null;
  }

  const id =
    clampString(obj.id, 80).replace(/[^a-zA-Z0-9_-]/g, "") ||
    `mem-safe-${Date.now()}-${indexFallback}`;

  const type: CardType = VALID_CARD_TYPES.has(obj.type as CardType)
    ? (obj.type as CardType)
    : "ai_insight";

  let createdAt = clampString(obj.createdAt, 40);
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
    createdAt = new Date().toISOString();
  }

  const dateLabel =
    clampString(obj.dateLabel, 40) || createdAt.slice(0, 10).replace(/-/g, ".");

  const tags = Array.isArray(obj.tags)
    ? Array.from(
        new Set(
          obj.tags
            .map((t) => clampString(t, 24).replace(/^#+/, ""))
            .filter(Boolean)
        )
      ).slice(0, 12)
    : ["灵感"];

  const paperColor: PaperColor | undefined = VALID_PAPER_COLORS.has(
    obj.paperColor as PaperColor
  )
    ? (obj.paperColor as PaperColor)
    : undefined;

  const tapeStyle = VALID_TAPE_STYLES.has(obj.tapeStyle as any)
    ? (obj.tapeStyle as "amber" | "sage" | "rose" | "coffee")
    : undefined;

  const boardX =
    typeof obj.boardX === "number" && Number.isFinite(obj.boardX)
      ? Math.max(-50000, Math.min(50000, Math.round(obj.boardX)))
      : undefined;

  const boardY =
    typeof obj.boardY === "number" && Number.isFinite(obj.boardY)
      ? Math.max(-50000, Math.min(50000, Math.round(obj.boardY)))
      : undefined;

  const rotation =
    typeof obj.rotation === "number" && Number.isFinite(obj.rotation)
      ? Math.max(-25, Math.min(25, obj.rotation))
      : undefined;

  const linkedCardIds = Array.isArray(obj.linkedCardIds)
    ? Array.from(
        new Set(
          obj.linkedCardIds
            .map((cid) => clampString(cid, 80).replace(/[^a-zA-Z0-9_-]/g, ""))
            .filter((cid) => Boolean(cid) && cid !== id)
        )
      ).slice(0, 20)
    : undefined;

  let linkedCardColors: Record<string, ThreadColor> | undefined;
  if (
    obj.linkedCardColors &&
    typeof obj.linkedCardColors === "object" &&
    !Array.isArray(obj.linkedCardColors)
  ) {
    const cleanColors: Record<string, ThreadColor> = {};
    for (const [k, v] of Object.entries(
      obj.linkedCardColors as Record<string, unknown>
    )) {
      const safeId = clampString(k, 80).replace(/[^a-zA-Z0-9_-]/g, "");
      if (safeId && VALID_THREAD_COLORS.has(v as ThreadColor)) {
        cleanColors[safeId] = v as ThreadColor;
      }
    }
    if (Object.keys(cleanColors).length > 0) {
      linkedCardColors = cleanColors;
    }
  }

  return {
    id,
    type,
    createdAt,
    dateLabel,
    tags: tags.length > 0 ? tags : ["灵感"],
    isPinned: Boolean(obj.isPinned),
    boardX,
    boardY,
    rotation,
    paperColor,
    ...(linkedCardIds && linkedCardIds.length > 0 ? { linkedCardIds } : {}),
    ...(linkedCardColors ? { linkedCardColors } : {}),
    rawContent: rawContent || title || "记录此刻",
    ...(summary ? { summary } : {}),
    ...(typeof obj.aiModel === "string" && obj.aiModel.trim()
      ? { aiModel: clampString(obj.aiModel, 60) }
      : {}),
    ...(title ? { title } : {}),
    ...(typeof obj.location === "string" && obj.location.trim()
      ? { location: clampString(obj.location, 100) }
      : {}),
    ...(rawImages.length > 0 ? { images: rawImages } : {}),
    ...(tapeStyle ? { tapeStyle } : {}),
    ...(typeof obj.milestoneBadge === "string" && obj.milestoneBadge.trim()
      ? { milestoneBadge: clampString(obj.milestoneBadge, 30) }
      : {}),
  };
}

/**
 * 批量清洗导入的记忆卡片列表（限制单次最大导入条数，防内存耗尽 DoS）
 */
export function sanitizeImportedMemories(
  rawList: unknown,
  maxItems = 5000
): MemoryCard[] {
  if (!Array.isArray(rawList)) return [];
  const result: MemoryCard[] = [];
  const slice = rawList.slice(0, maxItems);
  for (let i = 0; i < slice.length; i++) {
    const cleaned = sanitizeMemoryCard(slice[i], i);
    if (cleaned) {
      result.push(cleaned);
    }
  }
  return result;
}
