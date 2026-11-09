"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Bot,
  Trash2,
  Pin,
  Quote,
  Copy,
  Check,
  Wand2,
  Pencil,
  ImageDown,
} from "lucide-react";
import { MemoryCard } from "@/types/memory";
import { exportCardAsPolaroidImage } from "@/utils/posterExport";
import { triggerHaptic } from "@/utils/storageDb";

interface AiInsightCardProps {
  card: MemoryCard;
  isRedistilling?: boolean;
  onSelect?: (card: MemoryCard) => void;
  onTagClick: (tag: string) => void;
  onEdit: (card: MemoryCard) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRedistill?: (id: string) => void;
}

export default function AiInsightCard({
  card,
  isRedistilling = false,
  onSelect,
  onTagClick,
  onEdit,
  onDelete,
  onTogglePin,
  onRedistill,
}: AiInsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleCopyQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(10);
    navigator.clipboard.writeText(card.summary || card.rawContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

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
    <article className="group relative rounded-2xl bg-[#FAF5E6] border border-[#E2D6BE] paper-shadow paper-shadow-hover overflow-hidden transition-all duration-300">
      {/* 左侧抹茶绿/茶褐书签装饰条 */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#6B8065] via-[#8A9A86] to-[#B7C2B0]" />

      {/* 顶部栏：卡片类型标识 + 模型来源 + 触屏防误触操作栏 */}
      <div className="px-4 sm:px-5 pt-3.5 pb-2 flex items-center justify-between gap-1.5 pl-5 sm:pl-6">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8EFE5] text-[#496044] border border-[#CEDBC9]">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>AI 灵感书签</span>
          </span>
          {card.aiModel && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#7D7162] bg-[#EFE8D5] px-2 py-0.5 rounded-md font-mono truncate max-w-[130px] sm:max-w-none">
              <Bot className="w-3 h-3 text-[#6B8065] shrink-0" />
              <span className="truncate">{card.aiModel}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:opacity-85 sm:group-hover:opacity-100 transition-opacity shrink-0">
          {onRedistill && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onRedistill(card.id);
              }}
              disabled={isRedistilling}
              title="调用 AI 大模型重新提炼 30 字金句与标签"
              className="inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-[11px] font-medium text-[#496044] bg-[#E8EFE5]/90 hover:bg-[#DAE6D5] disabled:opacity-50 transition-colors cursor-pointer mr-0.5"
            >
              <Wand2
                className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${
                  isRedistilling ? "animate-spin" : ""
                }`}
              />
              <span>{isRedistilling ? "提炼中" : "重炼"}</span>
            </button>
          )}
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
            title="生成便签分享图"
            className="p-2 sm:p-1.5 rounded-lg text-[#8C7E6D] hover:text-[#2C251E] active:bg-[#E5DAC3] hover:bg-[#EFE7D6] transition-colors cursor-pointer"
          >
            <ImageDown
              className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${
                isExporting ? "animate-bounce" : ""
              }`}
            />
          </button>
          <button
            type="button"
            onClick={handleCopyQuote}
            title="复制金句"
            className="p-2 sm:p-1.5 rounded-lg text-[#8C7E6D] hover:text-[#2C251E] active:bg-[#E5DAC3] hover:bg-[#EFE7D6] transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#5C7457]" />
            ) : (
              <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onEdit(card);
            }}
            title="编辑此卡片"
            className="p-2 sm:p-1.5 rounded-lg text-[#8C7E6D] hover:text-[#2C251E] active:bg-[#E5DAC3] hover:bg-[#EFE7D6] transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onTogglePin(card.id);
            }}
            title={card.isPinned ? "取消置顶" : "置顶灵感"}
            className={`p-2 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
              card.isPinned
                ? "text-[#C87D32] bg-[#F5E6CE]"
                : "text-[#8C7E6D] hover:text-[#2C251E] active:bg-[#E5DAC3] hover:bg-[#EFE7D6]"
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

      {/* 核心金句展示区（30字以内核心感悟） */}
      <div
        onClick={() => {
          triggerHaptic(6);
          if (onSelect) {
            onSelect(card);
          } else {
            setExpanded(!expanded);
          }
        }}
        className="px-5 sm:px-6 py-3 relative cursor-pointer"
      >
        <Quote className="w-6 h-6 text-[#D8CCB4] mb-1.5 -ml-1 rotate-180" />
        <blockquote
          className={`font-serif-notebook text-[18px] sm:text-[20px] leading-relaxed font-semibold text-[#2A231C] tracking-wide transition-opacity ${
            isRedistilling ? "opacity-45 animate-pulse" : ""
          }`}
        >
          {card.summary || card.rawContent.slice(0, 30)}
        </blockquote>
      </div>

      {/* 标签与日期栏 */}
      <div className="px-5 sm:px-6 pt-1 pb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                triggerHaptic(6);
                onTagClick(tag);
              }}
              className="text-xs px-2.5 py-1 sm:py-0.5 rounded-md bg-[#EFE8D5] hover:bg-[#E4DAC0] active:bg-[#D8CCB0] text-[#5C5144] transition-colors cursor-pointer"
            >
              #{tag}
            </button>
          ))}
        </div>
        <time className="text-[11px] text-[#948675] font-mono">
          {card.dateLabel}
        </time>
      </div>

      {/* 底部可折叠原对话记录（Accordion） */}
      <div className="border-t border-[#E6DCC6] bg-[#F4ECD9]/75">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(6);
            setExpanded(!expanded);
          }}
          className="w-full px-5 sm:px-6 py-3 sm:py-2.5 flex items-center justify-between text-xs font-medium text-[#6A5E50] hover:text-[#2C251E] active:bg-[#E8DEC6] hover:bg-[#EFE5CE]/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <span>
              {expanded ? "收起原始对话记录" : "展开原始 AI 对话 / 手记全文"}
            </span>
            <span className="text-[11px] text-[#9A8C7A]">
              ({card.rawContent.length} 字)
            </span>
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#7D7060]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#7D7060]" />
          )}
        </button>

        {expanded && (
          <div className="px-5 sm:px-6 py-4 bg-[#FBF7EC] border-t border-[#EAE0CA] text-sm text-[#433A31] whitespace-pre-wrap leading-7 notebook-ruled-lines max-h-96 overflow-y-auto">
            {card.rawContent}
          </div>
        )}
      </div>
    </article>
  );
}
