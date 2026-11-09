import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { DEFAULT_AI_CONFIG, DEFAULT_SYSTEM_PROMPT } from "@/types/aiConfig";
import { sanitizeApiKey, validateSafeAiEndpoint } from "@/utils/security";

const execFileAsync = promisify(execFile);

/**
 * 兼容 macOS 系统代理 (如 Clash Fake-IP) 的安全请求封装：
 * - 强制仅允许 HTTPS 协议 (`--proto =https`)，禁用重定向跟随，使用 `--` 隔离参数，彻底阻断 curl 参数注入与 file:// 读取
 * - 若系统无 curl 环境，回退至带超时控制的原生 fetch
 */
async function postJsonWithProxyFallback(
  url: string,
  apiKey: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, any> }> {
  const bodyStr = JSON.stringify(payload);

  // 1. 尝试通过系统 curl 发送（显式锁定 https 协议并禁用参数解析）
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-s",
        "-S",
        "--proto",
        "=https",
        "--max-time",
        "25",
        "-w",
        "\n__HTTP_STATUS__:%{http_code}",
        "-X",
        "POST",
        "-H",
        "Content-Type: application/json",
        "-H",
        `Authorization: Bearer ${apiKey}`,
        "--data-raw",
        bodyStr,
        "--",
        url,
      ],
      { maxBuffer: 4 * 1024 * 1024 }
    );

    const parts = stdout.split("\n__HTTP_STATUS__:");
    const responseText = parts[0] || "{}";
    const statusCode = parseInt(parts[1]?.trim() || "200", 10);
    const parsed = JSON.parse(responseText);
    return {
      ok: statusCode >= 200 && statusCode < 300,
      status: statusCode,
      data: parsed,
    };
  } catch {
    // 2. 如果无 curl 环境（如云端 Serverless），使用标准 fetch
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: bodyStr,
        redirect: "error",
        signal: controller.signal,
      });
      const data = await response.json();
      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { mode = "distill", rawContent = "", aiConfig = {} } = body || {};

    const baseUrl =
      typeof aiConfig?.baseUrl === "string" && aiConfig.baseUrl.trim()
        ? aiConfig.baseUrl
        : DEFAULT_AI_CONFIG.baseUrl;

    const rawKey =
      (typeof aiConfig?.apiKey === "string" && aiConfig.apiKey.trim()) ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_API_KEY ||
      DEFAULT_AI_CONFIG.apiKey;

    const keyCheck = sanitizeApiKey(rawKey);
    if (!keyCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            keyCheck.error ||
            "未配置 API Key，请在右上角「设置 -> AI 接口设置」中填入。",
        },
        { status: 400 }
      );
    }

    const endpointCheck = validateSafeAiEndpoint(baseUrl, false);
    if (!endpointCheck.ok) {
      return NextResponse.json(
        { ok: false, error: endpointCheck.error },
        { status: 400 }
      );
    }

    const endpoint = endpointCheck.endpoint;
    const apiKey = keyCheck.apiKey;
    const model =
      typeof aiConfig?.model === "string" && aiConfig.model.trim()
        ? aiConfig.model.trim().slice(0, 100)
        : DEFAULT_AI_CONFIG.model;
    const enableThinking = Boolean(aiConfig?.enableThinking);
    const systemPrompt =
      typeof aiConfig?.systemPrompt === "string" && aiConfig.systemPrompt.trim()
        ? aiConfig.systemPrompt.slice(0, 4000)
        : DEFAULT_SYSTEM_PROMPT;

    const isDeepSeek =
      endpoint.includes("deepseek.com") ||
      model.toLowerCase().includes("deepseek");
    const extraPayload: Record<string, unknown> = {};
    if (isDeepSeek && !enableThinking) {
      extraPayload.thinking = { type: "disabled" };
    }

    if (mode === "test") {
      const { ok, status, data } = await postJsonWithProxyFallback(
        endpoint,
        apiKey,
        {
          model,
          ...extraPayload,
          messages: [
            {
              role: "user",
              content: "请用一句话回复：手账AI大脑连接成功！",
            },
          ],
          max_tokens: enableThinking ? 600 : 80,
        }
      );

      if (!ok) {
        return NextResponse.json(
          {
            ok: false,
            error:
              data?.error?.message ||
              `接口返回状态码 ${status}，请检查 Base URL、API Key 或模型名称是否正确`,
          },
          { status }
        );
      }

      const reply =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.message?.reasoning_content ||
        "连接成功";

      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startTime,
        model: data?.model || model,
        reply: String(reply).trim().slice(0, 300),
      });
    }

    if (mode === "polish") {
      const safeContent = typeof rawContent === "string" ? rawContent.trim() : "";
      if (!safeContent) {
        return NextResponse.json(
          { ok: false, error: "输入内容不能为空" },
          { status: 400 }
        );
      }
      const cardTypeLabel =
        body?.cardType === "milestone" ? "人生高光时刻/重要里程碑" : "拍立得现场记录/看展旅行";
      const polishSystemPrompt = `你是一位温暖、克制、有审美的生活手账编辑。用户正在记录一张「${cardTypeLabel}」卡片。
请根据用户提供的草稿或现场感受，输出严格的 JSON 格式（不要输出 Markdown 代码块）：
{"title":"6到16字富有画面感的手账短标题","polishedContent":"在保留全部真实事实、地点与个人语气的前提下，润色得更自然、有手账质感的正文（不要堆砌华丽辞藻，拒绝AI腔）","tags":["标签1","标签2","标签3"]}`;

      const { ok, status, data } = await postJsonWithProxyFallback(
        endpoint,
        apiKey,
        {
          model,
          ...extraPayload,
          temperature: 0.55,
          messages: [
            { role: "system", content: polishSystemPrompt },
            {
              role: "user",
              content: `现有标题：${body?.title || "（无）"}\n地点：${body?.location || "（无）"}\n草稿内容：\n${safeContent.slice(0, 4000)}`,
            },
          ],
          max_tokens: enableThinking ? 1600 : 500,
        }
      );

      if (!ok) {
        return NextResponse.json(
          {
            ok: false,
            error: data?.error?.message || `请求大模型失败 (${status})`,
          },
          { status }
        );
      }

      const rawReply: string = data?.choices?.[0]?.message?.content || "";
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      let parsed: {
        title?: string;
        polishedContent?: string;
        tags?: string[];
      } = {};
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = {};
        }
      }

      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startTime,
        model: data?.model || model,
        title: String(parsed.title || "").trim().slice(0, 28),
        polishedContent: String(parsed.polishedContent || safeContent).trim(),
        tags: Array.isArray(parsed.tags)
          ? parsed.tags
              .map((t) => String(t).replace(/^#/, "").trim().slice(0, 20))
              .filter(Boolean)
              .slice(0, 5)
          : [],
      });
    }

    if (mode === "review") {
      const safeContent = typeof rawContent === "string" ? rawContent.trim() : "";
      const scopeLabel = typeof body?.scopeLabel === "string" ? body.scopeLabel : "近期手账";
      const reviewSystemPrompt = `你是一位温暖、敏锐的私人手账伴侣。请翻阅用户在「${scopeLabel}」中记录的多张手账便签（包含灵感思考、拍立得现场、高光时刻），发现其中潜藏的思维主线、情绪轨迹与生活闪光点。
请严格输出 JSON 格式（不要输出 Markdown 代码块）：
{
  "headline": "12到26字具有诗意与洞察力的阶段主题标题",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "reflection": "120到240字的温暖回顾长文（分段自然，像一位老友帮他梳理这段时间的思考、足迹与成长，切忌空话套话，要具体呼应便签里的细节）",
  "spark": "一句面向接下来的温柔追问或小行动建议（35字以内）"
}`;

      const { ok, status, data } = await postJsonWithProxyFallback(
        endpoint,
        apiKey,
        {
          model,
          ...extraPayload,
          temperature: 0.6,
          messages: [
            { role: "system", content: reviewSystemPrompt },
            {
              role: "user",
              content: `以下是我在「${scopeLabel}」记录的手账便签汇总：\n\n${safeContent.slice(0, 9000)}`,
            },
          ],
          max_tokens: enableThinking ? 2000 : 750,
        }
      );

      if (!ok) {
        return NextResponse.json(
          {
            ok: false,
            error: data?.error?.message || `请求大模型失败 (${status})`,
          },
          { status }
        );
      }

      const rawReply: string = data?.choices?.[0]?.message?.content || "";
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      let parsed: {
        headline?: string;
        keywords?: string[];
        reflection?: string;
        spark?: string;
      } = {};
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = { reflection: rawReply.trim() };
        }
      } else {
        parsed = { reflection: rawReply.trim() };
      }

      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startTime,
        model: data?.model || model,
        headline: String(parsed.headline || `${scopeLabel} · 记忆回响`).trim(),
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords
              .map((k) => String(k).replace(/^#/, "").trim())
              .filter(Boolean)
              .slice(0, 5)
          : ["阶段回顾", "生活洞察"],
        reflection: String(parsed.reflection || rawReply.trim()).trim(),
        spark: String(parsed.spark || "继续把闪光的日常钉在墙上吧。").trim(),
      });
    }

    // 正式提炼模式 (mode === "distill")
    const safeContent = typeof rawContent === "string" ? rawContent.trim() : "";
    if (!safeContent) {
      return NextResponse.json(
        { ok: false, error: "输入内容不能为空" },
        { status: 400 }
      );
    }

    const { ok, status, data } = await postJsonWithProxyFallback(
      endpoint,
      apiKey,
      {
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
            content: `请提炼以下记忆内容：\n\n${safeContent.slice(0, 8000)}`,
          },
        ],
        max_tokens: enableThinking ? 1500 : 350,
      }
    );

    if (!ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error?.message || `请求大模型失败 (${status})`,
        },
        { status }
      );
    }

    const rawReply: string = data?.choices?.[0]?.message?.content || "";

    // 提取 JSON 对象
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    let parsed: {
      summary?: string;
      tags?: string[];
      detectedType?: "ai_insight" | "exhibition" | "milestone";
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

    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - startTime,
      model: data?.model || model,
      summary: String(parsed.summary || "")
        .trim()
        .slice(0, 120),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .map((t) => String(t).replace(/^#/, "").trim().slice(0, 24))
            .filter(Boolean)
            .slice(0, 8)
        : ["AI灵感"],
      detectedType:
        parsed.detectedType === "exhibition" ||
        parsed.detectedType === "milestone" ||
        parsed.detectedType === "ai_insight"
          ? parsed.detectedType
          : "ai_insight",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "网络或解析异常";
    return NextResponse.json(
      { ok: false, error: `调用异常：${message}` },
      { status: 500 }
    );
  }
}
