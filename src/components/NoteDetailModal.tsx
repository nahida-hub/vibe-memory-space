"use client";

import React, { useState, useMemo, useRef } from "react";
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
  Link2,
  Unlink,
} from "lucide-react";
import { MemoryCard, PaperColor, ThreadColor } from "@/types/memory";
import {
  PAPER_COLOR_STYLES,
  resolveCardPaperColor,
  THREAD_COLOR_LIST,
  THREAD_COLOR_STYLES,
} from "@/components/PinboardWall";
import { exportCardAsPolaroidImage } from "@/utils/posterExport";
import { triggerHaptic } from "@/utils/storageDb";
import { useSheetDismiss } from "@/utils/useSheetDismiss";

interface NoteDetailModalProps {
  card: MemoryCard | null;
  allMemories?: MemoryCard[];
  isRedistilling?: boolean;
  onClose: () => void;
  onEdit: (card: MemoryCard) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onChangePaperColor: (id: string, color: PaperColor) => void;
  onRedistill: (id: string) => void;
  onTagClick: (tag: string) => void;
  onOpenLightbox: (images: string[], startIndex: number, title?: string) => void;
  onSelectLinkedCard?: (card: MemoryCard) => void;
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
  onStartWallLinking?: (sourceId: string) => void;
}

export default function NoteDetailModal({
  card,
  allMemories = [],
  isRedistilling = false,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
  onChangePaperColor,
  onRedistill,
  onTagClick,
  onOpenLightbox,
  onSelectLinkedCard,
  onToggleLinkCard,
  onUpdatePairThreadColor,
  onStartWallLinking,
}: NoteDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);

  const cachedCardRef = useRef<MemoryCard | null>(card);
  if (card) {
    cachedCardRef.current = card;
  }
  const activeCard = card || cachedCardRef.current;

  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const {
    shouldRender,
    isClosing,
    requestClose,
    headerDragProps,
    createScrollBodyPullProps,
    sheetMotionStyle,
    backdropMotionStyle,
  } = useSheetDismiss({
    isOpen: Boolean(card),
    onClose,
  });

  const linkedCards = useMemo(() => {
    if (!activeCard) return [];
    const directSet = new Set(activeCard.linkedCardIds || []);
    return allMemories.filter(
      (m) =>
        m.id !== activeCard.id &&
        (directSet.has(m.id) ||
          (m.linkedCardIds || []).includes(activeCard.id))
    );
  }, [activeCard, allMemories]);

  if (!shouldRender || !activeCard) return null;

  const images = activeCard.images || [];
  const activePaperColor = resolveCardPaperColor(activeCard);
  const paperStyle = PAPER_COLOR_STYLES[activePaperColor];

  const handleCopy = () => {
    triggerHaptic(8);
    const text = activeCard.summary
      ? `${activeCard.summary}\n\n${activeCard.rawContent}`
      : activeCard.rawContent;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportImage = async () => {
    if (isExportingImg) return;
    triggerHaptic(10);
    setIsExportingImg(true);
    await exportCardAsPolaroidImage(activeCard);
    setIsExportingImg(false);
  };

  const handleDelete = () => {
    triggerHaptic(12);
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2600);
      return;
    }
    const targetId = activeCard.id;
    requestClose(() => {
      onDelete(targetId);
    });
  };

  return (
    <div
      onClick={() => requestClose()}
      style={backdropMotionStyle}
      className={`fixed inset-0 z-50 bg-[#261E16]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 ${
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={sheetMotionStyle}
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl ${
          paperStyle.bg
        } border ${
          paperStyle.border
        } paper-shadow overflow-hidden max-h-[88vh] flex flex-col transition-colors duration-200 ${
          isClosing ? "modal-sheet-exit" : "modal-sheet-enter"
        }`}
      >
        {/* 顶部按住下拉关闭手势区（包含下拉指示横条 + 顶栏） */}
        <div
          {...headerDragProps}
          className="border-b border-[#E6DBC6]/80 bg-black/[0.02] select-none touch-none cursor-grab active:cursor-grabbing"
        >
          {/* 顶部下拉横条指示器 */}
          <div className="pt-2.5 pb-1 flex flex-col items-center justify-center">
            <div className="w-10 h-1.5 rounded-full bg-[#B8A892]/65" />
          </div>

          {/* 顶部操作栏 */}
          <div className="px-5 pb-3 pt-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeCard.type === "ai_insight" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8EFE5] text-[#496044]">
                  <Sparkles className="w-3 h-3" />
                  灵感便签
                </span>
              )}
              {activeCard.type === "exhibition" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F7EBDC] text-[#9A6B3B]">
                  <Camera className="w-3 h-3" />
                  拍立得
                </span>
              )}
              {activeCard.type === "milestone" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#C87D32] text-white">
                  <Star className="w-3 h-3 fill-current" />
                  {activeCard.milestoneBadge || "高光时刻"}
                </span>
              )}
              <time className="text-xs font-mono text-[#8A7C6C]">
                {activeCard.dateLabel}
              </time>
            </div>

            <div className="flex items-center gap-0.5">
              {activeCard.type === "ai_insight" && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    onRedistill(activeCard.id);
                  }}
                  disabled={isRedistilling}
                  title="重新提炼金句"
                  className="p-2 rounded-full text-[#496044] hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <Wand2
                    className={`w-4 h-4 ${
                      isRedistilling ? "animate-spin" : ""
                    }`}
                  />
                </button>
              )}
              {onStartWallLinking && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    const id = activeCard.id;
                    requestClose(() => {
                      onStartWallLinking(id);
                    });
                  }}
                  title="在墙上与其他便签牵线关联"
                  className="p-2 rounded-full text-[#B84A39] hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleExportImage}
                disabled={isExportingImg}
                title="生成便签分享图（支持3种版式）"
                className="p-2 rounded-full text-[#7E7060] hover:bg-black/5 transition-colors cursor-pointer"
              >
                <ImageDown
                  className={`w-4 h-4 ${
                    isExportingImg ? "animate-bounce" : ""
                  }`}
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
                  onTogglePin(activeCard.id);
                }}
                title={activeCard.isPinned ? "取消置顶" : "置顶"}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  activeCard.isPinned
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
                  const target = activeCard;
                  requestClose(() => {
                    onEdit(target);
                  });
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
                onClick={() => requestClose()}
                className="p-2 rounded-full text-[#7E7060] hover:bg-black/5 transition-colors cursor-pointer ml-0.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 内容详情主体（支持滚动到顶时继续下拉关闭） */}
        <div
          ref={scrollBodyRef}
          {...createScrollBodyPullProps(scrollBodyRef)}
          className="p-5 sm:p-6 overflow-y-auto space-y-4 pb-safe"
        >
          {activeCard.title && (
            <h2 className="font-serif-notebook text-xl font-bold text-[#2C251E] leading-snug">
              {activeCard.title}
            </h2>
          )}

          {activeCard.summary && (
            <blockquote className="p-4 rounded-2xl bg-white/75 border border-[#E2D6BE] font-serif-notebook text-lg font-semibold text-[#2A231C] leading-relaxed">
              “{activeCard.summary}”
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
                  onClick={() => onOpenLightbox(images, idx, activeCard.title)}
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
          {activeCard.location && (
            <div className="inline-flex items-center gap-1.5 text-xs text-[#6B5B4B] bg-black/[0.04] px-3 py-1 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-[#C87D32]" />
              <span>{activeCard.location}</span>
            </div>
          )}

          {/* 原文内容 */}
          <div className="p-4 rounded-2xl bg-white/65 border border-[#EAE0CA] text-sm text-[#3F352B] whitespace-pre-wrap leading-7 notebook-ruled-lines">
            {activeCard.rawContent}
          </div>

          {/* 思维连线关联便签区 */}
          {(linkedCards.length > 0 || onStartWallLinking) && (
            <div className="p-3.5 rounded-2xl bg-black/[0.025] border border-dashed border-[#D8CBB5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#6E5D4B] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#B84A39]" />
                  <span>思维连线关联 ({linkedCards.length})</span>
                </span>
                {onStartWallLinking && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      const id = activeCard.id;
                      requestClose(() => {
                        onStartWallLinking(id);
                      });
                    }}
                    className="text-[11px] font-medium text-[#B84A39] hover:underline cursor-pointer"
                  >
                    + 在便签墙上牵线
                  </button>
                )}
              </div>

              {linkedCards.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {linkedCards.map((linked) => {
                    const pairColor: ThreadColor =
                      activeCard.linkedCardColors?.[linked.id] ||
                      linked.linkedCardColors?.[activeCard.id] ||
                      "crimson";
                    const nextColor =
                      THREAD_COLOR_LIST[
                        (THREAD_COLOR_LIST.indexOf(pairColor) + 1) %
                          THREAD_COLOR_LIST.length
                      ];
                    return (
                      <div
                        key={linked.id}
                        className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full bg-white/80 border border-[#DFD2BA] text-xs text-[#3F3428]"
                      >
                        {onUpdatePairThreadColor && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic(6);
                              onUpdatePairThreadColor(
                                activeCard.id,
                                linked.id,
                                nextColor
                              );
                            }}
                            title={`当前：${THREAD_COLOR_STYLES[pairColor].label}（点击切换线色）`}
                            className={`w-3.5 h-3.5 rounded-full border shrink-0 cursor-pointer ${THREAD_COLOR_STYLES[pairColor].dotBg}`}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(6);
                            onSelectLinkedCard?.(linked);
                          }}
                          className="truncate max-w-[175px] hover:text-[#B84A39] cursor-pointer"
                        >
                          {linked.title ||
                            linked.summary ||
                            linked.rawContent.slice(0, 16)}
                        </button>
                        {onToggleLinkCard && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic(8);
                              onToggleLinkCard(activeCard.id, linked.id);
                            }}
                            title="解开连线"
                            className="p-0.5 rounded-full text-[#9A8B7A] hover:text-red-600 cursor-pointer"
                          >
                            <Unlink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#8C7E6D]">
                  可将有内在联系的灵感、展览或高光时刻用彩色棉线串联在便签墙上。
                </p>
              )}
            </div>
          )}

          {/* 底部：标签 + 便签纸色快速切换圆点 */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex flex-wrap gap-1.5">
              {activeCard.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    onTagClick(tag);
                    requestClose();
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full ${paperStyle.tagBg} ${paperStyle.tagText} cursor-pointer`}
                >
                  #{tag}
                </button>
              ))}
            </div>

            {activeCard.type === "ai_insight" && (
              <div className="flex items-center gap-1.5">
                {(
                  ["cream", "butter", "sage", "blush", "kraft"] as PaperColor[]
                ).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      onChangePaperColor(activeCard.id, c);
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
