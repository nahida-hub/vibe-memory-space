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
} from "lucide-react";
import { MemoryCard, PaperColor } from "@/types/memory";
import { triggerHaptic } from "@/utils/storageDb";

interface PinboardWallProps {
  memories: MemoryCard[];
  matchedIds: Set<string>;
  hasActiveFilter: boolean;
  activeTag: string | null;
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

export default function PinboardWall({
  memories,
  matchedIds,
  hasActiveFilter,
  activeTag,
  onSelectCard,
  onTagClick,
  onUpdateCardPosition,
  onAutoArrangeWall,
  onDoubleClickWall,
  onOpenAiReview,
  focusCardRequest = null,
  centerTrigger = 0,
}: PinboardWallProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.92);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [isArranging, setIsArranging] = useState(false);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [pinRipple, setPinRipple] = useState<{ x: number; y: number } | null>(
    null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  const applyCameraTransform = useCallback(
    (nextX: number, nextY: number, nextZ: number, syncState = false) => {
      panRef.current = { x: nextX, y: nextY };
      zoomRef.current = nextZ;
      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(${nextZ})`;
      }
      if (containerRef.current) {
        containerRef.current.style.backgroundPosition = `${nextX}px ${nextY}px`;
        containerRef.current.style.backgroundSize = `${26 * nextZ}px ${26 * nextZ}px`;
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
    mode: "none" | "pan" | "card" | "pinch";
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

  // 平滑镜头飞跃动画
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

  // 外部触发回中心
  useEffect(() => {
    if (centerTrigger > 0) {
      flyCameraTo(0, 0, 0.92);
    }
  }, [centerTrigger, flyCameraTo]);

  // 新建便签或指定聚焦请求时，镜头平滑飞跃到目标便签并高亮
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

  // 当搜索词或标签筛选触发时，镜头自动平滑飞跃至第一张匹配便签的位置
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

  // 🎲 随机漫步：镜头平滑飞向墙上随机一张便签并高亮
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

  // 将屏幕点击坐标转换为墙面 (boardX, boardY) 坐标并在原处钉新便签
  const triggerPinAtScreenPoint = (clientX: number, clientY: number) => {
    if (!onDoubleClickWall || typeof window === "undefined") return;
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

  const updateDraggedCardTransform = (clientX: number, clientY: number) => {
    const state = interactionRef.current;
    if (state.mode !== "card" || !state.cardId) return;

    const dx = clientX - state.startX;
    const dy = clientY - state.startY;
    state.lastX = clientX;
    state.lastY = clientY;
    state.movedDistance = Math.hypot(dx, dy);

    if (!state.hasLifted && state.movedDistance > 2) {
      state.hasLifted = true;
      triggerHaptic(8);
      setDraggingCardId(state.cardId);
    }

    const el = cardElsRef.current[state.cardId];
    if (el) {
      const boardDx = dx / zoomRef.current;
      const boardDy = dy / zoomRef.current;
      const nextX = (state.cardBaseX || 0) + boardDx - 125;
      const nextY = (state.cardBaseY || 0) + boardDy - 110;
      el.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) rotate(0deg) scale(1.03)`;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      stopAnimation();
      setDraggingCardId(null);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      interactionRef.current = {
        ...interactionRef.current,
        mode: "pinch",
        initialPinchDist: Math.hypot(dx, dy),
        initialZoom: zoomRef.current,
      };
      return;
    }

    if (e.touches.length === 1 && interactionRef.current.mode !== "card") {
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
      const dist = Math.hypot(dx, dy);
      const scaleFactor = dist / state.initialPinchDist;
      const nextZoom = Math.min(
        1.45,
        Math.max(0.48, (state.initialZoom || 0.92) * scaleFactor)
      );
      applyCameraTransform(panRef.current.x, panRef.current.y, nextZoom, false);
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (state.mode === "card" && state.cardId) {
      updateDraggedCardTransform(touch.clientX, touch.clientY);
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
    } else if (state.mode === "pan") {
      // 检测移动端双击空白墙面直接钉便签
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
      setZoom(zoomRef.current);
    }
    interactionRef.current.mode = "none";
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || interactionRef.current.mode === "card") return;
    beginCanvasPan(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const state = interactionRef.current;
    if (state.mode === "none") return;

    if (state.mode === "card" && state.cardId) {
      updateDraggedCardTransform(e.clientX, e.clientY);
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
      const delta = -e.deltaY * 0.002;
      const nextZ = Math.min(1.45, Math.max(0.48, zoomRef.current + delta));
      applyCameraTransform(panRef.current.x, panRef.current.y, nextZ, true);
    } else {
      applyCameraTransform(
        panRef.current.x - e.deltaX,
        panRef.current.y - e.deltaY,
        zoomRef.current,
        false
      );
    }
  };

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
        backgroundSize: `${26 * zoomRef.current}px ${26 * zoomRef.current}px`,
      }}
      className="fixed inset-0 overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing wall-dot-matrix"
    >
      {/* 2D 便签画布原点置于屏幕正中央 */}
      <div
        ref={canvasRef}
        style={{
          transform: `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${zoomRef.current})`,
          transformOrigin: "0 0",
        }}
        className="absolute left-1/2 top-1/2 w-0 h-0 will-change-transform"
      >
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
          const isSpotlight = spotlightId === card.id;
          const activeDeltaX =
            isDraggingThis && interactionRef.current.cardId === card.id
              ? (interactionRef.current.lastX - interactionRef.current.startX) /
                zoom
              : 0;
          const activeDeltaY =
            isDraggingThis && interactionRef.current.cardId === card.id
              ? (interactionRef.current.lastY - interactionRef.current.startY) /
                zoom
              : 0;
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
              onTouchStart={(e) =>
                beginCardDrag(e, card.id, pos.x, pos.y, pos.rotation)
              }
              onMouseDown={(e) =>
                beginCardDrag(e, card.id, pos.x, pos.y, pos.rotation)
              }
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
                e.stopPropagation();
                if (interactionRef.current.movedDistance > 6) return;
                triggerHaptic(8);
                onSelectCard(card);
              }}
              className={`absolute w-[248px] sm:w-[268px] will-change-transform ${
                isArranging
                  ? "transition-transform duration-300 ease-out"
                  : "transition-opacity duration-150"
              } ${
                isDraggingThis ? "cursor-grabbing" : "cursor-grab"
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

              {/* 便签纸张主体（多彩纸色 + 微卷边立体阴影） */}
              {card.type === "ai_insight" && (
                <div
                  className={`rounded-xl ${paperStyle.bg} border ${
                    paperStyle.border
                  } p-4 pt-5 sticky-note-shadow ${
                    isDraggingThis
                      ? "shadow-2xl ring-2 ring-[#5C7457]/40"
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
                    {card.isPinned && (
                      <Pin className="w-3 h-3 text-[#C87D32] fill-current" />
                    )}
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

      {/* 左下角极简画布罗盘：回中心 / 🎲随机漫步 / 缩放 / 整理墙面 */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="fixed bottom-6 left-4 z-30 pb-safe flex items-center gap-1.5"
      >
        <div className="flex items-center bg-[#FFFDF8]/90 backdrop-blur-md border border-[#DED2BA] rounded-full p-1 shadow-md">
          <button
            type="button"
            onClick={handleRecenter}
            title="回到中心"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-[#4A3F33] hover:bg-[#EFE7D6] cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[#C87D32]" />
            <span>中心</span>
          </button>
          <button
            type="button"
            onClick={handleRandomRoam}
            title="随机漫步到一张便签"
            className="p-1.5 rounded-full text-[#6E6050] hover:bg-[#EFE7D6] cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5 text-[#5C7457]" />
          </button>
          {onOpenAiReview && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onOpenAiReview();
              }}
              title="AI 翻阅手账与周期回顾"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-[#3F563A] bg-[#E8EFE5] hover:bg-[#DCE8D6] cursor-pointer mx-0.5"
            >
              <Sparkles className="w-3 h-3 text-[#496044]" />
              <span>回顾</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              const nextZ = Math.max(
                0.5,
                Number((zoomRef.current - 0.15).toFixed(2))
              );
              applyCameraTransform(
                panRef.current.x,
                panRef.current.y,
                nextZ,
                true
              );
            }}
            title="缩小"
            className="p-1.5 rounded-full text-[#6E6050] hover:bg-[#EFE7D6] cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              const nextZ = Math.min(
                1.4,
                Number((zoomRef.current + 0.15).toFixed(2))
              );
              applyCameraTransform(
                panRef.current.x,
                panRef.current.y,
                nextZ,
                true
              );
            }}
            title="放大"
            className="p-1.5 rounded-full text-[#6E6050] hover:bg-[#EFE7D6] cursor-pointer"
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
            className="p-1.5 rounded-full text-[#6E6050] hover:bg-[#EFE7D6] cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
