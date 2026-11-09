"use client";

import React, { useState } from "react";
import {
  MapPin,
  Camera,
  Trash2,
  Pin,
  Maximize2,
  Pencil,
  ImageDown,
} from "lucide-react";
import { MemoryCard } from "@/types/memory";
import { exportCardAsPolaroidImage } from "@/utils/posterExport";
import { triggerHaptic } from "@/utils/storageDb";

interface ExhibitionCardProps {
  card: MemoryCard;
  onSelect?: (card: MemoryCard) => void;
  onTagClick: (tag: string) => void;
  onEdit: (card: MemoryCard) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onOpenLightbox: (images: string[], startIndex: number, title?: string) => void;
}

const TAPE_STYLES: Record<string, string> = {
  amber: "bg-[#E9C893]/75 border-[#DAB376]/60 -rotate-2",
  sage: "bg-[#B8CBB2]/75 border-[#9FB698]/60 rotate-1",
  rose: "bg-[#E6B8B0]/70 border-[#D49F96]/60 -rotate-1",
  coffee: "bg-[#C7B69E]/75 border-[#B29E82]/60 rotate-2",
};

export default function ExhibitionCard({
  card,
  onSelect,
  onTagClick,
  onEdit,
  onDelete,
  onTogglePin,
  onOpenLightbox,
}: ExhibitionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const images = card.images || [];
  const tapeClass = TAPE_STYLES[card.tapeStyle || "amber"] || TAPE_STYLES.amber;

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
    <article className="group relative pt-3">
      {/* 顶部半透明手账和纸胶带装饰 */}
      <div
        className={`w-28 h-6 mx-auto mb-[-12px] relative z-10 border shadow-xs backdrop-blur-[1px] ${tapeClass}`}
        style={{
          clipPath:
            "polygon(3% 0%, 97% 2%, 100% 30%, 96% 65%, 100% 100%, 2% 98%, 0% 68%, 4% 35%)",
        }}
      />

      {/* 拍立得相纸主体 */}
      <div className="rounded-2xl bg-[#FFFDF8] p-3.5 sm:p-4 polaroid-shadow paper-shadow-hover transition-all duration-300">
        {/* 相片展示区（自适应 1~9 张图） */}
        {images.length > 0 && (
          <div className="relative rounded-xl overflow-hidden bg-[#F2ECE1] border border-[#EBE2D1] mb-3.5">
            {images.length === 1 && (
              <div
                onClick={() => {
                  triggerHaptic(8);
                  onOpenLightbox(images, 0, card.title);
                }}
                className="relative aspect-[4/3] w-full overflow-hidden cursor-zoom-in group/img"
              >
                <img
                  src={images[0]}
                  alt={card.title || "逛展现场"}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover/img:scale-[1.03] transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity flex items-end justify-end p-2.5 sm:p-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/55 text-white text-[11px] sm:text-xs backdrop-blur-xs">
                    <Maximize2 className="w-3 h-3" />
                    <span>看大图</span>
                  </span>
                </div>
              </div>
            )}

            {images.length === 2 && (
              <div className="grid grid-cols-2 gap-1.5 aspect-[16/10]">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      triggerHaptic(8);
                      onOpenLightbox(images, idx, card.title);
                    }}
                    className="relative w-full h-full overflow-hidden cursor-zoom-in group/img"
                  >
                    <img
                      src={img}
                      alt={`${card.title || "现场"} - ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {images.length >= 3 && (
              <div className="grid grid-cols-3 gap-1.5">
                {/* 主图占满上方 */}
                <div
                  onClick={() => {
                    triggerHaptic(8);
                    onOpenLightbox(images, 0, card.title);
                  }}
                  className="col-span-3 aspect-[16/10] relative overflow-hidden cursor-zoom-in group/img"
                >
                  <img
                    src={images[0]}
                    alt={card.title || "主图"}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/55 text-white text-[11px] backdrop-blur-xs flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    <span>共 {images.length} 张</span>
                  </span>
                </div>
                {/* 下方缩略图流 */}
                {images.slice(1, 4).map((img, idx) => {
                  const actualIndex = idx + 1;
                  const remaining = images.length - 4;
                  return (
                    <div
                      key={actualIndex}
                      onClick={() => {
                        triggerHaptic(8);
                        onOpenLightbox(images, actualIndex, card.title);
                      }}
                      className="relative aspect-square overflow-hidden cursor-zoom-in group/img"
                    >
                      <img
                        src={img}
                        alt={`配图 ${actualIndex + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                      />
                      {idx === 2 && remaining > 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium text-sm">
                          +{remaining}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 拍立得白边手写感文字区 */}
        <div className="px-1.5">
          {/* 标题与右上操作区 */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9A6B3B] bg-[#F7EBDC] px-2 py-0.5 rounded-full mb-1">
                <Camera className="w-3 h-3" />
                <span>现场拍立得</span>
              </span>
              {card.title && (
                <h3 className="font-serif-notebook text-lg font-semibold text-[#2A231C] leading-snug">
                  {card.title}
                </h3>
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
                title="生成拍立得分享图"
                className="p-2 sm:p-1.5 rounded-lg text-[#8C7E6D] hover:text-[#2C251E] active:bg-[#EAE0CE] hover:bg-[#F3ECE0] transition-colors cursor-pointer"
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
                title="编辑此卡片"
                className="p-2 sm:p-1.5 rounded-lg text-[#8C7E6D] hover:text-[#2C251E] active:bg-[#EAE0CE] hover:bg-[#F3ECE0] transition-colors cursor-pointer"
              >
                <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onTogglePin(card.id);
                }}
                title={card.isPinned ? "取消置顶" : "置顶卡片"}
                className={`p-2 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                  card.isPinned
                    ? "text-[#C87D32] bg-[#F5E6CE]"
                    : "text-[#8C7E6D] hover:text-[#2C251E] active:bg-[#EAE0CE] hover:bg-[#F3ECE0]"
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
                    : "p-2 sm:p-1.5 text-[#8C7E6D] hover:text-red-700 hover:bg-red-50/70"
                }`}
              >
                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                {confirmDelete && <span>删?</span>}
              </button>
            </div>
          </div>

          {/* 现场感受正文 */}
          <p
            onClick={() => {
              if (onSelect) {
                triggerHaptic(6);
                onSelect(card);
              }
            }}
            className="text-sm text-[#4A4036] leading-relaxed whitespace-pre-wrap my-2 cursor-pointer"
          >
            {card.rawContent}
          </p>

          {/* 地点坐标与时间印记 */}
          <div className="mt-3 pt-2.5 border-t border-dashed border-[#E6DDD0] flex items-center justify-between text-xs text-[#7D7061] gap-2 flex-wrap">
            {card.location ? (
              <span className="inline-flex items-center gap-1 text-[#6B5B4B] font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#C87D32] shrink-0" />
                <span>{card.location}</span>
              </span>
            ) : (
              <span className="text-[#9E9080]">随手抓拍</span>
            )}
            <time className="font-mono text-[11px] text-[#948675]">
              {card.dateLabel}
            </time>
          </div>

          {/* 标签栏 */}
          {card.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {card.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    onTagClick(tag);
                  }}
                  className="text-xs px-2.5 py-1 sm:py-0.5 rounded-md bg-[#F4EFE4] hover:bg-[#EAE1CE] active:bg-[#DFD2BA] text-[#66594B] transition-colors cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
