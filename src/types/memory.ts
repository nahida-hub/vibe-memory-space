export type CardType = "ai_insight" | "exhibition" | "milestone";

export type LayoutMode = "wall" | "masonry";

export type PaperColor = "cream" | "butter" | "sage" | "blush" | "kraft";

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
