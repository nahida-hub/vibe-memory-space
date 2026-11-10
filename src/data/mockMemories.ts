import { MemoryCard } from "@/types/memory";

export const INITIAL_MEMORIES: MemoryCard[] = [
  {
    id: "mem-1",
    type: "milestone",
    createdAt: "2026-11-09T14:20:00.000Z",
    dateLabel: "2026.11.09 · 周一",
    tags: ["高光时刻", "独立产品", "新起点"],
    isPinned: true,
    linkedCardIds: ["mem-2"],
    milestoneBadge: "重要里程碑",
    title: "开启「个人散装记忆与灵感空间」第一个原型",
    rawContent:
      "一直觉得 Notion 和 Obsidian 太重了，每次建文件夹都在消耗表达欲。今天终于动手把脑海里「像手账本一样温暖、像朋友圈一样随手记」的个人空间立项了！哪怕从第一行本地原型开始，这也是属于自己的数字精神角落。",
  },
  {
    id: "mem-2",
    type: "ai_insight",
    createdAt: "2026-11-08T22:15:00.000Z",
    dateLabel: "2026.11.08 · 周日",
    tags: ["AI灵感", "产品哲学", "认知模型"],
    summary: "好的工具不是替你管理秩序，而是降低你捕捉闪念的摩擦力。",
    aiModel: "Gemini 2.5 Pro",
    rawContent: `【我】：为什么我收藏了那么多笔记软件方法论（PARA、卡片盒笔记法），最后还是坚持不下来？每次想记点东西，光想放哪个目录就放弃了。

【AI】：因为传统知识管理软件假设你是「图书管理员」，但人在产生灵感的瞬间其实是「捕蝶人」。
当你强迫自己在记录的同一秒去完成“分类、命名、排版”时，大脑会从发散的右脑模式强制切换到逻辑审查模式，灵感当场就熄灭了。
真正适合个人的记忆系统应该把「输入」和「整理」彻底解耦：输入时零摩擦（像往口袋里塞一张纸条），整理则交给异步的 AI 标签与视觉瀑布流去自然浮现。`,
  },
  {
    id: "mem-3",
    type: "exhibition",
    createdAt: "2026-11-06T16:40:00.000Z",
    dateLabel: "2026.11.06 · 周五",
    tags: ["逛展", "当代艺术", "光影"],
    title: "「光与时间的褶皱」秋季特展",
    location: "上海西岸美术馆 · 展厅 2",
    tapeStyle: "amber",
    images: [
      "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1000&q=80",
    ],
    rawContent:
      "下午四点的斜阳刚好穿过美术馆二楼的落地百叶窗，投在亚麻画布上的光斑比画本身还要动人。站在那幅巨大的普鲁士蓝抽象画前发了十分钟呆，突然明白有些情绪不需要被翻译成文字。",
  },
  {
    id: "mem-4",
    type: "ai_insight",
    createdAt: "2026-11-03T23:30:00.000Z",
    dateLabel: "2026.11.03 · 周二",
    tags: ["AI灵感", "审美积累", "策展思维"],
    summary: "审美不是凭空创造，而是你允许什么东西留在你的注意力里。",
    aiModel: "DeepSeek R1",
    rawContent: `【我】：总觉得自己做东西或者拍照缺少一点所谓的“Vibe（氛围感）”，这种东西到底是怎么练出来的？

【AI】：氛围感本质上是「一致性的偏爱」。
你不需要学会所有风格，而是像策展人一样建立一个自己的“私人标本夹”。每次遇到让你心头一颤的配色、纸张质感、展览角落或者一句话，把它存进同一个视觉空间里。当你把 100 个打动你的瞬间并排放在一起时，它们共同指向的那个交集，就是你独一无二的个人审美指纹。`,
  },
  {
    id: "mem-5",
    type: "exhibition",
    createdAt: "2026-10-28T20:10:00.000Z",
    dateLabel: "2026.10.28 · 周三",
    tags: ["看演出", "爵士现场", "秋夜"],
    title: "Blue Note 秋夜四重奏 Live",
    location: "Blue Note Jazz Club",
    tapeStyle: "rose",
    images: [
      "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1000&q=80",
    ],
    rawContent:
      "萨克斯响起第一个音符的时候，整个人像泡进了温热的威士忌里。鼓手在即兴 Solo 时的眼神太迷人了，现场演出的呼吸感永远是耳机里替代不了的。",
  },
  {
    id: "mem-6",
    type: "milestone",
    createdAt: "2026-10-18T11:00:00.000Z",
    dateLabel: "2026.10.18 · 周日",
    tags: ["高光时刻", "小确幸", "生活纪念"],
    milestoneBadge: "好运高光",
    title: "书店盲盒抽中绝版画册 & 久违的满月周末",
    images: [
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=80",
    ],
    rawContent:
      "逛旧书市随手挑的牛皮纸盲盒，拆开居然是找了两年的绝版建筑摄影集！傍晚沿着苏州河散步回家，抬头刚好撞见今年最圆的一次橙色月亮。",
  },
];

/**
 * 本地智能提炼器（第一阶段原型内置，第二阶段可直接无缝替换为 Gemini / DeepSeek API Route）
 * 自动将长段 AI 聊天记录或随笔提炼为 30 字以内的「核心金句」并生成 2-3 个标签
 */
export function distillContentWithLocalAI(rawText: string): {
  summary: string;
  suggestedTags: string[];
} {
  const clean = rawText
    .replace(/【.*?】[:：]?/g, " ")
    .replace(/^(User|AI|Assistant|我|问|答)[:：]\s*/gim, "")
    .trim();

  // 按句号、叹号、问号或换行切分句子
  const sentences = clean
    .split(/[。！？!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);

  // 优先挑选包含哲理/洞察关键词的句子作为金句
  const insightKeywords = [
    "本质",
    "不是",
    "而是",
    "真正",
    "核心",
    "其实",
    "意义",
    "决定",
    "自由",
    "审美",
    "时间",
    "记忆",
    "灵感",
    "应该",
    "温柔",
  ];

  let bestSentence =
    sentences.find(
      (s) =>
        s.length >= 10 &&
        s.length <= 32 &&
        insightKeywords.some((kw) => s.includes(kw))
    ) ||
    sentences.find((s) => s.length >= 10 && s.length <= 30) ||
    sentences[sentences.length - 1] ||
    clean;

  if (bestSentence.length > 30) {
    bestSentence = bestSentence.slice(0, 29) + "…";
  }
  if (!bestSentence.endsWith("。") && !bestSentence.endsWith("…")) {
    bestSentence += "。";
  }

  // 自动提取 `#标签` 或根据内容语义推荐标签
  const hashTags = Array.from(rawText.matchAll(/#([\u4e00-\u9fa5a-zA-Z0-9_-]+)/g)).map(
    (m) => m[1]
  );

  const semanticTags: string[] = ["AI灵感"];
  if (/产品|设计|工具|代码|开发/.test(rawText)) semanticTags.push("产品思考");
  if (/艺术|展|画|摄影|审美|电影|音乐/.test(rawText)) semanticTags.push("审美漫游");
  if (/心理|情绪|焦虑|生活|自我|成长/.test(rawText)) semanticTags.push("内在探索");
  if (/思维|逻辑|模型|哲学|认知/.test(rawText)) semanticTags.push("思维模型");

  const combined = Array.from(new Set([...hashTags, ...semanticTags])).slice(0, 3);
  if (combined.length === 1) combined.push("灵光一闪");

  return {
    summary: bestSentence,
    suggestedTags: combined,
  };
}
