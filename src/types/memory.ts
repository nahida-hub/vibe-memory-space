export type CardType = "ai_insight" | "exhibition" | "milestone";

export type LayoutMode = "wall" | "masonry";

export type ThemeMode = "daylight" | "night_lamp";

export type PaperColor = "cream" | "butter" | "sage" | "blush" | "kraft";

export type ThreadColor = "crimson" | "amber" | "sage" | "slate" | "gold";

export type PosterTemplate = "polaroid" | "cinema" | "ticket";

export interface BoardZone {
  id: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  style: "walnut" | "brass" | "washi";
}

export interface MemoryCard {
  id: string;
  type: CardType;
  createdAt: string; // ISO string
  dateLabel: string; // e.g., "2026.11.09 · 周一"
  tags: string[];
  isPinned?: boolean;

  // 墙面 2D 坐标、微倾角与便签纸色
  boardX?: number;
  boardY?: number;
  rotation?: number;
  paperColor?: PaperColor;

  // 关联便签 ID 列表与每条连线的颜色
  linkedCardIds?: string[];
  linkedCardColors?: Record<string, ThreadColor>;

  // 正文内容
  rawContent: string;

  // Type A: AI 灵感便签
  summary?: string;
  aiModel?: string;

  // Type B: 拍立得便签
  title?: string;
  location?: string;
  images?: string[];
  tapeStyle?: "amber" | "sage" | "rose" | "coffee";

  // Type C: 高光便签
  milestoneBadge?: string;
}
