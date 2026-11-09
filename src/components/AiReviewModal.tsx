"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  BookOpen,
  Wand2,
  Pin,
  ImageDown,
  Check,
  Tag as TagIcon,
  Calendar,
  Star,
  Layers,
} from "lucide-react";
import { MemoryCard } from "@/types/memory";
import { AiConfig } from "@/types/aiConfig";
import {
  AiMemoryReviewResult,
  callAiMemoryReview,
} from "@/utils/aiClient";
import { exportCardAsPolaroidImage } from "@/utils/posterExport";
import { triggerHaptic } from "@/utils/storageDb";

interface AiReviewModalProps {
  isOpen: boolean;
  memories: MemoryCard[];
  popularTags: string[];
  aiConfig: AiConfig;
  onClose: () => void;
  onPinReviewToWall: (card: MemoryCard) => void;
}

type ReviewScope = "recent_7d" | "recent_30d" | "pinned" | "tag" | "all";

function formatTodayLabel(): string {
  const date = new Date();
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const w = days[date.getDay()];
  return `${y}.${m}.${d} · ${w}`;
}

export default function AiReviewModal({
  isOpen,
  memories,
  popularTags,
  aiConfig,
  onClose,
  onPinReviewToWall,
}: AiReviewModalProps) {
  const [scope, setScope] = useState<ReviewScope>("recent_7d");
  const [selectedTag, setSelectedTag] = useState<string>(
    popularTags[0] || "灵感"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewResult, setReviewResult] =
    useState<AiMemoryReviewResult | null>(null);
  const [hasPinned, setHasPinned] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const scopedCards = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (scope === "recent_7d") {
      const recent = memories.filter(
        (m) => now - new Date(m.createdAt).getTime() <= 7 * dayMs
      );
      return recent.length > 0 ? recent : memories.slice(0, 8);
    }
    if (scope === "recent_30d") {
      const recent = memories.filter(
        (m) => now - new Date(m.createdAt).getTime() <= 30 * dayMs
      );
      return recent.length > 0 ? recent : memories.slice(0, 15);
    }
    if (scope === "pinned") {
      return memories.filter((m) => m.isPinned || m.type === "milestone");
    }
    if (scope === "tag") {
      return memories.filter((m) => m.tags.includes(selectedTag));
    }
    return memories;
  }, [memories, scope, selectedTag]);

  const scopeLabel = useMemo(() => {
    if (scope === "recent_7d") return "最近 7 天手账";
    if (scope === "recent_30d") return "最近 30 天手账";
    if (scope === "pinned") return "置顶与高光时刻";
    if (scope === "tag") return `#${selectedTag} 专题`;
    return "全部手账记忆";
  }, [scope, selectedTag]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (scopedCards.length === 0 || isGenerating) return;
    triggerHaptic(10);
    setIsGenerating(true);
    setHasPinned(false);
    try {
      const res = await callAiMemoryReview(scopedCards, scopeLabel, aiConfig);
      setReviewResult(res);
    } finally {
      setIsGenerating(false);
    }
  };

  const buildReviewMemoryCard = (): MemoryCard | null => {
    if (!reviewResult) return null;
    const now = new Date();
    return {
      id: `mem-review-${Date.now()}`,
      type: "ai_insight",
      createdAt: now.toISOString(),
      dateLabel: formatTodayLabel(),
      paperColor: "sage",
      isPinned: true,
      summary: reviewResult.headline,
      rawContent: `【${scopeLabel} · AI 翻阅手账】\n\n${reviewResult.reflection}\n\n💡 灵感回响：${reviewResult.spark}`,
      tags: Array.from(
        new Set([...reviewResult.keywords.slice(0, 3), "AI手账回顾"])
      ),
      aiModel: reviewResult.modelUsed,
    };
  };

  const handlePinToWall = () => {
    const newCard = buildReviewMemoryCard();
    if (!newCard || hasPinned) return;
    triggerHaptic(12);
    setHasPinned(true);
    onPinReviewToWall(newCard);
    setTimeout(() => {
      onClose();
    }, 350);
  };

  const handleExportPoster = async () => {
    const newCard = buildReviewMemoryCard();
    if (!newCard || isExporting) return;
    triggerHaptic(10);
    setIsExporting(true);
    await exportCardAsPolaroidImage(newCard);
    setIsExporting(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#261E16]/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FBF6E9] border border-[#DFD2BA] paper-shadow overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* 顶栏 */}
        <div className="px-5 py-3.5 border-b border-[#E6DBC6] flex items-center justify-between bg-[#F3ECE0]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#496044] text-[#FBF6E9] flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-serif-notebook text-sm sm:text-base font-bold text-[#2C251E]">
                AI 翻阅手账 · 阶段洞察周报
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7E7060] hover:text-[#2C251E] hover:bg-[#EAE0CC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主体 */}
        <div className="p-5 overflow-y-auto space-y-4 pb-safe">
          {/* 范围选择 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#6E6050]">
              <span className="font-medium">选择要翻阅的便签范围：</span>
              <span className="font-mono text-[11px] text-[#496044] bg-[#E8EFE5] px-2 py-0.5 rounded-full">
                共匹配 {scopedCards.length} 张便签
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 p-1 rounded-2xl bg-[#EFE6D4] border border-[#E2D6BE]">
              {(
                [
                  { id: "recent_7d", label: "近 7 天", icon: Calendar },
                  { id: "recent_30d", label: "近 30 天", icon: Calendar },
                  { id: "pinned", label: "高光/置顶", icon: Star },
                  { id: "tag", label: "按 #标签", icon: TagIcon },
                  { id: "all", label: "全部", icon: Layers },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = scope === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      setScope(item.id);
                      if (item.id === "tag" && !selectedTag && popularTags[0]) {
                        setSelectedTag(popularTags[0]);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
                      active
                        ? "bg-[#FFFDF8] text-[#2C251E] shadow-2xs font-semibold"
                        : "text-[#6D6050]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-[#5C7457]" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 如果选择按标签，展示标签点选池 */}
            {scope === "tag" && popularTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {popularTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      setSelectedTag(t);
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                      selectedTag === t
                        ? "bg-[#C87D32] text-white font-medium"
                        : "bg-[#FFFDF8] border border-[#DFD2BA] text-[#66594B]"
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 触发按钮 */}
          <button
            type="button"
            disabled={scopedCards.length === 0 || isGenerating}
            onClick={handleGenerate}
            className="w-full py-3 rounded-2xl text-xs font-semibold bg-[#2C251E] hover:bg-[#3B3229] disabled:opacity-50 text-[#FBF6E9] flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Wand2
              className={`w-4 h-4 text-[#E8C589] ${
                isGenerating ? "animate-spin" : ""
              }`}
            />
            <span>
              {isGenerating
                ? "AI 正在翻阅你的手账便签..."
                : reviewResult
                ? `重新翻阅「${scopeLabel}」`
                : `开始翻阅「${scopeLabel}」(${scopedCards.length} 张)`}
            </span>
          </button>

          {/* 生成结果展示卡片 */}
          {reviewResult ? (
            <div className="rounded-2xl bg-[#ECF3E8] border border-[#C8D9C1] p-4 sm:p-5 space-y-3.5 sticky-note-shadow">
              <div className="flex items-center justify-between text-[11px] text-[#3D5239]">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{scopeLabel} · 洞察小结</span>
                </span>
                <span className="font-mono opacity-75">
                  {reviewResult.modelUsed}
                </span>
              </div>

              <h3 className="font-serif-notebook text-lg font-bold text-[#233120] leading-snug">
                “{reviewResult.headline}”
              </h3>

              <div className="p-3.5 rounded-xl bg-white/75 border border-[#D4E2CE] text-sm text-[#2F3B2C] whitespace-pre-wrap leading-7 notebook-ruled-lines">
                {reviewResult.reflection}
              </div>

              <div className="p-3 rounded-xl bg-[#DCE8D6]/80 border border-[#C2D6BA] text-xs text-[#2E422B] leading-relaxed">
                <span className="font-semibold">💡 灵感回响：</span>
                {reviewResult.spark}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {reviewResult.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-[#DCE8D6] text-[#3D5239] font-medium"
                  >
                    #{kw}
                  </span>
                ))}
              </div>

              {/* 底部动作：钉上便签墙 或 导出分享长图 */}
              <div className="pt-2 border-t border-[#CDDEC6] grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePinToWall}
                  disabled={hasPinned}
                  className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#3F563A] text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {hasPinned ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>已钉上墙</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5" />
                      <span>钉上便签墙保存</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportPoster}
                  disabled={isExporting}
                  className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#FFFDF8] text-[#3F563A] border border-[#B8CEB0] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ImageDown className="w-3.5 h-3.5" />
                  <span>{isExporting ? "生成中..." : "导出分享海报"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E6DBC6] space-y-2">
              <div className="text-xs font-medium text-[#5E5244]">
                即将翻阅的便签预览：
              </div>
              {scopedCards.length === 0 ? (
                <p className="text-xs text-[#9C8E7E] py-3 text-center">
                  该范围内暂无便签，请切换其他范围试试
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {scopedCards.slice(0, 6).map((c) => (
                    <div
                      key={c.id}
                      className="text-xs text-[#4A3F33] bg-[#F7F1E3] px-3 py-2 rounded-xl flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-medium">
                        {c.title || c.summary || c.rawContent.slice(0, 28)}
                      </span>
                      <span className="text-[10px] font-mono text-[#8E8070] shrink-0">
                        {c.dateLabel.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                  {scopedCards.length > 6 && (
                    <div className="text-[11px] text-[#8E8070] text-center pt-1">
                      还有 {scopedCards.length - 6} 张便签将一并纳入分析...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
