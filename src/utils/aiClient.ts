import { AiConfig, DEFAULT_AI_CONFIG, DEFAULT_SYSTEM_PROMPT } from "@/types/aiConfig";
import { CardType, MemoryCard } from "@/types/memory";
import { distillContentWithLocalAI } from "@/data/mockMemories";
import { sanitizeApiKey, validateSafeAiEndpoint } from "@/utils/security";

export interface DistillResult {
  summary: string;
  tags: string[];
  detectedType: CardType;
  modelUsed: string;
  isRealAi: boolean;
  channel: "direct" | "server" | "offline_local";
  latencyMs?: number;
  error?: string;
}

export interface PolishResult {
  title: string;
  polishedContent: string;
  tags: string[];
  modelUsed: string;
  isRealAi: boolean;
}

export interface AiMemoryReviewResult {
  headline: string;
  keywords: string[];
  reflection: string;
  spark: string;
  modelUsed: string;
  isRealAi: boolean;
  latencyMs?: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  channel: "direct" | "server";
  latencyMs: number;
  model: string;
  reply?: string;
  error?: string;
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const check = validateSafeAiEndpoint(baseUrl || DEFAULT_AI_CONFIG.baseUrl, true);
  if (!check.ok) {
    throw new Error(check.error);
  }
  return check.endpoint;
}

function buildExtraPayload(baseUrl: string, model: string, enableThinking: boolean) {
  const isDeepSeek =
    baseUrl.includes("deepseek.com") || model.toLowerCase().includes("deepseek");
  const extra: Record<string, unknown> = {};
  if (isDeepSeek && !enableThinking) {
    extra.thinking = { type: "disabled" };
  }
  return extra;
}

function parseAiDistillJson(rawReply: string): {
  summary: string;
  tags: string[];
  detectedType: CardType;
} {
  const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
  let parsed: {
    summary?: string;
    tags?: string[];
    detectedType?: CardType;
  } = {};

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { summary: rawReply.trim().slice(0, 32) };
    }
  } else {
    parsed = { summary: rawReply.trim().slice(0, 32) };
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags
        .map((t) => String(t).replace(/^#/, "").trim())
        .filter(Boolean)
    : ["AI灵感"];

  const detectedType: CardType =
    parsed.detectedType === "exhibition" ||
    parsed.detectedType === "milestone" ||
    parsed.detectedType === "ai_insight"
      ? parsed.detectedType
      : "ai_insight";

  return {
    summary: (parsed.summary || rawReply.trim().slice(0, 30)).trim(),
    tags: tags.length > 0 ? tags : ["AI灵感"],
    detectedType,
  };
}

/**
 * 手机/浏览器端独立直连 DeepSeek / OpenAI 兼容接口（完全脱离电脑服务端，有网即可独立运行）
 */
async function callAiDirectFromBrowser(
  rawContent: string,
  aiConfig: AiConfig
): Promise<DistillResult> {
  const startTime = Date.now();
  const baseUrl = aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl;
  const keyCheck = sanitizeApiKey(aiConfig.apiKey || DEFAULT_AI_CONFIG.apiKey);
  if (!keyCheck.ok) {
    throw new Error(keyCheck.error || "未配置 API Key");
  }
  const apiKey = keyCheck.apiKey;
  const model = aiConfig.model || DEFAULT_AI_CONFIG.model;
  const enableThinking = Boolean(aiConfig.enableThinking);
  const systemPrompt = aiConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const endpoint = buildChatCompletionsUrl(baseUrl);
  const extraPayload = buildExtraPayload(baseUrl, model, enableThinking);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 22000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...extraPayload,
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `请提炼以下记忆内容：\n\n${rawContent.slice(0, 8000)}`,
          },
        ],
        max_tokens: enableThinking ? 1500 : 350,
      }),
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data?.error?.message || `直连大模型返回状态码 ${res.status}`
      );
    }

    const rawReply: string = data?.choices?.[0]?.message?.content || "";
    if (!rawReply.trim()) {
      throw new Error("AI 返回内容为空");
    }

    const parsed = parseAiDistillJson(rawReply);
    return {
      summary: parsed.summary,
      tags: parsed.tags,
      detectedType: parsed.detectedType,
      modelUsed: data?.model || model,
      isRealAi: true,
      channel: "direct",
      latencyMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 通过服务端代理调用（兼容桌面端需要系统级 curl 代理的场景）
 */
async function callAiViaServerProxy(
  rawContent: string,
  aiConfig: AiConfig
): Promise<DistillResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const res = await fetch("/api/ai/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "distill",
        rawContent,
        aiConfig,
      }),
      signal: controller.signal,
    });

    const data = await res.json();
    if (res.ok && data.ok && data.summary) {
      return {
        summary: data.summary,
        tags:
          Array.isArray(data.tags) && data.tags.length > 0
            ? data.tags
            : ["AI灵感"],
        detectedType: data.detectedType || "ai_insight",
        modelUsed: data.model || aiConfig.model,
        isRealAi: true,
        channel: "server",
        latencyMs: data.latencyMs || Date.now() - startTime,
      };
    }
    throw new Error(data.error || `服务端代理状态码 ${res.status}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 智能全场景 AI 提炼入口：
 * 1. 若手机处于完全无网离线状态 -> 0 延迟秒级启用离线本地规则提炼
 * 2. 默认优先「手机/浏览器独立直连 DeepSeek」（电脑关机/出门在外 5G 流量均可独立工作）
 * 3. 若浏览器直连受阻（如桌面端特殊代理或跨域限制），自动无缝尝试服务端代理兜底
 * 4. 若均不可达，优雅降级至离线本地提炼器，绝不丢失用户输入的灵感
 */
export async function callAiDistill(
  rawContent: string,
  aiConfig: AiConfig
): Promise<DistillResult> {
  // 完全无网时直接走本地离线提炼，无需苦等超时
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const fallback = distillContentWithLocalAI(rawContent);
    return {
      summary: fallback.summary,
      tags: fallback.suggestedTags,
      detectedType: "ai_insight",
      modelUsed: "离线本地提炼",
      isRealAi: false,
      channel: "offline_local",
      error: "当前处于离线无网模式，已使用手机本地引擎提炼（联网后可点卡片右上角「重炼」）",
    };
  }

  const mode = aiConfig.connectionMode || "direct";

  // 模式 1：优先手机/浏览器直连（direct 或 auto）
  if (mode === "direct" || mode === "auto") {
    try {
      return await callAiDirectFromBrowser(rawContent, aiConfig);
    } catch (directErr) {
      // 如果服务端路由存在，尝试自动无缝走一次服务端兜底（适配电脑端开启 Fake-IP 代理时）
      try {
        return await callAiViaServerProxy(rawContent, aiConfig);
      } catch {
        const fallback = distillContentWithLocalAI(rawContent);
        return {
          summary: fallback.summary,
          tags: fallback.suggestedTags,
          detectedType: "ai_insight",
          modelUsed: "本地离线兜底",
          isRealAi: false,
          channel: "offline_local",
          error:
            directErr instanceof Error
              ? `直连未响应 (${directErr.message})，已使用本地提炼`
              : "网络异常，已使用本地提炼",
        };
      }
    }
  }

  // 模式 2：优先服务端代理，若手机已脱离电脑服务端则自动回退至浏览器直连
  try {
    return await callAiViaServerProxy(rawContent, aiConfig);
  } catch {
    try {
      return await callAiDirectFromBrowser(rawContent, aiConfig);
    } catch (err) {
      const fallback = distillContentWithLocalAI(rawContent);
      return {
        summary: fallback.summary,
        tags: fallback.suggestedTags,
        detectedType: "ai_insight",
        modelUsed: "本地离线兜底",
        isRealAi: false,
        channel: "offline_local",
        error: err instanceof Error ? err.message : "网络异常",
      };
    }
  }
}

/**
 * 连通性测试：支持手机独立直连测试 + 服务端代理双通道自动探测
 */
export async function testAiConnection(
  aiConfig: AiConfig
): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const baseUrl = aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl;
  const keyCheck = sanitizeApiKey(aiConfig.apiKey || DEFAULT_AI_CONFIG.apiKey);
  const apiKey = keyCheck.apiKey;
  const model = aiConfig.model || DEFAULT_AI_CONFIG.model;
  const enableThinking = Boolean(aiConfig.enableThinking);
  const mode = aiConfig.connectionMode || "direct";

  if (!keyCheck.ok && mode === "direct") {
    return {
      ok: false,
      channel: "direct",
      latencyMs: 0,
      model,
      error: keyCheck.error || "请先填入 API Key",
    };
  }

  const tryDirect = async (): Promise<ConnectionTestResult> => {
    const t0 = Date.now();
    const endpoint = buildChatCompletionsUrl(baseUrl);
    const extraPayload = buildExtraPayload(baseUrl, model, enableThinking);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...extraPayload,
        messages: [
          {
            role: "user",
            content: "请用一句话回复：手机独立直连手账AI成功！",
          },
        ],
        max_tokens: enableThinking ? 600 : 80,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data?.error?.message || `直连状态码 ${res.status}`
      );
    }
    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.reasoning_content ||
      "连接成功";
    return {
      ok: true,
      channel: "direct",
      latencyMs: Date.now() - t0,
      model: data?.model || model,
      reply: reply.trim(),
    };
  };

  const tryServer = async (): Promise<ConnectionTestResult> => {
    const res = await fetch("/api/ai/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "test",
        aiConfig,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `服务端返回 ${res.status}`);
    }
    return {
      ok: true,
      channel: "server",
      latencyMs: data.latencyMs || Date.now() - startTime,
      model: data.model || model,
      reply: data.reply,
    };
  };

  if (mode === "direct" || mode === "auto") {
    try {
      return await tryDirect();
    } catch (directErr) {
      try {
        return await tryServer();
      } catch {
        return {
          ok: false,
          channel: "direct",
          latencyMs: Date.now() - startTime,
          model,
          error:
            directErr instanceof Error
              ? directErr.message
              : "手机直连与服务端均未响应，请检查网络或 API Key",
        };
      }
    }
  } else {
    try {
      return await tryServer();
    } catch {
      try {
        return await tryDirect();
      } catch (err) {
        return {
          ok: false,
          channel: "server",
          latencyMs: Date.now() - startTime,
          model,
          error: err instanceof Error ? err.message : "连接失败",
        };
      }
    }
  }
}

/**
 * 拍立得 & 高光时刻 AI 辅助润色、生成短标题与自动提取标签
 */
export async function callAiPolishAndTag(
  rawContent: string,
  options: {
    cardType: CardType;
    title?: string;
    location?: string;
  },
  aiConfig: AiConfig
): Promise<PolishResult> {
  const fallbackLocal = (): PolishResult => {
    const local = distillContentWithLocalAI(rawContent || options.title || "此刻记录");
    const defaultTag = options.cardType === "milestone" ? "高光时刻" : "现场记忆";
    return {
      title: options.title?.trim() || local.summary.slice(0, 14),
      polishedContent: rawContent.trim(),
      tags: Array.from(
        new Set([...local.suggestedTags, ...(options.location ? [options.location] : [defaultTag])])
      ).slice(0, 4),
      modelUsed: "本地引擎",
      isRealAi: false,
    };
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return fallbackLocal();
  }

  const cardTypeLabel =
    options.cardType === "milestone"
      ? "人生高光时刻/重要里程碑"
      : "拍立得现场记录/看展旅行";
  const polishSystemPrompt = `你是一位温暖、克制、有审美的生活手账编辑。用户正在记录一张「${cardTypeLabel}」卡片。
请根据用户提供的草稿或现场感受，输出严格的 JSON 格式（不要输出 Markdown 代码块）：
{"title":"6到16字富有画面感的手账短标题","polishedContent":"在保留全部真实事实、地点与个人语气的前提下，润色得更自然、有手账质感的正文（不要堆砌华丽辞藻，拒绝AI腔）","tags":["标签1","标签2","标签3"]}`;

  const tryDirect = async (): Promise<PolishResult> => {
    const baseUrl = aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl;
    const keyCheck = sanitizeApiKey(aiConfig.apiKey || DEFAULT_AI_CONFIG.apiKey);
    if (!keyCheck.ok) throw new Error(keyCheck.error || "未配置 API Key");
    const endpoint = buildChatCompletionsUrl(baseUrl);
    const model = aiConfig.model || DEFAULT_AI_CONFIG.model;
    const enableThinking = Boolean(aiConfig.enableThinking);
    const extraPayload = buildExtraPayload(baseUrl, model, enableThinking);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyCheck.apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...extraPayload,
        temperature: 0.55,
        messages: [
          { role: "system", content: polishSystemPrompt },
          {
            role: "user",
            content: `现有标题：${options.title || "（无）"}\n地点：${options.location || "（无）"}\n草稿内容：\n${rawContent.slice(0, 4000)}`,
          },
        ],
        max_tokens: enableThinking ? 1600 : 500,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `状态码 ${res.status}`);
    const rawReply: string = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    return {
      title: String(parsed.title || options.title || "").trim().slice(0, 24),
      polishedContent: String(parsed.polishedContent || rawContent).trim(),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .map((t: unknown) => String(t).replace(/^#/, "").trim())
            .filter(Boolean)
            .slice(0, 5)
        : [],
      modelUsed: data?.model || model,
      isRealAi: true,
    };
  };

  const tryServer = async (): Promise<PolishResult> => {
    const res = await fetch("/api/ai/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "polish",
        rawContent,
        cardType: options.cardType,
        title: options.title,
        location: options.location,
        aiConfig,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "服务端未响应");
    return {
      title: data.title || options.title || "",
      polishedContent: data.polishedContent || rawContent,
      tags: Array.isArray(data.tags) ? data.tags : [],
      modelUsed: data.model || aiConfig.model,
      isRealAi: true,
    };
  };

  try {
    return await tryDirect();
  } catch {
    try {
      return await tryServer();
    } catch {
      return fallbackLocal();
    }
  }
}

/**
 * ✨ AI 翻阅手账：汇总多张便签，生成周期回顾 / 墙面洞察周报
 */
export async function callAiMemoryReview(
  cards: MemoryCard[],
  scopeLabel: string,
  aiConfig: AiConfig
): Promise<AiMemoryReviewResult> {
  const startTime = Date.now();
  const formattedDigest = cards
    .slice(0, 35)
    .map((c, idx) => {
      const typeLabel =
        c.type === "ai_insight"
          ? "灵感便签"
          : c.type === "exhibition"
          ? "拍立得"
          : "高光时刻";
      const header = `[${idx + 1}] ${c.dateLabel} | ${typeLabel}${
        c.title ? ` | 标题：${c.title}` : ""
      }${c.location ? ` | 地点：${c.location}` : ""} | 标签：${c.tags
        .map((t) => `#${t}`)
        .join(" ")}`;
      const body = c.summary
        ? `核心感悟：${c.summary}\n正文：${c.rawContent.slice(0, 240)}`
        : `正文：${c.rawContent.slice(0, 240)}`;
      return `${header}\n${body}`;
    })
    .join("\n\n---\n\n");

  const buildLocalFallback = (): AiMemoryReviewResult => {
    const tagFreq: Record<string, number> = {};
    const locations: string[] = [];
    let insightCount = 0;
    let photoCardCount = 0;
    let milestoneCount = 0;

    for (const c of cards) {
      if (c.type === "ai_insight") insightCount++;
      else if (c.type === "exhibition") photoCardCount++;
      else if (c.type === "milestone") milestoneCount++;
      if (c.location && !locations.includes(c.location)) {
        locations.push(c.location);
      }
      for (const t of c.tags) {
        tagFreq[t] = (tagFreq[t] || 0) + 1;
      }
    }

    const topTags = Object.entries(tagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k]) => k);

    const sampleQuotes = cards
      .filter((c) => c.summary || c.title)
      .slice(0, 2)
      .map((c) => `「${c.summary || c.title}」`)
      .join("、");

    return {
      headline: `${scopeLabel}：在 ${cards.length} 段真实切片里打捞闪光日常`,
      keywords:
        topTags.length > 0 ? topTags : ["手账回顾", "灵感轨迹", "生活切片"],
      reflection: `在「${scopeLabel}」里，你一共钉下了 ${cards.length} 张便签（包含 ${insightCount} 条灵感思考、${photoCardCount} 张现场拍立得与 ${milestoneCount} 个高光时刻）。${
        locations.length > 0
          ? `足迹掠过了 ${locations.slice(0, 3).join("、")}；`
          : ""
      }${
        sampleQuotes ? `其中 ${sampleQuotes} 依然鲜活。` : ""
      }每一张便签都是对抗遗忘的锚点，串联起了你近期独特的思考节奏与生活重心。`,
      spark: "不妨挑一张最触动你的旧便签，在今天写下它的后续回响。",
      modelUsed: "本地记忆引擎",
      isRealAi: false,
      latencyMs: Date.now() - startTime,
    };
  };

  if (
    cards.length === 0 ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return buildLocalFallback();
  }

  const reviewSystemPrompt = `你是一位温暖、敏锐的私人手账伴侣。请翻阅用户在「${scopeLabel}」中记录的多张手账便签（包含灵感思考、拍立得现场、高光时刻），发现其中潜藏的思维主线、情绪轨迹与生活闪光点。
请严格输出 JSON 格式（不要输出 Markdown 代码块）：
{
  "headline": "12到26字具有诗意与洞察力的阶段主题标题",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "reflection": "120到240字的温暖回顾长文（分段自然，像一位老友帮他梳理这段时间的思考、足迹与成长，切忌空话套话，要具体呼应便签里的细节）",
  "spark": "一句面向接下来的温柔追问或小行动建议（35字以内）"
}`;

  const tryDirect = async (): Promise<AiMemoryReviewResult> => {
    const baseUrl = aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl;
    const keyCheck = sanitizeApiKey(aiConfig.apiKey || DEFAULT_AI_CONFIG.apiKey);
    if (!keyCheck.ok) throw new Error(keyCheck.error || "未配置 API Key");
    const endpoint = buildChatCompletionsUrl(baseUrl);
    const model = aiConfig.model || DEFAULT_AI_CONFIG.model;
    const enableThinking = Boolean(aiConfig.enableThinking);
    const extraPayload = buildExtraPayload(baseUrl, model, enableThinking);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyCheck.apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...extraPayload,
        temperature: 0.6,
        messages: [
          { role: "system", content: reviewSystemPrompt },
          {
            role: "user",
            content: `以下是我在「${scopeLabel}」记录的手账便签汇总：\n\n${formattedDigest}`,
          },
        ],
        max_tokens: enableThinking ? 2000 : 750,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `状态码 ${res.status}`);
    const rawReply: string = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { reflection: rawReply.trim() };
    return {
      headline: String(parsed.headline || `${scopeLabel} · 记忆回响`).trim(),
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords
            .map((k: unknown) => String(k).replace(/^#/, "").trim())
            .filter(Boolean)
            .slice(0, 5)
        : ["阶段回顾", "生活洞察"],
      reflection: String(parsed.reflection || rawReply.trim()).trim(),
      spark: String(parsed.spark || "继续把闪光的日常钉在墙上吧。").trim(),
      modelUsed: data?.model || model,
      isRealAi: true,
      latencyMs: Date.now() - startTime,
    };
  };

  const tryServer = async (): Promise<AiMemoryReviewResult> => {
    const res = await fetch("/api/ai/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "review",
        rawContent: formattedDigest,
        scopeLabel,
        aiConfig,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "服务端未响应");
    return {
      headline: data.headline,
      keywords: data.keywords || ["阶段回顾"],
      reflection: data.reflection,
      spark: data.spark || "继续把闪光的日常钉在墙上吧。",
      modelUsed: data.model || aiConfig.model,
      isRealAi: true,
      latencyMs: data.latencyMs || Date.now() - startTime,
    };
  };

  try {
    return await tryDirect();
  } catch {
    try {
      return await tryServer();
    } catch {
      return buildLocalFallback();
    }
  }
}
