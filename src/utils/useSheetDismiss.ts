"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { triggerHaptic } from "@/utils/storageDb";

interface UseSheetDismissOptions {
  isOpen: boolean;
  onClose: () => void;
  exitDurationMs?: number;
}

export function useSheetDismiss({
  isOpen,
  onClose,
  exitDurationMs = 205,
}: UseSheetDismissOptions) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startY: number;
    startX: number;
    lastY: number;
    lastTime: number;
    vy: number;
    currentDragY: number;
    fromScrollBody: boolean;
    lockedDirection: "none" | "vertical" | "horizontal";
  }>({
    active: false,
    startY: 0,
    startX: 0,
    lastY: 0,
    lastTime: 0,
    vy: 0,
    currentDragY: 0,
    fromScrollBody: false,
    lockedDirection: "none",
  });

  // 同步外部 isOpen 状态（含 Android 返回键直接将 isOpen 置为 false 时的平滑退场动画）
  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setShouldRender(true);
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);
    } else if (shouldRender) {
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setDragY(0);
        setIsDragging(false);
      }, exitDurationMs);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [isOpen, shouldRender, exitDurationMs]);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (isClosing) return;
      setIsClosing(true);
      setIsDragging(false);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setDragY(0);
        onClose();
        afterClose?.();
      }, exitDurationMs);
    },
    [isClosing, onClose, exitDurationMs]
  );

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest("button, a, input, textarea, select, [data-no-sheet-drag]")
    );
  };

  const beginDrag = (
    clientX: number,
    clientY: number,
    fromScrollBody = false
  ) => {
    dragStateRef.current = {
      active: true,
      startY: clientY,
      startX: clientX,
      lastY: clientY,
      lastTime: performance.now(),
      vy: 0,
      currentDragY: 0,
      fromScrollBody,
      lockedDirection: "none",
    };
  };

  const moveDrag = useCallback((clientX: number, clientY: number): boolean => {
    const st = dragStateRef.current;
    if (!st.active) return false;

    const dy = clientY - st.startY;
    const dx = clientX - st.startX;

    if (st.lockedDirection === "none") {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return false;
      if (Math.abs(dx) > Math.abs(dy) * 1.15) {
        st.lockedDirection = "horizontal";
        st.active = false;
        return false;
      }
      if (st.fromScrollBody && dy <= 0) {
        // 在正文区向上滑动时交给原生滚动
        st.active = false;
        return false;
      }
      st.lockedDirection = "vertical";
      setIsDragging(true);
    }

    const now = performance.now();
    const dt = Math.max(1, now - st.lastTime);
    st.vy = (clientY - st.lastY) / dt;
    st.lastY = clientY;
    st.lastTime = now;

    // 向下拉动跟手，向上拉动施加高阻尼橡皮筋阻力
    const nextY = dy > 0 ? dy : dy * 0.12;
    st.currentDragY = Math.max(0, nextY);
    setDragY(st.currentDragY);
    return dy > 0;
  }, []);

  const endDrag = useCallback(() => {
    const st = dragStateRef.current;
    if (!st.active) return;
    st.active = false;
    setIsDragging(false);

    if (st.currentDragY > 82 || (st.currentDragY > 28 && st.vy > 0.48)) {
      triggerHaptic(8);
      requestClose();
    } else {
      setDragY(0);
    }
  }, [requestClose]);

  // 桌面端鼠标按住顶栏下拉支持
  useEffect(() => {
    if (!shouldRender) return;
    const onWinMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.active) return;
      moveDrag(e.clientX, e.clientY);
    };
    const onWinMouseUp = () => {
      if (!dragStateRef.current.active) return;
      endDrag();
    };
    window.addEventListener("mousemove", onWinMouseMove);
    window.addEventListener("mouseup", onWinMouseUp);
    return () => {
      window.removeEventListener("mousemove", onWinMouseMove);
      window.removeEventListener("mouseup", onWinMouseUp);
    };
  }, [shouldRender, moveDrag, endDrag]);

  // 绑定在弹窗顶部拖拽横条与顶栏上的手势属性
  const headerDragProps = {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || isInteractiveTarget(e.target)) return;
      beginDrag(e.touches[0].clientX, e.touches[0].clientY, false);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    },
    onTouchEnd: () => {
      endDrag();
    },
    onTouchCancel: () => {
      endDrag();
    },
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0 || isInteractiveTarget(e.target)) return;
      beginDrag(e.clientX, e.clientY, false);
    },
  };

  // 绑定在可滚动内容区上的辅助下拉关闭（当滚动条已在最顶部且继续往下拉时，顺滑接管为下拉关闭）
  const createScrollBodyPullProps = (
    scrollRef: React.RefObject<HTMLElement | null>
  ) => ({
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || isInteractiveTarget(e.target)) return;
      const el = scrollRef.current;
      if (el && el.scrollTop <= 1) {
        beginDrag(e.touches[0].clientX, e.touches[0].clientY, true);
      }
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || !dragStateRef.current.active) return;
      const el = scrollRef.current;
      if (el && el.scrollTop > 2 && dragStateRef.current.currentDragY === 0) {
        dragStateRef.current.active = false;
        return;
      }
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    },
    onTouchEnd: () => {
      endDrag();
    },
    onTouchCancel: () => {
      endDrag();
    },
  });

  const sheetMotionStyle: React.CSSProperties = {
    ["--sheet-drag-y" as any]: `${dragY}px`,
    ...(dragY > 0 || isDragging
      ? {
          transform: `translate3d(0, ${dragY}px, 0)`,
          transition: isDragging
            ? "none"
            : "transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
        }
      : {}),
  };

  const backdropMotionStyle: React.CSSProperties =
    dragY > 0
      ? {
          opacity: Math.max(0.2, 1 - dragY / 380),
          transition: isDragging ? "none" : "opacity 0.24s ease",
        }
      : {};

  return {
    shouldRender,
    isClosing,
    dragY,
    isDragging,
    requestClose,
    headerDragProps,
    createScrollBodyPullProps,
    sheetMotionStyle,
    backdropMotionStyle,
  };
}
