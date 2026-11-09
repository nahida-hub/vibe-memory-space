"use client";

import React, { useState } from "react";
import {
  Award,
  Star,
  Trash2,
  Pin,
  Sparkles,
  Pencil,
  ImageDown,
} from "lucide-react";
import { MemoryCard } from "@/types/memory";
import { exportCardAsPolaroidImage } from "@/utils/posterExport";
import { triggerHaptic } from "@/utils/storageDb";

interface MilestoneCardProps {
  card: MemoryCard;
  onSelect?: (card: MemoryCard) => void;
  onTagClick: (tag: string) => void;
  onEdit: (card: MemoryCard) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onOpenLightbox: (images: string[], startIndex: number, title?: string) => void;
}

export default function MilestoneCard({
  card,
  onSelect,
  onTagClick,
  onEdit,
  onDelete,
  onTogglePin,
  onOpenLightbox,
}: MilestoneCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const images = card.images || [];

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(12);
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2600);
      return;
    }
    onDelete(card.id);
  };

  return (
    <article className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-[#DDA14B] via-[#E8C589] to-[#C87D32] paper-shadow paper-shadow-hover transition-all duration-300">
      <div className="rounded-[15px] bg-gradient-to-br from-[#FFF9EB] via-[#FFFDF8] to-[#FBF1DA] p-4 sm:p-5 relative overflow-hidden">
        {/* 背景右上角柔和星芒水印 */}
        <div className="pointer-events-none absolute -right-6 -top-6 w-28 h-28 rounded-full bg-gradient-to-br from-[#F4D08F]/35 to-transparent blur-md" />

        {/* 顶部高光徽章与操作栏 */}
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#C87D32] to-[#DDA046] text-[#FFFDF9] shadow-xs">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{card.milestoneBadge || "人生高光时刻"}</span>
            </span>
            {card.isPinned && (
              <span className="text-[11px] text-[#B36B22] bg-[#F7E6C4] px-2 py-0.5 rounded-full font-medium">
                已置顶
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                if (isExporting) return;
                triggerHaptic(10);
                setIsExporting(true);
                await exportCardAsPolaroidImage(card);
                setIsExporting(false);
              }}
              title="生成高光分享图"
              className="p-2 sm:p-1.5 rounded-lg text-[#9A8368] hover:text-[#2C251E] active:bg-[#EDD8B4] hover:bg-[#F5EBD6] transition-colors cursor-pointer"
            >
              <ImageDown
                className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${
                  isExporting ? "animate-bounce" : ""
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onEdit(card);
              }}
              title="编辑此大事记"
              className="p-2 sm:p-1.5 rounded-lg text-[#9A8368] hover:text-[#2C251E] active:bg-[#EDD8B4] hover:bg-[#F5EBD6] transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onTogglePin(card.id);
              }}
              title={card.isPinned ? "取消置顶" : "置顶大事记"}
              className={`p-2 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                card.isPinned
                  ? "text-[#B36B22] bg-[#F5E1B9]"
                  : "text-[#9A8368] hover:text-[#2C251E] active:bg-[#EDD8B4] hover:bg-[#F5EBD6]"
              }`}
            >
              <Pin className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              title={confirmDelete ? "再次点击确认删除" : "删除卡片"}
              className={`rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                confirmDelete
                  ? "px-2 py-1 bg-red-600 text-white text-[11px] font-semibold"
                  : "p-2 sm:p-1.5 text-[#9A8368] hover:text-red-700 hover:bg-red-50/70"
              }`}
            >
              <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              {confirmDelete && <span>删?</span>}
            </button>
          </div>
        </div>

        {/* 大事记标题 */}
        {card.title && (
          <h3 className="font-serif-notebook text-lg sm:text-xl font-bold text-[#2B2117] leading-snug mb-2 flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-[#C87D32] shrink-0 mt-1" />
            <span>{card.title}</span>
          </h3>
        )}

        {/* 配图（如有） */}
        {images.length > 0 && (
          <div
            onClick={() => {
              triggerHaptic(8);
              onOpenLightbox(images, 0, card.title);
            }}
            className="my-3 rounded-xl overflow-hidden border border-[#EBD8B7] aspect-[16/9] cursor-zoom-in relative group/img"
          >
            <img
              src={images[0]}
              alt={card.title || "高光时刻配图"}
              loading="lazy"
              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        {/* 故事描述 */}
        <p
          onClick={() => {
            if (onSelect) {
              triggerHaptic(6);
              onSelect(card);
            }
          }}
          className="text-[15px] text-[#3F3428] leading-relaxed whitespace-pre-wrap my-2 cursor-pointer"
        >
          {card.rawContent}
        </p>

        {/* 底部火漆印章感日期与标签 */}
        <div className="mt-4 pt-3 border-t border-[#ECDCC0] flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  onTagClick(tag);
                }}
                className="text-xs px-2.5 py-1 sm:py-0.5 rounded-md bg-[#F6E8CC] hover:bg-[#EDD8AE] active:bg-[#E3C896] text-[#7A5121] font-medium transition-colors cursor-pointer"
              >
                #{tag}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#917352] font-mono">
            <Award className="w-3.5 h-3.5 text-[#C87D32]" />
            <time>{card.dateLabel}</time>
          </div>
        </div>
      </div>
    </article>
  );
}
