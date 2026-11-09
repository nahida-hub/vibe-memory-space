"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { triggerHaptic } from "@/utils/storageDb";

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  title?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function ImageLightbox({
  images,
  currentIndex,
  title,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxProps) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    setIsZoomed(false);
    setDragOffset({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  if (!images.length) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1 || isZoomed) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const { x: dx, y: dy } = dragOffset;
    const now = Date.now();

    // 检测双击放大/还原（移动距离极小时）
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      if (now - lastTapRef.current < 280) {
        triggerHaptic(12);
        setIsZoomed((z) => !z);
        lastTapRef.current = 0;
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });
        touchStartRef.current = null;
        return;
      }
      lastTapRef.current = now;
    }

    if (!isZoomed) {
      // 下滑超过 90px 关闭大图（仿微信朋友圈/iOS相册手感）
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
        triggerHaptic(10);
        onClose();
        return;
      }

      // 左右滑动超过 45px 切换上一张/下一张
      if (images.length > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        triggerHaptic(10);
        if (dx < 0) {
          onNext();
        } else {
          onPrev();
        }
      }
    }

    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    touchStartRef.current = null;
  };

  const verticalDismissScale =
    !isZoomed && dragOffset.y > 0
      ? Math.max(0.82, 1 - dragOffset.y / 600)
      : 1;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#1B1611]/92 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-8 select-none overflow-hidden"
    >
      {/* 顶部关闭与页码栏 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between text-[#FBF6E9] pt-safe z-20"
      >
        <div className="font-serif-notebook text-sm sm:text-lg truncate pr-3">
          {title || "拍立得相册预览"}
          {images.length > 1 && (
            <span className="ml-2 text-xs font-mono text-[#D5C5B0] bg-white/10 px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setIsZoomed((z) => !z);
            }}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title={isZoomed ? "还原大小" : "放大细节"}
          >
            {isZoomed ? (
              <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
            title="关闭预览"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 主图触控手势展示区（支持左右划动切图、下滑关闭、双击放大） */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex items-center justify-center max-w-5xl w-full flex-1 my-2 touch-none"
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onPrev();
            }}
            className="hidden sm:flex absolute left-2 sm:-left-12 z-10 p-3 rounded-full bg-black/50 hover:bg-black/75 text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div
          style={{
            transform: `translate3d(${isZoomed ? 0 : dragOffset.x * 0.85}px, ${
              isZoomed ? 0 : Math.max(0, dragOffset.y * 0.85)
            }px, 0) scale(${isZoomed ? 1.85 : verticalDismissScale})`,
            transition: isDragging
              ? "none"
              : "transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          className="bg-[#FFFDF8] p-2.5 sm:p-4 rounded-2xl shadow-2xl max-h-[75vh] flex flex-col items-center"
        >
          <img
            src={images[currentIndex]}
            alt={title || "大图预览"}
            draggable={false}
            className="max-h-[68vh] w-auto object-contain rounded-xl pointer-events-none"
          />
        </div>

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onNext();
            }}
            className="hidden sm:flex absolute right-2 sm:-right-12 z-10 p-3 rounded-full bg-black/50 hover:bg-black/75 text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* 底部移动端触控指示条与操作提示 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col items-center gap-2 pb-safe z-20"
      >
        {images.length > 1 && (
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onPrev();
              }}
              className="p-1 text-white/85 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentIndex
                      ? "w-5 bg-[#E9C893]"
                      : "w-1.5 bg-white/35"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onNext();
              }}
              className="p-1 text-white/85 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        <p className="text-[11px] text-[#C7B8A3]/80 sm:hidden">
          左右划动切换 · 双击放大 · 下滑关闭
        </p>
      </div>
    </div>
  );
}
