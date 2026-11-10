"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  MapPin,
  Sparkles,
  Star,
  Camera,
  Pin,
  Compass,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Dices,
  Lock,
  LockOpen,
  Link2,
  BookmarkPlus,
  X,
  Trash2,
  Check,
} from "lucide-react";
import {
  BoardZone,
  MemoryCard,
  PaperColor,
  ThemeMode,
  ThreadColor,
} from "@/types/memory";
import { triggerHaptic } from "@/utils/storageDb";

export const THREAD_COLOR_LIST: ThreadColor[] = [
  "crimson",
  "amber",
  "sage",
  "slate",
  "gold",
];

export const THREAD_COLOR_STYLES: Record<
  ThreadColor,
  {
    label: string;
    stroke: string;
    highlight: string;
    dotBg: string;
  }
> = {
  crimson: {
    label: "朱砂红",
    stroke: "#C84B39",
    highlight: "rgba(255, 224, 216, 0.42)",
    dotBg: "bg-[#C84B39] border-[#963223]",
  },
  amber: {
    label: "亚麻棕",
    stroke: "#B87A3D",
    highlight: "rgba(255, 238, 210, 0.45)",
    dotBg: "bg-[#B87A3D] border-[#8A5623]",
  },
  sage: {
    label: "森系绿",
    stroke: "#5B7D55",
    highlight: "rgba(226, 244, 222, 0.42)",
    dotBg: "bg-[#5B7D55] border-[#3F593A]",
  },
  slate: {
    label: "雾霭蓝",
    stroke: "#4E6E85",
    highlight: "rgba(222, 238, 250, 0.42)",
    dotBg: "bg-[#4E6E85] border-[#344D5E]",
  },
  gold: {
    label: "流光金",
    stroke: "#D49B35",
    highlight: "rgba(255, 246, 214, 0.52)",
    dotBg: "bg-[#D49B35] border-[#9E6E19]",
  },
};

const BOARD_ZONES_STORAGE_KEY = "vibe_memory_board_zones_v1";

const DEFAULT_BOARD_ZONES: BoardZone[] = [
  {
    id: "zone-insight",
    title: "✦ 灵感与思考碎片",
    subtitle: "INSIGHTS & SPARKS",
    x: -290,
    y: -255,
    style: "walnut",
  },
  {
    id: "zone-scene",
    title: "📷 展演与生活现场",
    subtitle: "EXHIBITIONS & MOMENTS",
    x: 280,
    y: -255,
    style: "brass",
  },
];

interface PinboardWallProps {
  memories: MemoryCard[];
  matchedIds: Set<string>;
  hasActiveFilter: boolean;
  activeTag: string | null;
  themeMode?: ThemeMode;
  linkingFromCardId?: string | null;
  onCancelLinking?: () => void;
  onToggleLinkCard?: (
    sourceId: string,
    targetId: string,
    color?: ThreadColor
  ) => void;
  onUpdatePairThreadColor?: (
    sourceId: string,
    targetId: string,
    color: ThreadColor
  ) => void;
  onSelectCard: (card: MemoryCard) => void;
  onTagClick: (tag: string) => void;
  onUpdateCardPosition: (id: string, boardX: number, boardY: number) => void;
  onAutoArrangeWall: () => void;
  onDoubleClickWall?: (boardX: number, boardY: number) => void;
  onOpenAiReview?: () => void;
  focusCardRequest?: { id: string; seq: number } | null;
  centerTrigger?: number;
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateSpiralSlots(count: number): { gx: number; gy: number }[] {
  const radius = Math.ceil(Math.sqrt(count)) + 2;
  const coords: { gx: number; gy: number; dist: number }[] = [];
  for (let gy = -radius; gy <= radius; gy++) {
    for (let gx = -radius; gx <= radius; gx++) {
      const effX = gx + (Math.abs(gy) % 2 === 1 ? 0.45 : 0);
      const dist = effX * effX + gy * gy * 1.15;
      coords.push({ gx, gy, dist });
    }
  }
  coords.sort((a, b) => a.dist - b.dist);
  return coords.slice(0, Math.max(count, 1));
}

export function computeInitialBoardPosition(
  card: MemoryCard,
  index: number,
  total: number
): { x: number; y: number; rotation: number } {
  const h = hashCode(card.id);
  const rotation = ((h % 9) - 4) * 0.65;

  if (typeof card.boardX === "number" && typeof card.boardY === "number") {
    return {
      x: card.boardX,
      y: card.boardY,
      rotation: typeof card.rotation === "number" ? card.rotation : rotation,
    };
  }

  const slots = generateSpiralSlots(total + 4);
  const slot = slots[index] || { gx: 0, gy: 0 };
  const stepX = 285;
  const stepY = 315;
  const rowShift = Math.abs(slot.gy) % 2 === 1 ? 110 : 0;
  const jitterX = (h % 36) - 18;
  const jitterY = ((h >> 4) % 36) - 18;

  return {
    x: slot.gx * stepX + rowShift + jitterX,
    y: slot.gy * stepY + jitterY,
    rotation,
  };
}

const PAPER_PALETTE_LIST: PaperColor[] = [
  "cream",
  "butter",
  "sage",
  "blush",
  "kraft",
];

export const PAPER_COLOR_STYLES: Record<
  PaperColor,
  {
    bg: string;
    border: string;
    tagBg: string;
    tagText: string;
    divider: string;
    dot: string;
    label: string;
  }
> = {
  cream: {
    bg: "bg-[#FFFDF6]",
    border: "border-[#E2D6BE]",
    tagBg: "bg-[#F2EAD9]",
    tagText: "text-[#66594B]",
    divider: "border-[#E6DCC6]",
    dot: "bg-[#FFFDF6] border-[#C9B99B]",
    label: "云朵白",
  },
  butter: {
    bg: "bg-[#FDF6D8]",
    border: "border-[#E4D59B]",
    tagBg: "bg-[#F2E6B6]",
    tagText: "text-[#6B5829]",
    divider: "border-[#E6D69E]",
    dot: "bg-[#FDF6D8] border-[#D4BF72]",
    label: "奶油黄",
  },
  sage: {
    bg: "bg-[#ECF3E8]",
    border: "border-[#C8D9C1]",
    tagBg: "bg-[#DCE8D6]",
    tagText: "text-[#3D5239]",
    divider: "border-[#CDDEC6]",
    dot: "bg-[#ECF3E8] border-[#9BB592]",
    label: "抹茶绿",
  },
  blush: {
    bg: "bg-[#FBECE9]",
    border: "border-[#E6C7C1]",
    tagBg: "bg-[#F2DAD5]",
    tagText: "text-[#6E453E]",
    divider: "border-[#E8CCC6]",
    dot: "bg-[#FBECE9] border-[#D1A39B]",
    label: "雾霾粉",
  },
  kraft: {
    bg: "bg-[#EFE1C6]",
    border: "border-[#D4BD94]",
    tagBg: "bg-[#E2CEAA]",
    tagText: "text-[#59442A]",
    divider: "border-[#D8C29B]",
    dot: "bg-[#EFE1C6] border-[#B89D72]",
    label: "牛皮纸",
  },
};

export function resolveCardPaperColor(card: MemoryCard): PaperColor {
  if (card.paperColor && PAPER_COLOR_STYLES[card.paperColor]) {
    return card.paperColor;
  }
  const h = hashCode(card.id);
  return PAPER_PALETTE_LIST[h % PAPER_PALETTE_LIST.length];
}

const PIN_COLORS: Record<string, { head: string; rim: string }> = {
  ai_insight: { head: "#5C7457", rim: "#3E523A" },
  exhibition: { head: "#C87D32", rim: "#96581B" },
  milestone: { head: "#D4892A", rim: "#9E5D11" },
};

const TAPE_BG: Record<string, string> = {
  amber: "bg-[#E9C893]/80 border-[#DAB376]/60",
  sage: "bg-[#B8CBB2]/80 border-[#9FB698]/60",
  rose: "bg-[#E6B8B0]/80 border-[#D49F96]/60",
  coffee: "bg-[#C7B69E]/80 border-[#B29E82]/60",
};

const ZONE_STYLE_PRESETS: Record<
  BoardZone["style"],
  {
    label: string;
    container: string;
    title: string;
    subtitle: string;
    nail: string;
  }
> = {
  walnut: {
    label: "胡桃木牌",
    container:
      "bg-gradient-to-br from-[#3A2D23] to-[#261D16] border-[#614C3B] shadow-lg",
    title: "text-[#F5E6CE]",
    subtitle: "text-[#B89F82]",
    nail: "bg-[#D49B4B] border-[#8C5E22]",
  },
  brass: {
    label: "黄铜铭牌",
    container:
      "bg-gradient-to-br from-[#F3E2BE] via-[#E5CA94] to-[#D4AF6E] border-[#B28844] shadow-md",
    title: "text-[#2C2115]",
    subtitle: "text-[#6B4F28]",
    nail: "bg-[#4A3825] border-[#2C2115]",
  },
  washi: {
    label: "手账和纸",
    container:
      "bg-[#FBF4E3]/95 border-[#D8C6A8] border-dashed shadow-sm",
    title: "text-[#3D3126]",
    subtitle: "text-[#8A7966]",
    nail: "bg-[#5C7457] border-[#3E523A]",
  },
};

export default function PinboardWall({
  memories,
  matchedIds,
  hasActiveFilter,
  activeTag,
  themeMode = "daylight",
  linkingFromCardId = null,
  onCancelLinking,
  onToggleLinkCard,
  onUpdatePairThreadColor,
  onSelectCard,
  onTagClick,
  onUpdateCardPosition,
  onAutoArrangeWall,
  onDoubleClickWall,
  focusCardRequest = null,
  centerTrigger = 0,
}: PinboardWallProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.92);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0,
  });
  const [isArranging, setIsArranging] = useState(false);
  const [isBoardLocked, setIsBoardLocked] = useState(false);
  const [threadMode, setThreadMode] = useState<"all" | "manual" | "off">("all");
  const [activeLinkColor, setActiveLinkColor] =
    useState<ThreadColor>("crimson");
  const [selectedThreadPair, setSelectedThreadPair] = useState<{
    fromId: string;
    toId: string;
    color: ThreadColor;
  } | null>(null);
  const [zones, setZones] = useState<BoardZone[]>(DEFAULT_BOARD_ZONES);
  const [editingZone, setEditingZone] = useState<BoardZone | null>(null);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [pinRipple, setPinRipple] = useState<{ x: number; y: number } | null>(
    null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const zoneElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  const MIN_ZOOM = 0.002;
  const MAX_ZOOM = 2.8;

  // 加载与持久化桌面分区铭牌
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(BOARD_ZONES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setZones(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveZones = useCallback((nextZones: BoardZone[]) => {
    setZones(nextZones);
    try {
      localStorage.setItem(BOARD_ZONES_STORAGE_KEY, JSON.stringify(nextZones));
    } catch {
      // ignore
    }
  }, []);

  const getAdaptiveGridSize = (z: number) => {
    let size = 26 * z;
    while (size < 14) {
      size *= 2;
    }
    return size;
  };

  const applyCameraTransform = useCallback(
    (nextX: number, nextY: number, nextZ: number, syncState = false) => {
      panRef.current = { x: nextX, y: nextY };
      zoomRef.current = nextZ;
      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(${nextZ})`;
      }
      if (containerRef.current) {
        const gridSize = getAdaptiveGridSize(nextZ);
        containerRef.current.style.backgroundPosition = `${nextX}px ${nextY}px`;
        containerRef.current.style.backgroundSize = `${gridSize}px ${gridSize}`;
      }
      if (syncState) {
        setPan({ x: nextX, y: nextY });
        setZoom(nextZ);
      }
    },
    []
  );

  const lastWallTapRef = useRef<{ time: number; x: number; y: number }>({
    time: 0,
    x: 0,
    y: 0,
  });
  const lastRoamIdRef = useRef<string | null>(null);

  const interactionRef = useRef<{
    mode: "none" | "pan" | "card" | "zone" | "pinch";
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    vx: number;
    vy: number;
    movedDistance: number;
    cardId?: string;
    zoneId?: string;
    cardBaseX?: number;
    cardBaseY?: number;
    cardRotation?: number;
    hasLifted?: boolean;
    initialPinchDist?: number;
    initialZoom?: number;
  }>({
    mode: "none",
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0,
    movedDistance: 0,
  });

  const animFrameRef = useRef<number | null>(null);

  const stopAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const flyCameraTo = useCallback(
    (targetPanX: number, targetPanY: number, targetZoom?: number) => {
      stopAnimation();
      const startX = panRef.current.x;
      const startY = panRef.current.y;
      const startZ = zoomRef.current;
      const endZ = targetZoom ?? startZ;
      const duration = 380;
      const t0 = performance.now();

      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const ease = 1 - Math.pow(1 - p, 3);
        const nextX = startX + (targetPanX - startX) * ease;
        const nextY = startY + (targetPanY - startY) * ease;
        const nextZ =
          targetZoom !== undefined
            ? startZ + (endZ - startZ) * ease
            : zoomRef.current;
        applyCameraTransform(nextX, nextY, nextZ, p >= 1);
        if (p < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    },
    [stopAnimation, applyCameraTransform]
  );

  const positionedCards = useMemo(() => {
    return memories.map((card, idx) => ({
      card,
      pos: computeInitialBoardPosition(card, idx, memories.length),
    }));
  }, [memories]);

  // 计算每张便签的实时坐标（含拖拽偏移），供红线/麻绳连线动态跟随
  const cardLiveCoordsMap = useMemo(() => {
    const map: Record<string, { x: number; y: number; card: MemoryCard }> = {};
    for (const { card, pos } of positionedCards) {
      const isDrag = draggingCardId === card.id;
      map[card.id] = {
        x: pos.x + (isDrag ? dragOffset.dx : 0),
        y: pos.y + (isDrag ? dragOffset.dy : 0),
        card,
      };
    }
    return map;
  }, [positionedCards, draggingCardId, dragOffset]);

  // 聚合墙面连线（手动关联彩色棉绳 + 同标签同频麻绳线）
  const boardThreads = useMemo(() => {
    if (threadMode === "off" && !linkingFromCardId) return [];

    const threads: {
      key: string;
      fromId: string;
      toId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      kind: "manual" | "tag";
      color: ThreadColor;
    }[] = [];
    const seenPairs = new Set<string>();

    // 1. 用户手动关联的思维连线（支持每条连线独立选色；存在筛选时仅保留两端均命中的连线）
    for (const { card } of positionedCards) {
      const linked = card.linkedCardIds || [];
      for (const targetId of linked) {
        if (
          hasActiveFilter &&
          (!matchedIds.has(card.id) || !matchedIds.has(targetId))
        ) {
          continue;
        }
        const pairKey =
          card.id < targetId
            ? `${card.id}::${targetId}`
            : `${targetId}::${card.id}`;
        if (seenPairs.has(pairKey)) continue;
        const p1 = cardLiveCoordsMap[card.id];
        const p2 = cardLiveCoordsMap[targetId];
        if (!p1 || !p2) continue;
        seenPairs.add(pairKey);
        const resolvedColor: ThreadColor =
          card.linkedCardColors?.[targetId] ||
          p2.card.linkedCardColors?.[card.id] ||
          "crimson";
        threads.push({
          key: `manual-${pairKey}`,
          fromId: card.id,
          toId: targetId,
          x1: p1.x,
          y1: p1.y - 96,
          x2: p2.x,
          y2: p2.y - 96,
          kind: "manual",
          color: resolvedColor,
        });
      }
    }

    // 2. 同标签共鸣麻绳连线（当开启 "all" 模式时展示；存在筛选时仅连接命中的便签）
    if (threadMode === "all") {
      const tagGroups: Record<string, string[]> = {};
      for (const { card } of positionedCards) {
        if (hasActiveFilter && !matchedIds.has(card.id)) continue;
        for (const t of card.tags) {
          if (activeTag && t !== activeTag) continue;
          if (!tagGroups[t]) tagGroups[t] = [];
          tagGroups[t].push(card.id);
        }
      }

      for (const [tag, ids] of Object.entries(tagGroups)) {
        if (ids.length < 2 || ids.length > 6) continue;
        for (let i = 0; i < ids.length - 1; i++) {
          const a = ids[i];
          const b = ids[i + 1];
          const pairKey = a < b ? `${a}::${b}` : `${b}::${a}`;
          if (seenPairs.has(pairKey)) continue;
          const p1 = cardLiveCoordsMap[a];
          const p2 = cardLiveCoordsMap[b];
          if (!p1 || !p2) continue;
          seenPairs.add(pairKey);
          threads.push({
            key: `tag-${tag}-${pairKey}`,
            fromId: a,
            toId: b,
            x1: p1.x,
            y1: p1.y - 96,
            x2: p2.x,
            y2: p2.y - 96,
            kind: "tag",
            color: "amber",
          });
        }
      }
    }

    return threads;
  }, [
    positionedCards,
    cardLiveCoordsMap,
    threadMode,
    activeTag,
    hasActiveFilter,
    matchedIds,
    linkingFromCardId,
  ]);

  useEffect(() => {
    if (centerTrigger > 0) {
      flyCameraTo(0, 0, 0.92);
    }
  }, [centerTrigger, flyCameraTo]);

  useEffect(() => {
    if (!focusCardRequest?.id) return;
    const found = positionedCards.find(
      (p) => p.card.id === focusCardRequest.id
    );
    if (!found) return;
    const targetZ = Math.max(zoomRef.current, 0.98);
    flyCameraTo(-found.pos.x * targetZ, -found.pos.y * targetZ, targetZ);
    setSpotlightId(found.card.id);
    const timer = setTimeout(() => {
      setSpotlightId((prev) => (prev === found.card.id ? null : prev));
    }, 2200);
    return () => clearTimeout(timer);
  }, [focusCardRequest, positionedCards, flyCameraTo]);

  useEffect(() => {
    if (!hasActiveFilter) return;
    const firstMatched = positionedCards.find((p) =>
      matchedIds.has(p.card.id)
    );
    if (firstMatched) {
      const targetZ = zoomRef.current;
      flyCameraTo(-firstMatched.pos.x * targetZ, -firstMatched.pos.y * targetZ);
      setSpotlightId(firstMatched.card.id);
      const timer = setTimeout(() => setSpotlightId(null), 1800);
      return () => clearTimeout(timer);
    }
  }, [hasActiveFilter, matchedIds, positionedCards, flyCameraTo]);

  const handleRecenter = () => {
    triggerHaptic(8);
    flyCameraTo(0, 0, 0.92);
  };

  const handleRandomRoam = () => {
    if (positionedCards.length === 0) return;
    triggerHaptic([8, 25, 8]);
    const candidates =
      positionedCards.length > 1
        ? positionedCards.filter((p) => p.card.id !== lastRoamIdRef.current)
        : positionedCards;
    const picked =
      candidates[Math.floor(Math.random() * candidates.length)] ||
      positionedCards[0];
    lastRoamIdRef.current = picked.card.id;

    const targetZoom = 1.02;
    flyCameraTo(
      -picked.pos.x * targetZoom,
      -picked.pos.y * targetZoom,
      targetZoom
    );
    setSpotlightId(picked.card.id);
    setTimeout(() => {
      setSpotlightId((prev) => (prev === picked.card.id ? null : prev));
    }, 2200);
  };

  const handleAddBoardZone = () => {
    triggerHaptic(10);
    const centerBoardX = Math.round(-panRef.current.x / zoomRef.current);
    const centerBoardY = Math.round(-panRef.current.y / zoomRef.current - 120);
    const styles: BoardZone["style"][] = ["walnut", "brass", "washi"];
    const newZone: BoardZone = {
      id: `zone-${Date.now()}`,
      title: "✦ 新分区主题",
      subtitle: "CURATED COLLECTION",
      x: centerBoardX,
      y: centerBoardY,
      style: styles[zones.length % styles.length],
    };
    const next = [...zones, newZone];
    saveZones(next);
    setEditingZone(newZone);
  };

  const triggerPinAtScreenPoint = (clientX: number, clientY: number) => {
    if (isBoardLocked || !onDoubleClickWall || typeof window === "undefined")
      return;
    triggerHaptic([10, 30, 10]);
    const boardX = Math.round(
      (clientX - window.innerWidth / 2 - panRef.current.x) / zoomRef.current
    );
    const boardY = Math.round(
      (clientY - window.innerHeight / 2 - panRef.current.y) / zoomRef.current
    );
    setPinRipple({ x: boardX, y: boardY });
    setTimeout(() => {
      setPinRipple(null);
      onDoubleClickWall(boardX, boardY);
    }, 180);
  };

  const startInertia = (vx: number, vy: number) => {
    stopAnimation();
    let curVx = vx;
    let curVy = vy;

    const step = () => {
      curVx *= 0.92;
      curVy *= 0.92;
      if (Math.abs(curVx) < 0.25 && Math.abs(curVy) < 0.25) {
        applyCameraTransform(
          panRef.current.x,
          panRef.current.y,
          zoomRef.current,
          true
        );
        animFrameRef.current = null;
        return;
      }
      applyCameraTransform(
        panRef.current.x + curVx,
        panRef.current.y + curVy,
        zoomRef.current,
        false
      );
      animFrameRef.current = requestAnimationFrame(step);
    };
    animFrameRef.current = requestAnimationFrame(step);
  };

  const beginCanvasPan = (clientX: number, clientY: number) => {
    stopAnimation();
    interactionRef.current = {
      mode: "pan",
      startX: clientX,
      startY: clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      lastX: clientX,
      lastY: clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      movedDistance: 0,
    };
  };

  const beginCardDrag = (
    e: React.TouchEvent | React.MouseEvent,
    cardId: string,
    cardBaseX: number,
    cardBaseY: number,
    cardRotation: number
  ) => {
    if ("touches" in e && e.touches.length > 1) return;
    if ("button" in e && e.button !== 0) return;
    e.stopPropagation();
    stopAnimation();
    const clientX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    interactionRef.current = {
      mode: "card",
      cardId,
      cardBaseX,
      cardBaseY,
      cardRotation,
      hasLifted: false,
      startX: clientX,
      startY: clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      lastX: clientX,
      lastY: clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      movedDistance: 0,
    };
  };

  const beginZoneDrag = (
    e: React.TouchEvent | React.MouseEvent,
    zoneId: string,
    zoneBaseX: number,
    zoneBaseY: number
  ) => {
    if ("touches" in e && e.touches.length > 1) return;
    if ("button" in e && e.button !== 0) return;
    e.stopPropagation();
    stopAnimation();
    const clientX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    interactionRef.current = {
      mode: "zone",
      zoneId,
      cardBaseX: zoneBaseX,
      cardBaseY: zoneBaseY,
      hasLifted: false,
      startX: clientX,
      startY: clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      lastX: clientX,
      lastY: clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      movedDistance: 0,
    };
  };

  const updateDraggedItemTransform = (clientX: number, clientY: number) => {
    const state = interactionRef.current;
    const dx = clientX - state.startX;
    const dy = clientY - state.startY;
    state.lastX = clientX;
    state.lastY = clientY;
    state.movedDistance = Math.hypot(dx, dy);

    const boardDx = dx / zoomRef.current;
    const boardDy = dy / zoomRef.current;

    if (state.mode === "card" && state.cardId) {
      if (!state.hasLifted && state.movedDistance > 2) {
        state.hasLifted = true;
        triggerHaptic(8);
        setDraggingCardId(state.cardId);
      }
      if (state.hasLifted) {
        setDragOffset({ dx: boardDx, dy: boardDy });
      }
      const el = cardElsRef.current[state.cardId];
      if (el) {
        const nextX = (state.cardBaseX || 0) + boardDx - 125;
        const nextY = (state.cardBaseY || 0) + boardDy - 110;
        el.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) rotate(0deg) scale(1.03)`;
      }
    } else if (state.mode === "zone" && state.zoneId) {
      if (!state.hasLifted && state.movedDistance > 2) {
        state.hasLifted = true;
        triggerHaptic(8);
        setDraggingZoneId(state.zoneId);
      }
      const el = zoneElsRef.current[state.zoneId];
      if (el) {
        const nextX = (state.cardBaseX || 0) + boardDx - 115;
        const nextY = (state.cardBaseY || 0) + boardDy - 28;
        el.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(1.04)`;
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      stopAnimation();
      setDraggingCardId(null);
      setDraggingZoneId(null);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const midX =
        (e.touches[0].clientX + e.touches[1].clientX) / 2 -
        (typeof window !== "undefined" ? window.innerWidth / 2 : 0);
      const midY =
        (e.touches[0].clientY + e.touches[1].clientY) / 2 -
        (typeof window !== "undefined" ? window.innerHeight / 2 : 0);
      interactionRef.current = {
        ...interactionRef.current,
        mode: "pinch",
        startX: midX,
        startY: midY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        initialPinchDist: Math.max(1, Math.hypot(dx, dy)),
        initialZoom: zoomRef.current,
      };
      return;
    }

    if (
      e.touches.length === 1 &&
      interactionRef.current.mode !== "card" &&
      interactionRef.current.mode !== "zone"
    ) {
      beginCanvasPan(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const state = interactionRef.current;

    if (
      e.touches.length === 2 &&
      state.mode === "pinch" &&
      state.initialPinchDist
    ) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const scaleFactor = dist / state.initialPinchDist;
      const baseZoom = state.initialZoom || 0.92;
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, baseZoom * scaleFactor)
      );
      const midX =
        (e.touches[0].clientX + e.touches[1].clientX) / 2 -
        (typeof window !== "undefined" ? window.innerWidth / 2 : 0);
      const midY =
        (e.touches[0].clientY + e.touches[1].clientY) / 2 -
        (typeof window !== "undefined" ? window.innerHeight / 2 : 0);
      const ratio = nextZoom / baseZoom;
      const nextPanX = midX - (state.startX - state.startPanX) * ratio;
      const nextPanY = midY - (state.startY - state.startPanY) * ratio;
      applyCameraTransform(nextPanX, nextPanY, nextZoom, false);
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (state.mode === "card" || state.mode === "zone") {
      updateDraggedItemTransform(touch.clientX, touch.clientY);
      return;
    }

    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    state.movedDistance = Math.hypot(dx, dy);

    if (state.mode === "pan") {
      const now = performance.now();
      const dt = Math.max(1, now - state.lastTime);
      state.vx = ((touch.clientX - state.lastX) / dt) * 15;
      state.vy = ((touch.clientY - state.lastY) / dt) * 15;
      state.lastX = touch.clientX;
      state.lastY = touch.clientY;
      state.lastTime = now;

      applyCameraTransform(
        state.startPanX + dx,
        state.startPanY + dy,
        zoomRef.current,
        false
      );
    }
  };

  const finishInteraction = (e?: React.TouchEvent | React.MouseEvent) => {
    const state = interactionRef.current;
    if (state.mode === "card" && state.cardId) {
      const boardDx = (state.lastX - state.startX) / zoomRef.current;
      const boardDy = (state.lastY - state.startY) / zoomRef.current;
      const finalX = Math.round((state.cardBaseX || 0) + boardDx);
      const finalY = Math.round((state.cardBaseY || 0) + boardDy);

      if (state.movedDistance > 2) {
        const el = cardElsRef.current[state.cardId];
        if (el) {
          el.style.transform = `translate3d(${finalX - 125}px, ${
            finalY - 110
          }px, 0) rotate(${state.cardRotation || 0}deg) scale(1)`;
        }
        onUpdateCardPosition(state.cardId, finalX, finalY);
      }
      setDraggingCardId(null);
      setDragOffset({ dx: 0, dy: 0 });
    } else if (state.mode === "zone" && state.zoneId) {
      const boardDx = (state.lastX - state.startX) / zoomRef.current;
      const boardDy = (state.lastY - state.startY) / zoomRef.current;
      const finalX = Math.round((state.cardBaseX || 0) + boardDx);
      const finalY = Math.round((state.cardBaseY || 0) + boardDy);

      if (state.movedDistance > 2) {
        const nextZones = zones.map((z) =>
          z.id === state.zoneId ? { ...z, x: finalX, y: finalY } : z
        );
        saveZones(nextZones);
      }
      setDraggingZoneId(null);
    } else if (state.mode === "pan") {
      if (
        state.movedDistance < 10 &&
        e &&
        "changedTouches" in e &&
        e.target === containerRef.current
      ) {
        const now = Date.now();
        const prevTap = lastWallTapRef.current;
        if (
          now - prevTap.time < 290 &&
          Math.hypot(state.startX - prevTap.x, state.startY - prevTap.y) < 36
        ) {
          lastWallTapRef.current = { time: 0, x: 0, y: 0 };
          triggerPinAtScreenPoint(state.startX, state.startY);
          interactionRef.current.mode = "none";
          return;
        }
        lastWallTapRef.current = {
          time: now,
          x: state.startX,
          y: state.startY,
        };
      }

      if (Math.hypot(state.vx, state.vy) > 1.2) {
        startInertia(state.vx, state.vy);
      } else {
        setPan(panRef.current);
      }
    } else if (state.mode === "pinch") {
      setPan(panRef.current);
      setZoom(zoomRef.current);
    }
    interactionRef.current.mode = "none";
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      e.button !== 0 ||
      interactionRef.current.mode === "card" ||
      interactionRef.current.mode === "zone"
    )
      return;
    beginCanvasPan(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const state = interactionRef.current;
    if (state.mode === "none") return;

    if (state.mode === "card" || state.mode === "zone") {
      updateDraggedItemTransform(e.clientX, e.clientY);
      return;
    }

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    state.movedDistance = Math.hypot(dx, dy);

    if (state.mode === "pan") {
      const now = performance.now();
      const dt = Math.max(1, now - state.lastTime);
      state.vx = ((e.clientX - state.lastX) / dt) * 15;
      state.vy = ((e.clientY - state.lastY) / dt) * 15;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.lastTime = now;

      applyCameraTransform(
        state.startPanX + dx,
        state.startPanY + dy,
        zoomRef.current,
        false
      );
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current) return;
    triggerPinAtScreenPoint(e.clientX, e.clientY);
  };

  const handleWheel = (e: React.WheelEvent) => {
    stopAnimation();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.004);
      const prevZ = zoomRef.current;
      const nextZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZ * factor));
      const ratio = nextZ / prevZ;
      applyCameraTransform(
        panRef.current.x * ratio,
        panRef.current.y * ratio,
        nextZ,
        true
      );
    } else {
      applyCameraTransform(
        panRef.current.x - e.deltaX,
        panRef.current.y - e.deltaY,
        zoomRef.current,
        false
      );
    }
  };

  const linkingSourceCard = useMemo(
    () =>
      linkingFromCardId
        ? memories.find((m) => m.id === linkingFromCardId) || null
        : null,
    [linkingFromCardId, memories]
  );

  const isNight = themeMode === "night_lamp";

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishInteraction}
      onTouchCancel={finishInteraction}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishInteraction}
      onMouseLeave={finishInteraction}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      style={{
        backgroundPosition: `${panRef.current.x}px ${panRef.current.y}px`,
        backgroundSize: `${getAdaptiveGridSize(zoomRef.current)}px ${getAdaptiveGridSize(zoomRef.current)}px`,
      }}
      className="fixed inset-0 overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing wall-dot-matrix"
    >
      {/* 深夜台灯模式：书桌暖光锥柔光层 */}
      {isNight && (
        <div className="fixed inset-0 pointer-events-none lamp-ambient-cone z-[1]" />
      )}

      {/* 墙面牵线引导横幅（内置 5 色线团选择器） */}
      {linkingSourceCard && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed top-18 left-1/2 -translate-x-1/2 z-40 px-3 w-full max-w-md pointer-events-auto"
        >
          <div className="rounded-2xl bg-[#2C251E]/95 text-[#FBF6E9] px-4 py-3 shadow-xl border border-[#5E4B3B] flex flex-col gap-2.5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link2
                  style={{ color: THREAD_COLOR_STYLES[activeLinkColor].stroke }}
                  className="w-4 h-4 shrink-0 animate-pulse"
                />
                <span className="text-xs truncate">
                  从「
                  {linkingSourceCard.title ||
                    linkingSourceCard.summary ||
                    linkingSourceCard.rawContent.slice(0, 12)}
                  」牵线：点击目标便签
                </span>
              </div>
              <button
                type="button"
                onClick={() => onCancelLinking?.()}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-[#E8C589] shrink-0 cursor-pointer"
              >
                完成
              </button>
            </div>

            {/* 5 种线色实时切换 */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <span className="text-[11px] text-[#C4B299]">
                选择线色：{THREAD_COLOR_STYLES[activeLinkColor].label}
              </span>
              <div className="flex items-center gap-2">
                {THREAD_COLOR_LIST.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      setActiveLinkColor(c);
                    }}
                    title={THREAD_COLOR_STYLES[c].label}
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                      THREAD_COLOR_STYLES[c].dotBg
                    } ${
                      activeLinkColor === c
                        ? "scale-125 ring-2 ring-[#FFFDF8]"
                        : "opacity-75 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 点击墙上已有手动连线时弹出的轻量调色与解绑浮条 */}
      {selectedThreadPair && !linkingSourceCard && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed top-18 left-1/2 -translate-x-1/2 z-40 px-3 w-full max-w-xs pointer-events-auto"
        >
          <div className="rounded-2xl bg-[#2C251E]/95 text-[#FBF6E9] px-4 py-2.5 shadow-xl border border-[#5E4B3B] flex items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              {THREAD_COLOR_LIST.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    onUpdatePairThreadColor?.(
                      selectedThreadPair.fromId,
                      selectedThreadPair.toId,
                      c
                    );
                    setSelectedThreadPair((prev) =>
                      prev ? { ...prev, color: c } : null
                    );
                  }}
                  title={THREAD_COLOR_STYLES[c].label}
                  className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                    THREAD_COLOR_STYLES[c].dotBg
                  } ${
                    selectedThreadPair.color === c
                      ? "scale-125 ring-2 ring-[#FFFDF8]"
                      : "opacity-75 hover:opacity-100"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onToggleLinkCard?.(
                    selectedThreadPair.fromId,
                    selectedThreadPair.toId
                  );
                  setSelectedThreadPair(null);
                }}
                className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs cursor-pointer"
              >
                解开
              </button>
              <button
                type="button"
                onClick={() => setSelectedThreadPair(null)}
                className="p-1 text-[#A39584] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2D 便签画布原点置于屏幕正中央 */}
      <div
        ref={canvasRef}
        style={{
          transform: `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${zoomRef.current})`,
          transformOrigin: "0 0",
        }}
        className="absolute left-1/2 top-1/2 w-0 h-0 will-change-transform z-[2]"
      >
        {/* 1. 桌面分区木牌 / 铭牌贴纸层 (Board Zones) */}
        {zones.map((zone) => {
          const stylePreset =
            ZONE_STYLE_PRESETS[zone.style] || ZONE_STYLE_PRESETS.walnut;
          const isDraggingThisZone = draggingZoneId === zone.id;
          return (
            <div
              key={zone.id}
              ref={(el) => {
                zoneElsRef.current[zone.id] = el;
              }}
              onTouchStart={(e) => {
                if (isBoardLocked) return;
                beginZoneDrag(e, zone.id, zone.x, zone.y);
              }}
              onMouseDown={(e) => {
                if (isBoardLocked) return;
                beginZoneDrag(e, zone.id, zone.x, zone.y);
              }}
              onClick={(e) => {
                if (isBoardLocked) return;
                e.stopPropagation();
                if (interactionRef.current.movedDistance > 6) return;
                triggerHaptic(8);
                setEditingZone(zone);
              }}
              style={{
                transform: `translate3d(${zone.x - 115}px, ${
                  zone.y - 28
                }px, 0) scale(${isDraggingThisZone ? 1.04 : 1})`,
                zIndex: isDraggingThisZone ? 45 : 5,
              }}
              className={`absolute w-[230px] rounded-2xl border px-4 py-2.5 flex items-center justify-between gap-2 will-change-transform ${
                stylePreset.container
              } ${
                isBoardLocked
                  ? "pointer-events-none"
                  : isDraggingThisZone
                  ? "cursor-grabbing"
                  : "cursor-grab"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full border shrink-0 ${stylePreset.nail}`}
              />
              <div className="min-w-0 flex-1 text-center">
                <div
                  className={`font-serif-notebook text-xs font-bold truncate ${stylePreset.title}`}
                >
                  {zone.title}
                </div>
                {zone.subtitle && (
                  <div
                    className={`text-[9px] font-mono tracking-widest uppercase truncate mt-0.5 ${stylePreset.subtitle}`}
                  >
                    {zone.subtitle}
                  </div>
                )}
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full border shrink-0 ${stylePreset.nail}`}
              />
            </div>
          );
        })}

        {/* 2. 便签图钉彩色棉线 / 同频麻绳 SVG 连线层（无文字标签、带捻股纹理与可点击换色） */}
        {boardThreads.length > 0 && (
          <svg
            width="1"
            height="1"
            className="overflow-visible pointer-events-none absolute left-0 top-0 z-[25]"
          >
            {boardThreads.map((t) => {
              const dx = t.x2 - t.x1;
              const dy = t.y2 - t.y1;
              const dist = Math.hypot(dx, dy);
              const sag = Math.min(82, Math.max(20, dist * 0.14));
              const cx = (t.x1 + t.x2) / 2;
              const cy = (t.y1 + t.y2) / 2 + sag;
              const pathD = `M ${t.x1} ${t.y1} Q ${cx} ${cy} ${t.x2} ${t.y2}`;
              const shadowPathD = `M ${t.x1} ${t.y1 + 2} Q ${cx} ${
                cy + 7
              } ${t.x2} ${t.y2 + 2}`;
              const isManual = t.kind === "manual";
              const colorStyle =
                THREAD_COLOR_STYLES[t.color] || THREAD_COLOR_STYLES.crimson;

              return (
                <g key={t.key}>
                  {/* 悬空感柔和底影 */}
                  <path
                    d={shadowPathD}
                    fill="none"
                    stroke="rgba(28, 20, 12, 0.16)"
                    strokeWidth={isManual ? 3.4 : 2.2}
                    strokeLinecap="round"
                  />
                  {/* 主棉线 / 麻绳线条 */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={colorStyle.stroke}
                    strokeWidth={isManual ? 2.5 : 1.6}
                    strokeDasharray={isManual ? undefined : "5 6"}
                    strokeOpacity={isManual ? 0.94 : 0.62}
                    strokeLinecap="round"
                  />
                  {/* 手动棉线的双股捻纹高光细节 */}
                  {isManual && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={colorStyle.highlight}
                      strokeWidth={1.05}
                      strokeDasharray="3 5"
                      strokeLinecap="round"
                    />
                  )}
                  {/* 手动连线的透明宽触控区：点击连线即可弹出 5 色调色盘或解绑 */}
                  {isManual && !isBoardLocked && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={18}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic(8);
                        setSelectedThreadPair({
                          fromId: t.fromId,
                          toId: t.toId,
                          color: t.color,
                        });
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* 双击墙面空白处时的定位图钉波纹 */}
        {pinRipple && (
          <div
            style={{
              transform: `translate3d(${pinRipple.x - 16}px, ${
                pinRipple.y - 16
              }px, 0)`,
            }}
            className="absolute w-8 h-8 rounded-full bg-[#C87D32]/35 border-2 border-[#C87D32] animate-ping pointer-events-none z-50"
          />
        )}

        {positionedCards.map(({ card, pos }) => {
          const isDraggingThis = draggingCardId === card.id;
          const isSpotlight =
            spotlightId === card.id || linkingFromCardId === card.id;
          const isLinkedToSource =
            Boolean(linkingFromCardId) &&
            linkingFromCardId !== card.id &&
            ((card.linkedCardIds || []).includes(linkingFromCardId!) ||
              (linkingSourceCard?.linkedCardIds || []).includes(card.id));

          const activeDeltaX = isDraggingThis ? dragOffset.dx : 0;
          const activeDeltaY = isDraggingThis ? dragOffset.dy : 0;
          const x = pos.x + activeDeltaX;
          const y = pos.y + activeDeltaY;
          const isMatched = !hasActiveFilter || matchedIds.has(card.id);
          const pinColor = PIN_COLORS[card.type] || PIN_COLORS.ai_insight;
          const paperStyle = PAPER_COLOR_STYLES[resolveCardPaperColor(card)];
          const images = card.images || [];

          return (
            <div
              key={card.id}
              ref={(el) => {
                cardElsRef.current[card.id] = el;
              }}
              onTouchStart={(e) => {
                if (isBoardLocked) return;
                beginCardDrag(e, card.id, pos.x, pos.y, pos.rotation);
              }}
              onMouseDown={(e) => {
                if (isBoardLocked) return;
                beginCardDrag(e, card.id, pos.x, pos.y, pos.rotation);
              }}
              style={{
                transform: `translate3d(${x - 125}px, ${y - 110}px, 0) rotate(${
                  isDraggingThis ? 0 : pos.rotation
                }deg) scale(${
                  isDraggingThis
                    ? 1.03
                    : isSpotlight
                    ? 1.04
                    : isMatched
                    ? 1
                    : 0.92
                })`,
                zIndex: isDraggingThis
                  ? 50
                  : isSpotlight
                  ? 40
                  : card.isPinned
                  ? 20
                  : 10,
              }}
              onClick={(e) => {
                if (isBoardLocked) return;
                e.stopPropagation();
                if (interactionRef.current.movedDistance > 6) return;
                triggerHaptic(8);
                if (linkingFromCardId) {
                  if (linkingFromCardId === card.id) {
                    onCancelLinking?.();
                  } else {
                    onToggleLinkCard?.(
                      linkingFromCardId,
                      card.id,
                      activeLinkColor
                    );
                  }
                  return;
                }
                onSelectCard(card);
              }}
              className={`absolute w-[248px] sm:w-[268px] will-change-transform ${
                isArranging
                  ? "transition-transform duration-300 ease-out"
                  : "transition-opacity duration-150"
              } ${
                isBoardLocked
                  ? "pointer-events-none"
                  : linkingFromCardId
                  ? "cursor-pointer"
                  : isDraggingThis
                  ? "cursor-grabbing"
                  : "cursor-grab"
              } ${
                isMatched ? "opacity-100" : "opacity-20 pointer-events-none"
              }`}
            >
              {/* 顶部图钉 / 和纸胶带 */}
              {card.type === "exhibition" ? (
                <div
                  className={`w-24 h-5 mx-auto mb-[-10px] relative z-20 border shadow-2xs ${
                    TAPE_BG[card.tapeStyle || "amber"] || TAPE_BG.amber
                  }`}
                  style={{
                    clipPath:
                      "polygon(3% 0%, 97% 2%, 100% 35%, 96% 70%, 100% 100%, 2% 98%, 0% 65%, 4% 30%)",
                  }}
                />
              ) : (
                <div className="w-8 h-8 mx-auto mb-[-16px] relative z-20 flex items-center justify-center">
                  <span
                    style={{
                      backgroundColor: pinColor.head,
                      borderColor: pinColor.rim,
                    }}
                    className="w-4 h-4 rounded-full border-2 shadow-md flex items-center justify-center relative"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/45 -mt-0.5 -ml-0.5" />
                  </span>
                </div>
              )}

              {/* 便签纸张主体 */}
              {card.type === "ai_insight" && (
                <div
                  className={`rounded-xl ${paperStyle.bg} border ${
                    paperStyle.border
                  } p-4 pt-5 sticky-note-shadow ${
                    isDraggingThis
                      ? "shadow-2xl ring-2 ring-[#5C7457]/40"
                      : linkingFromCardId === card.id
                      ? "ring-2 ring-[#C44D3B] shadow-xl"
                      : isLinkedToSource
                      ? "ring-2 ring-[#C44D3B]/60"
                      : isSpotlight
                      ? "ring-2 ring-[#C87D32] shadow-xl"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-[#7D7060] mb-2">
                    <span className="inline-flex items-center gap-1 text-[#496044] font-medium">
                      <Sparkles className="w-3 h-3" />
                      灵感便签
                    </span>
                    <div className="flex items-center gap-1">
                      {(card.linkedCardIds?.length || 0) > 0 && (
                        <Link2 className="w-3 h-3 text-[#B84A39]" />
                      )}
                      {card.isPinned && (
                        <Pin className="w-3 h-3 text-[#C87D32] fill-current" />
                      )}
                    </div>
                  </div>

                  <p className="font-serif-notebook text-[16px] leading-relaxed font-semibold text-[#2A231C] line-clamp-4">
                    “{card.summary || card.rawContent.slice(0, 36)}”
                  </p>

                  <div
                    className={`mt-3 pt-2.5 border-t border-dashed ${paperStyle.divider} flex items-center justify-between gap-1.5 flex-wrap`}
                  >
                    <div className="flex flex-wrap gap-1">
                      {card.tags.slice(0, 3).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (interactionRef.current.movedDistance > 8)
                              return;
                            triggerHaptic(6);
                            onTagClick(tag);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                            activeTag === tag
                              ? "bg-[#C87D32] text-white"
                              : `${paperStyle.tagBg} ${paperStyle.tagText}`
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                    <time className="text-[10px] font-mono text-[#9A8C7A]">
                      {card.dateLabel.split(" ")[0]}
                    </time>
                  </div>
                </div>
              )}

              {card.type === "exhibition" && (
                <div
                  className={`rounded-xl bg-[#FFFDF9] p-3 pb-3.5 polaroid-shadow ${
                    isDraggingThis
                      ? "shadow-2xl ring-2 ring-[#C87D32]/40"
                      : linkingFromCardId === card.id
                      ? "ring-2 ring-[#C44D3B] shadow-xl"
                      : isLinkedToSource
                      ? "ring-2 ring-[#C44D3B]/60"
                      : isSpotlight
                      ? "ring-2 ring-[#C87D32] shadow-xl"
                      : ""
                  }`}
                >
                  {images.length > 0 && (
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-[#F2ECE1] mb-2.5">
                      <img
                        src={images[0]}
                        alt={card.title || "拍立得"}
                        draggable={false}
                        loading="lazy"
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      {images.length > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/55 text-white text-[10px] flex items-center gap-0.5">
                          <Camera className="w-2.5 h-2.5" />
                          {images.length}
                        </span>
                      )}
                    </div>
                  )}

                  {card.title && (
                    <h3 className="font-serif-notebook text-[15px] font-bold text-[#2A231C] truncate">
                      {card.title}
                    </h3>
                  )}

                  <p className="text-xs text-[#54493E] line-clamp-2 mt-1 leading-relaxed">
                    {card.rawContent}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-dashed border-[#EAE0D0] flex items-center justify-between text-[10px] text-[#857767]">
                    <span className="truncate max-w-[135px] flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5 text-[#C87D32] shrink-0" />
                      {card.location || "现场记录"}
                    </span>
                    <time className="font-mono">
                      {card.dateLabel.split(" ")[0]}
                    </time>
                  </div>
                </div>
              )}

              {card.type === "milestone" && (
                <div
                  className={`rounded-xl p-[1px] bg-gradient-to-br from-[#DDA14B] via-[#E8C589] to-[#C87D32] sticky-note-shadow ${
                    isDraggingThis
                      ? "shadow-2xl"
                      : linkingFromCardId === card.id
                      ? "ring-2 ring-[#C44D3B] shadow-xl"
                      : isLinkedToSource
                      ? "ring-2 ring-[#C44D3B]/60"
                      : isSpotlight
                      ? "ring-2 ring-[#C87D32] shadow-xl"
                      : ""
                  }`}
                >
                  <div className="rounded-[11px] bg-gradient-to-br from-[#FFF9EB] to-[#FBF1DA] p-4 pt-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C87D32] text-white">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {card.milestoneBadge || "高光时刻"}
                      </span>
                      <time className="text-[10px] font-mono text-[#9A7D5B]">
                        {card.dateLabel.split(" ")[0]}
                      </time>
                    </div>

                    {card.title && (
                      <h3 className="font-serif-notebook text-[15px] font-bold text-[#2B2117] leading-snug mb-1 line-clamp-2">
                        {card.title}
                      </h3>
                    )}

                    {images.length > 0 && (
                      <div className="my-2 aspect-[16/10] rounded-lg overflow-hidden border border-[#EBD8B7]">
                        <img
                          src={images[0]}
                          alt={card.title || "配图"}
                          draggable={false}
                          loading="lazy"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                    )}

                    <p className="text-xs text-[#4A3D2F] line-clamp-3 leading-relaxed">
                      {card.rawContent}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 点击桌面分区牌弹出的轻量编辑窗 */}
      {editingZone && (
        <div
          onClick={() => setEditingZone(null)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#FBF6E9] border border-[#DFD2BA] p-5 space-y-4 paper-shadow"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif-notebook text-sm font-bold text-[#2C251E]">
                编辑桌面分区铭牌
              </h3>
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="p-1 rounded-full text-[#7E7060] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#6E6050] mb-1">
                  分区主标题
                </label>
                <input
                  type="text"
                  value={editingZone.title}
                  onChange={(e) =>
                    setEditingZone({ ...editingZone, title: e.target.value })
                  }
                  placeholder="例如：✦ 2026 秋日看展"
                  className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] px-3 py-2 text-xs text-[#2C251E] focus:outline-none focus:border-[#C87D32]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#6E6050] mb-1">
                  英文/副标题（可选）
                </label>
                <input
                  type="text"
                  value={editingZone.subtitle || ""}
                  onChange={(e) =>
                    setEditingZone({
                      ...editingZone,
                      subtitle: e.target.value,
                    })
                  }
                  placeholder="例如：AUTUMN EXHIBITIONS"
                  className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] px-3 py-2 text-xs font-mono text-[#2C251E] focus:outline-none focus:border-[#C87D32]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#6E6050] mb-1.5">
                  铭牌材质
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["walnut", "brass", "washi"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        setEditingZone({ ...editingZone, style: st })
                      }
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                        editingZone.style === st
                          ? "bg-[#2C251E] text-[#FBF6E9] border-[#2C251E]"
                          : "bg-[#FFFDF8] text-[#5E5244] border-[#DFD2BA]"
                      }`}
                    >
                      {ZONE_STYLE_PRESETS[st].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  const next = zones.filter((z) => z.id !== editingZone.id);
                  saveZones(next);
                  setEditingZone(null);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>移除此铭牌</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  const next = zones.map((z) =>
                    z.id === editingZone.id ? editingZone : z
                  );
                  saveZones(next);
                  setEditingZone(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#2C251E] text-[#FBF6E9] cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#E8C589]" />
                <span>保存铭牌</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 左下角极简画布罗盘：上下分层排布 */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="fixed bottom-6 left-4 z-30 pb-safe flex flex-col items-start gap-2 max-w-[calc(100vw-6.5rem)]"
      >
        {/* 上排：锁定滑动 + 红线连线切换 + 新增分区牌 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setIsBoardLocked((prev) => !prev);
              setDraggingCardId(null);
            }}
            title={
              isBoardLocked
                ? "当前为纯滑动模式（点击解锁便签交互）"
                : "锁定看板（开启后触碰便签不打开详情、不移动单张卡片，全屏顺滑滑动）"
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-md transition-all cursor-pointer ${
              isBoardLocked
                ? "bg-[#2C251E] text-[#E8C589] border-[#5E5042] ring-2 ring-[#C87D32]/50"
                : isNight
                ? "bg-[#261F1A]/92 text-[#EADBC4] border-[#4A3B2F]"
                : "bg-[#FFFDF8]/92 backdrop-blur-md text-[#4A3F33] border-[#DED2BA] hover:bg-[#EFE7D6]"
            }`}
          >
            {isBoardLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-[#E8C589]" />
                <span>仅滑动</span>
              </>
            ) : (
              <>
                <LockOpen className="w-3.5 h-3.5 text-[#C87D32]" />
                <span>锁定</span>
              </>
            )}
          </button>

          {/* 思维红线 / 麻绳连线模式切换 */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setThreadMode((prev) =>
                prev === "all" ? "manual" : prev === "manual" ? "off" : "all"
              );
            }}
            title="切换便签红线与同标签麻绳连线"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold border shadow-md transition-all cursor-pointer ${
              threadMode !== "off"
                ? "bg-[#B84A39] text-[#FFFDF8] border-[#963829]"
                : isNight
                ? "bg-[#261F1A]/92 text-[#B8A690] border-[#4A3B2F]"
                : "bg-[#FFFDF8]/92 text-[#6E6050] border-[#DED2BA]"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>
              {threadMode === "all"
                ? "红线:全显"
                : threadMode === "manual"
                ? "红线:手动"
                : "红线:关"}
            </span>
          </button>

          {/* 新增桌面分区木牌 */}
          <button
            type="button"
            onClick={handleAddBoardZone}
            title="在当前视野放置一块桌面分区铭牌"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold border shadow-md transition-all cursor-pointer ${
              isNight
                ? "bg-[#261F1A]/92 text-[#EADBC4] border-[#4A3B2F] hover:bg-[#332922]"
                : "bg-[#FFFDF8]/92 backdrop-blur-md text-[#4A3F33] border-[#DED2BA] hover:bg-[#EFE7D6]"
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-[#C87D32]" />
            <span>+分区牌</span>
          </button>
        </div>

        {/* 下排：罗盘导航条 */}
        <div
          className={`flex items-center backdrop-blur-md border rounded-full p-1 shadow-md ${
            isNight
              ? "bg-[#261F1A]/92 border-[#4A3B2F]"
              : "bg-[#FFFDF8]/90 border-[#DED2BA]"
          }`}
        >
          <button
            type="button"
            onClick={handleRecenter}
            title="回到中心"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer ${
              isNight
                ? "text-[#EADBC4] hover:bg-white/10"
                : "text-[#4A3F33] hover:bg-[#EFE7D6]"
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#C87D32]" />
            <span>中心</span>
          </button>
          <button
            type="button"
            onClick={handleRandomRoam}
            title="随机漫步到一张便签"
            className={`p-1.5 rounded-full cursor-pointer ${
              isNight
                ? "text-[#C4B299] hover:bg-white/10"
                : "text-[#6E6050] hover:bg-[#EFE7D6]"
            }`}
          >
            <Dices className="w-3.5 h-3.5 text-[#5C7457]" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              const prevZ = zoomRef.current;
              const nextZ = Math.max(MIN_ZOOM, prevZ * 0.78);
              const ratio = nextZ / prevZ;
              applyCameraTransform(
                panRef.current.x * ratio,
                panRef.current.y * ratio,
                nextZ,
                true
              );
            }}
            title="持续缩小"
            className={`p-1.5 rounded-full cursor-pointer ${
              isNight
                ? "text-[#C4B299] hover:bg-white/10"
                : "text-[#6E6050] hover:bg-[#EFE7D6]"
            }`}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              const prevZ = zoomRef.current;
              const nextZ = Math.min(MAX_ZOOM, prevZ * 1.28);
              const ratio = nextZ / prevZ;
              applyCameraTransform(
                panRef.current.x * ratio,
                panRef.current.y * ratio,
                nextZ,
                true
              );
            }}
            title="放大"
            className={`p-1.5 rounded-full cursor-pointer ${
              isNight
                ? "text-[#C4B299] hover:bg-white/10"
                : "text-[#6E6050] hover:bg-[#EFE7D6]"
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setIsArranging(true);
              onAutoArrangeWall();
              setTimeout(() => setIsArranging(false), 360);
            }}
            title="重排便签"
            className={`p-1.5 rounded-full cursor-pointer ${
              isNight
                ? "text-[#C4B299] hover:bg-white/10"
                : "text-[#6E6050] hover:bg-[#EFE7D6]"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
