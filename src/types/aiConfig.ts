export type AiConnectionMode = "direct" | "auto" | "server";

export interface AiConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enableThinking: boolean;
  systemPrompt: string;
  connectionMode?: AiConnectionMode;
}

export const AI_CONFIG_STORAGE_KEY = "vibe_memory_ai_config_v1";

export const DEFAULT_SYSTEM_PROMPT = `你是一个极具审美与洞察力的「个人散装记忆与灵感手账」策展AI助手。
用户会输入一段与AI的聊天记录、日常随感、看展心情或人生重要时刻。
请你完成以下任务，并严格只输出合法的 JSON 格式（不要包含 markdown 代码块标记）：
1. "summary": 提炼出一句 30 字以内的「核心金句/感悟」，要有书卷气、克制且直击本质（如果是长对话，提炼最闪光的洞察；如果是日常高光，提炼温暖的标题式总结）。
2. "tags": 自动提取 2 到 3 个精炼的中文标签（不带#号，每个标签2~5个字，如 ["AI灵感", "思维模型", "产品哲学"]）。
3. "detectedType": 判断这段内容最适合哪种卡片类型，只能是 "ai_insight"（AI感悟/思考）、"exhibition"（逛展/看演出/摄影现场）或 "milestone"（人生高光/重要大事/中奖/纪念日）三者之一。

严格返回如下 JSON 结构：
{"summary": "30字以内的核心金句。", "tags": ["标签1", "标签2"], "detectedType": "ai_insight"}`;

export const DEFAULT_AI_CONFIG: AiConfig = {
  providerName: "DeepSeek 官方",
  baseUrl: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-flash",
  enableThinking: false,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  connectionMode: "direct",
};

export const AI_PROVIDER_PRESETS = [
  {
    name: "DeepSeek 官方",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-flash", "deepseek-v4-pro", "deepseek-chat"],
  },
  {
    name: "Google Gemini (OpenAI 兼容)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  {
    name: "SiliconFlow 硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
  },
  {
    name: "OpenAI / 自定义中转",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o"],
  },
];
