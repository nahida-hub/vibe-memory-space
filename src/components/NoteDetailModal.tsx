"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Camera,
  Star,
  MapPin,
  Pin,
  Pencil,
  Trash2,
  Copy,
  Check,
  Wand2,
  ImageDown,
} from "lucide-react";
import { MemoryCard, PaperColor } from "@/types/memory";
import {
  PAPER_COLOR_STYLES,
  resolveCardPaperColor,
} from "@/components/PinboardWall";
import { exportCardAsPolaroidImage } from "@/utils/posterExport";
import { triggerHaptic } from "@/utils/storageDb";

interface NoteDetailModalProps {
  card: MemoryCard | null;
  isRedistilling?: boolean;
  onClose: () => void;
  onEdit: (card: MemoryCard) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onChangePaperColor: (id: string, color: PaperColor) => void;
  onRedistill: (id: string) => void;
  onTagClick: (tag: string) => void;
  onOpenLightbox: (images: string[], startIndex: number, title?: string) => void;
}

export default function NoteDetailModal({
  card,
  isRedistilling = false,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
  onChangePaperColor,
  onRedistill,
  onTagClick,
  onOpenLightbox,
}: NoteDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);

  if (!card) return null;

  const images = card.images || [];
  const activePaperColor = resolveCardPaperColor(card);
  const paperStyle = PAPER_COLOR_STYLES[activePaperColor];

  const handleCopy = () => {
    triggerHaptic(8);
    const text = card.summary
      ? `${card.summary}\n\n${card.rawContent}`
      : card.rawContent;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportImage = async () => {
    if (isExportingImg) return;
    triggerHaptic(10);
    setIsExportingImg(true);
    await exportCardAsPolaroidImage(card);
    setIsExportingImg(false);
  };

  const handleDelete = () => {
    triggerHaptic(12);
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2600);
      return;
    }
    onDelete(card.id);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#261E16]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl ${paperStyle.bg} border ${paperStyle.border} paper-shadow overflow-hidden max-h-[88vh] flex flex-col transition-colors duration-200`}
      >
        {/* 顶部操作栏 */}
        <div className="px-5 py-3.5 border-b border-[#E6DBC6]/80 flex items-center justify-between bg-black/[0.02]">
          <div className="flex items-center gap-2">
            {card.type === "ai_insight" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8EFE5] text-[#496044]">
                <Sparkles className="w-3 h-3" />
                灵感便签
              </span>
            )}
            {card.type === "exhibition" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F7EBDC] text-[#9A6B3B]">
                <Camera className="w-3 h-3" />
                拍立得
              </span>
            )}
            {card.type === "milestone" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#C87D32] text-white">
                <Star className="w-3 h-3 fill-current" />
                {card.milestoneBadge || "高光时刻"}
              </span>
            )}
            <time className="text-xs font-mono text-[#8A7C6C]">
              {card.dateLabel}
            </time>
          </div>

          <div className="flex items-center gap-0.5">
            {card.type === "ai_insight" && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  onRedistill(card.id);
                }}
                disabled={isRedistilling}
                title="重新提炼金句"
                className="p-2 rounded-full text-[#496044] hover:bg-black/5 transition-colors cursor-pointer"
              >
                <Wand2
                  className={`w-4 h-4 ${isRedistilling ? "animate-spin" : ""}`}
                />
              </button>
            )}
            <button
              type="button"
              onClick={handleExportImage}
              disabled={isExportingImg}
              title="生成便签分享图"
              className="p-2 rounded-full text-[#7E7060] hover:bg-black/5 transition-colors cursor-pointer"
            >
              <ImageDown
                className={`w-4 h-4 ${isExportingImg ? "animate-bounce" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              title="复制文字"
              className="p-2 rounded-full text-[#7E7060] hover:bg-black/5 transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 text-[#5C7457]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onTogglePin(card.id);
              }}
              title={card.isPinned ? "取消置顶" : "置顶"}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                card.isPinned
                  ? "text-[#C87D32] bg-[#F5E6CE]"
                  : "text-[#7E7060] hover:bg-black/5"
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onClose();
                onEdit(card);
              }}
              title="编辑"
              className="p-2 rounded-full text-[#7E7060] hover:bg-black/5 transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                confirmDelete
                  ? "px-2.5 py-1 bg-red-600 text-white text-xs font-medium"
                  : "p-2 text-[#7E7060] hover:text-red-700 hover:bg-red-50"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete && <span>确认删</span>}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[#7E7060] hover:bg-black/5 transition-colors cursor-pointer ml-0.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容详情主体 */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 pb-safe">
          {card.title && (
            <h2 className="font-serif-notebook text-xl font-bold text-[#2C251E] leading-snug">
              {card.title}
            </h2>
          )}

          {card.summary && (
            <blockquote className="p-4 rounded-2xl bg-white/75 border border-[#E2D6BE] font-serif-notebook text-lg font-semibold text-[#2A231C] leading-relaxed">
              “{card.summary}”
            </blockquote>
          )}

          {/* 图片九宫格/画廊 */}
          {images.length > 0 && (
            <div
              className={`grid gap-2 ${
                images.length === 1
                  ? "grid-cols-1"
                  : images.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
              }`}
            >
              {images.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenLightbox(images, idx, card.title)}
                  className={`rounded-xl overflow-hidden border border-[#E2D6BE] bg-[#F2ECE1] cursor-zoom-in ${
                    images.length === 1 ? "aspect-[4/3]" : "aspect-square"
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 地点坐标 */}
          {card.location && (
            <div className="inline-flex items-center gap-1.5 text-xs text-[#6B5B4B] bg-black/[0.04] px-3 py-1 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-[#C87D32]" />
              <span>{card.location}</span>
            </div>
          )}

          {/* 原文内容 */}
          <div className="p-4 rounded-2xl bg-white/65 border border-[#EAE0CA] text-sm text-[#3F352B] whitespace-pre-wrap leading-7 notebook-ruled-lines">
            {card.rawContent}
          </div>

          {/* 底部：标签 + 便签纸色快速切换圆点 */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex flex-wrap gap-1.5">
              {card.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    onTagClick(tag);
                    onClose();
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full ${paperStyle.tagBg} ${paperStyle.tagText} cursor-pointer`}
                >
                  #{tag}
                </button>
              ))}
            </div>

            {card.type === "ai_insight" && (
              <div className="flex items-center gap-1.5">
                {(
                  ["cream", "butter", "sage", "blush", "kraft"] as PaperColor[]
                ).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      onChangePaperColor(card.id, c);
                    }}
                    title={PAPER_COLOR_STYLES[c].label}
                    className={`w-5 h-5 rounded-full border ${
                      PAPER_COLOR_STYLES[c].dot
                    } transition-transform cursor-pointer ${
                      activePaperColor === c
                        ? "scale-125 ring-2 ring-[#2C251E]/40"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
