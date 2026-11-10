"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  Camera,
  Star,
  MapPin,
  Tag,
  Upload,
  Wand2,
  Check,
  Calendar,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { CardType, MemoryCard, PaperColor } from "@/types/memory";
import { AiConfig } from "@/types/aiConfig";
import { callAiDistill, callAiPolishAndTag } from "@/utils/aiClient";
import { PAPER_COLOR_STYLES } from "@/components/PinboardWall";
import { compressImageForGallery, triggerHaptic } from "@/utils/storageDb";
import { useSheetDismiss } from "@/utils/useSheetDismiss";

const CAPTURE_DRAFT_STORAGE_KEY = "vibe_memory_capture_draft_v1";

interface CaptureDraft {
  cardType: CardType;
  rawContent: string;
  summary: string;
  title: string;
  location: string;
  dateLabel: string;
  isoDateInput: string;
  milestoneBadge: string;
  tapeStyle: "amber" | "sage" | "rose" | "coffee";
  paperColor: PaperColor;
  tagsInput: string;
  images: string[];
}

interface QuickCaptureModalProps {
  isOpen: boolean;
  initialType?: CardType;
  editingCard?: MemoryCard | null;
  pendingBoardPos?: { x: number; y: number } | null;
  popularTags?: string[];
  aiConfig: AiConfig;
  onClose: () => void;
  onSaveCard: (card: MemoryCard, isEdit: boolean) => void;
}

export function formatDateLabel(date: Date): string {
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const w = days[date.getDay()];
  return `${y}.${m}.${d} · ${w}`;
}

function toIsoDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DEFAULT_SUGGESTED_TAGS = [
  "灵感",
  "思考",
  "看展",
  "日常",
  "旅行",
  "读书",
  "小确幸",
];

export default function QuickCaptureModal({
  isOpen,
  initialType = "ai_insight",
  editingCard = null,
  pendingBoardPos = null,
  popularTags = [],
  aiConfig,
  onClose,
  onSaveCard,
}: QuickCaptureModalProps) {
  const [cardType, setCardType] = useState<CardType>(initialType);
  const [rawContent, setRawContent] = useState("");
  const [prePolishContent, setPrePolishContent] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [isoDateInput, setIsoDateInput] = useState("");
  const [milestoneBadge, setMilestoneBadge] = useState("高光时刻");
  const [tapeStyle, setTapeStyle] = useState<
    "amber" | "sage" | "rose" | "coffee"
  >("amber");
  const [paperColor, setPaperColor] = useState<PaperColor>("cream");
  const [tagsInput, setTagsInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDistilling, setIsDistilling] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const formScrollRef = useRef<HTMLFormElement>(null);

  const {
    shouldRender,
    isClosing,
    requestClose,
    headerDragProps,
    createScrollBodyPullProps,
    sheetMotionStyle,
    backdropMotionStyle,
  } = useSheetDismiss({
    isOpen,
    onClose,
  });

  // 打开弹窗时初始化：若是编辑模式则载入原卡片；若是新建模式则优先检查是否有未保存草稿
  useEffect(() => {
    if (!isOpen) return;
    setPrePolishContent(null);

    if (editingCard) {
      setRestoredFromDraft(false);
      setCardType(editingCard.type);
      setRawContent(editingCard.rawContent || "");
      setSummary(editingCard.summary || "");
      setTitle(editingCard.title || "");
      setLocation(editingCard.location || "");
      const parsedDate = editingCard.createdAt
        ? new Date(editingCard.createdAt)
        : new Date();
      setDateLabel(
        editingCard.dateLabel || formatDateLabel(parsedDate)
      );
      setIsoDateInput(
        !isNaN(parsedDate.getTime())
          ? toIsoDateInputValue(parsedDate)
          : toIsoDateInputValue(new Date())
      );
      setMilestoneBadge(editingCard.milestoneBadge || "高光时刻");
      setTapeStyle(editingCard.tapeStyle || "amber");
      setPaperColor(editingCard.paperColor || "cream");
      setTagsInput((editingCard.tags || []).join(" "));
      setImages(editingCard.images || []);
      return;
    }

    // 检查是否存在未保存的新建草稿
    try {
      const savedDraftRaw = localStorage.getItem(CAPTURE_DRAFT_STORAGE_KEY);
      if (savedDraftRaw) {
        const draft: Partial<CaptureDraft> = JSON.parse(savedDraftRaw);
        const hasMeaningfulContent = Boolean(
          draft.rawContent?.trim() ||
            draft.title?.trim() ||
            draft.summary?.trim() ||
            (Array.isArray(draft.images) && draft.images.length > 0)
        );
        if (hasMeaningfulContent) {
          const now = new Date();
          setCardType(draft.cardType || initialType);
          setRawContent(draft.rawContent || "");
          setSummary(draft.summary || "");
          setTitle(draft.title || "");
          setLocation(draft.location || "");
          setDateLabel(draft.dateLabel || formatDateLabel(now));
          setIsoDateInput(draft.isoDateInput || toIsoDateInputValue(now));
          setMilestoneBadge(draft.milestoneBadge || "高光时刻");
          setTapeStyle(draft.tapeStyle || "amber");
          setPaperColor(draft.paperColor || "cream");
          setTagsInput(draft.tagsInput || "");
          setImages(Array.isArray(draft.images) ? draft.images : []);
          setRestoredFromDraft(true);
          return;
        }
      }
    } catch {
      // ignore
    }

    const now = new Date();
    const colors: PaperColor[] = ["cream", "butter", "sage", "blush", "kraft"];
    setRestoredFromDraft(false);
    setCardType(initialType);
    setRawContent("");
    setSummary("");
    setTitle("");
    setLocation("");
    setDateLabel(formatDateLabel(now));
    setIsoDateInput(toIsoDateInputValue(now));
    setMilestoneBadge("高光时刻");
    setTapeStyle("amber");
    setPaperColor(colors[Math.floor(Math.random() * colors.length)]);
    setTagsInput("");
    setImages([]);
  }, [isOpen, initialType, editingCard]);

  // 新建模式下实时自动暂存草稿（防误触遮罩层或返回键导致内容丢失）
  useEffect(() => {
    if (!isOpen || editingCard) return;

    const hasAnyContent = Boolean(
      rawContent.trim() ||
        title.trim() ||
        summary.trim() ||
        location.trim() ||
        tagsInput.trim() ||
        images.length > 0
    );

    try {
      if (!hasAnyContent) {
        localStorage.removeItem(CAPTURE_DRAFT_STORAGE_KEY);
        return;
      }
      const draft: CaptureDraft = {
        cardType,
        rawContent,
        summary,
        title,
        location,
        dateLabel,
        isoDateInput,
        milestoneBadge,
        tapeStyle,
        paperColor,
        tagsInput,
        // 避免过多大图撑爆 localStorage 草稿，草稿中最多暂存前 4 张图
        images: images.slice(0, 4),
      };
      localStorage.setItem(CAPTURE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // 若包含图片超出 localStorage 限额，则仅暂存文本草稿
      try {
        const textOnlyDraft: CaptureDraft = {
          cardType,
          rawContent,
          summary,
          title,
          location,
          dateLabel,
          isoDateInput,
          milestoneBadge,
          tapeStyle,
          paperColor,
          tagsInput,
          images: [],
        };
        localStorage.setItem(
          CAPTURE_DRAFT_STORAGE_KEY,
          JSON.stringify(textOnlyDraft)
        );
      } catch {
        // ignore
      }
    }
  }, [
    isOpen,
    editingCard,
    cardType,
    rawContent,
    summary,
    title,
    location,
    dateLabel,
    isoDateInput,
    milestoneBadge,
    tapeStyle,
    paperColor,
    tagsInput,
    images,
  ]);

  const candidateTags = useMemo(() => {
    return Array.from(
      new Set([...popularTags, ...DEFAULT_SUGGESTED_TAGS])
    ).slice(0, 10);
  }, [popularTags]);

  const currentTagList = useMemo(() => {
    return tagsInput
      .split(/[,，\s#]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }, [tagsInput]);

  if (!shouldRender) return null;

  const handleClearDraft = () => {
    triggerHaptic(8);
    try {
      localStorage.removeItem(CAPTURE_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    const now = new Date();
    setRestoredFromDraft(false);
    setPrePolishContent(null);
    setRawContent("");
    setSummary("");
    setTitle("");
    setLocation("");
    setDateLabel(formatDateLabel(now));
    setIsoDateInput(toIsoDateInputValue(now));
    setTagsInput("");
    setImages([]);
  };

  const handleToggleCandidateTag = (tag: string) => {
    triggerHaptic(6);
    if (currentTagList.includes(tag)) {
      const next = currentTagList.filter((t) => t !== tag);
      setTagsInput(next.join(" "));
    } else {
      const next = [...currentTagList, tag];
      setTagsInput(next.join(" "));
    }
  };

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // YYYY-MM-DD
    if (!val) return;
    triggerHaptic(6);
    setIsoDateInput(val);
    const [y, m, d] = val.split("-").map((n) => parseInt(n, 10));
    if (y && m && d) {
      const picked = new Date(y, m - 1, d, 12, 0, 0);
      setDateLabel(formatDateLabel(picked));
    }
  };

  const handleAiDistill = async () => {
    if (!rawContent.trim()) return;
    triggerHaptic(10);
    setIsDistilling(true);
    const result = await callAiDistill(rawContent, aiConfig);
    setSummary(result.summary);

    const merged = Array.from(new Set([...currentTagList, ...result.tags]));
    setTagsInput(merged.join(" "));
    setIsDistilling(false);
  };

  const handleAiPolishCard = async () => {
    if (!rawContent.trim() && !title.trim()) return;
    triggerHaptic(10);
    setIsPolishing(true);
    try {
      const res = await callAiPolishAndTag(
        rawContent || title,
        {
          cardType,
          title,
          location,
        },
        aiConfig
      );
      if (res.title && !title.trim()) {
        setTitle(res.title);
      } else if (res.title && !rawContent.trim()) {
        setTitle(res.title);
      }
      if (
        res.polishedContent &&
        res.polishedContent !== rawContent &&
        rawContent.trim()
      ) {
        setPrePolishContent(rawContent);
        setRawContent(res.polishedContent);
      }
      if (res.tags.length > 0) {
        const merged = Array.from(new Set([...currentTagList, ...res.tags]));
        setTagsInput(merged.join(" "));
      }
    } finally {
      setIsPolishing(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    triggerHaptic(8);
    setIsCompressing(true);
    try {
      const remainingSlots = 9 - images.length;
      const slice = Array.from(files).slice(0, remainingSlots);
      const compressed = await Promise.all(slice.map(compressImageForGallery));
      setImages((prev) => [...prev, ...compressed]);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawContent.trim() && images.length === 0 && !title.trim()) return;
    triggerHaptic(12);
    setIsSubmitting(true);

    const inlineTags = Array.from(
      rawContent.matchAll(/#([\u4e00-\u9fa5a-zA-Z0-9_-]+)/g)
    ).map((m) => m[1]);

    let finalSummary = summary.trim();
    let autoTags: string[] = [];
    let finalModel = editingCard?.aiModel || aiConfig.model;

    if (cardType === "ai_insight" && !finalSummary) {
      const distilled = await callAiDistill(rawContent, aiConfig);
      finalSummary = distilled.summary;
      autoTags = distilled.tags;
      finalModel = distilled.modelUsed;
    }

    const defaultTypeTag =
      cardType === "ai_insight"
        ? "灵感"
        : cardType === "exhibition"
        ? "现场"
        : "高光";

    const finalTags = Array.from(
      new Set([
        ...currentTagList,
        ...inlineTags,
        ...autoTags,
        ...(currentTagList.length === 0 &&
        inlineTags.length === 0 &&
        autoTags.length === 0
          ? [defaultTypeTag]
          : []),
      ])
    );

    const now = new Date();
    let createdIso = editingCard ? editingCard.createdAt : now.toISOString();
    if (!editingCard && isoDateInput) {
      const todayIso = toIsoDateInputValue(now);
      if (isoDateInput !== todayIso) {
        const [y, m, d] = isoDateInput.split("-").map((n) => parseInt(n, 10));
        if (y && m && d) {
          createdIso = new Date(
            y,
            m - 1,
            d,
            now.getHours(),
            now.getMinutes(),
            now.getSeconds()
          ).toISOString();
        }
      }
    }

    const savedCard: MemoryCard = {
      id: editingCard ? editingCard.id : `mem-${Date.now()}`,
      type: cardType,
      createdAt: createdIso,
      dateLabel: dateLabel.trim() || formatDateLabel(now),
      rawContent: rawContent.trim() || (title ? title : "记录此刻"),
      tags: finalTags,
      isPinned: editingCard ? editingCard.isPinned : cardType === "milestone",
      boardX: editingCard ? editingCard.boardX : pendingBoardPos?.x,
      boardY: editingCard ? editingCard.boardY : pendingBoardPos?.y,
      rotation: editingCard?.rotation,
      paperColor,
      ...(editingCard?.linkedCardIds
        ? { linkedCardIds: editingCard.linkedCardIds }
        : {}),
      ...(editingCard?.linkedCardColors
        ? { linkedCardColors: editingCard.linkedCardColors }
        : {}),
      ...(cardType === "ai_insight" && {
        summary: finalSummary,
        aiModel: finalModel,
      }),
      ...(cardType === "exhibition" && {
        title: title.trim() || undefined,
        location: location.trim() || undefined,
        images,
        tapeStyle,
      }),
      ...(cardType === "milestone" && {
        title: title.trim() || "高光时刻",
        milestoneBadge,
        images: images.length > 0 ? images : undefined,
      }),
    };

    try {
      localStorage.removeItem(CAPTURE_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }

    onSaveCard(savedCard, Boolean(editingCard));
    setIsSubmitting(false);
    requestClose();
  };

  return (
    <div
      onClick={() => requestClose()}
      style={backdropMotionStyle}
      className={`fixed inset-0 z-50 bg-[#261E16]/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 ${
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={sheetMotionStyle}
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FBF6E9] border border-[#DFD2BA] paper-shadow overflow-hidden max-h-[92vh] flex flex-col ${
          isClosing ? "modal-sheet-exit" : "modal-sheet-enter"
        }`}
      >
        {/* 顶栏（支持按住下拉关闭） */}
        <div
          {...headerDragProps}
          className="border-b border-[#E6DBC6] bg-[#F6EFE0] select-none touch-none cursor-grab active:cursor-grabbing"
        >
          <div className="pt-2.5 pb-0.5 flex justify-center">
            <div className="w-10 h-1.5 rounded-full bg-[#C4B49D]/70" />
          </div>
          <div className="px-5 pb-3 pt-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-serif-notebook text-base font-bold text-[#2C251E]">
                {editingCard ? "编辑便签" : "钉一张新便签"}
              </h2>
              {!editingCard && restoredFromDraft && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E8EFE5] text-[#496044] font-medium">
                  已恢复草稿
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!editingCard &&
                (rawContent.trim() ||
                  title.trim() ||
                  summary.trim() ||
                  images.length > 0) && (
                  <button
                    type="button"
                    onClick={handleClearDraft}
                    title="清空当前草稿重写"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-[#7E7060] hover:text-red-700 hover:bg-[#EAE0CC] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清空</span>
                  </button>
                )}
              <button
                type="button"
                onClick={() => requestClose()}
                className="p-1.5 rounded-full text-[#7E7060] hover:text-[#2C251E] hover:bg-[#EAE0CC] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 表单 */}
        <form
          ref={formScrollRef}
          {...createScrollBodyPullProps(formScrollRef)}
          onSubmit={handleSubmit}
          className="p-5 overflow-y-auto space-y-4 pb-safe"
        >
          {/* 便签类型切换 */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#EFE6D4] border border-[#E2D6BE]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                setCardType("ai_insight");
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                cardType === "ai_insight"
                  ? "bg-[#FFFDF8] text-[#3F563A] shadow-2xs"
                  : "text-[#6D6050]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5C7457]" />
              <span>灵感便签</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                setCardType("exhibition");
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                cardType === "exhibition"
                  ? "bg-[#FFFDF8] text-[#8E5B28] shadow-2xs"
                  : "text-[#6D6050]"
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-[#C87D32]" />
              <span>拍立得</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                setCardType("milestone");
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                cardType === "milestone"
                  ? "bg-[#FFFDF8] text-[#9A5B13] shadow-2xs"
                  : "text-[#6D6050]"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-[#D4892A] fill-current" />
              <span>高光时刻</span>
            </button>
          </div>

          {cardType === "ai_insight" && (
            <div className="space-y-3">
              <textarea
                rows={5}
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder="写下此刻的想法，或粘贴一段对话（自动保存草稿）..."
                className={`w-full rounded-2xl ${PAPER_COLOR_STYLES[paperColor].bg} border ${PAPER_COLOR_STYLES[paperColor].border} p-3.5 text-sm text-[#2C251E] placeholder:text-[#A69886] focus:outline-none leading-relaxed transition-colors`}
              />

              {/* 便签纸色选择 */}
              <div className="flex items-center justify-between px-1 flex-wrap gap-1.5">
                <span className="text-xs text-[#6E6153]">便签纸色：</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    ["cream", "butter", "sage", "blush", "kraft"] as PaperColor[]
                  ).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        triggerHaptic(6);
                        setPaperColor(c);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all cursor-pointer flex items-center gap-1 ${
                        PAPER_COLOR_STYLES[c].dot
                      } ${
                        paperColor === c
                          ? "ring-2 ring-[#2C251E]/40 font-semibold scale-105"
                          : "opacity-75"
                      }`}
                    >
                      {paperColor === c && <Check className="w-3 h-3" />}
                      <span>{PAPER_COLOR_STYLES[c].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F3EFE2] border border-[#DCE3D8] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#496044]">
                    便签金句（留空保存时自动提炼）
                  </span>
                  <button
                    type="button"
                    onClick={handleAiDistill}
                    disabled={!rawContent.trim() || isDistilling}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#5C7457] disabled:opacity-45 text-white cursor-pointer"
                  >
                    <Wand2
                      className={`w-3 h-3 ${isDistilling ? "animate-spin" : ""}`}
                    />
                    <span>{isDistilling ? "提炼中..." : "AI 提炼"}</span>
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="一句话核心感悟..."
                  className="w-full rounded-xl bg-[#FFFDF9] border border-[#D8DEC8] px-3 py-2 text-sm font-serif-notebook font-semibold text-[#2A231C] placeholder:text-[#A49A8A] placeholder:font-normal focus:outline-none"
                />
              </div>
            </div>
          )}

          {cardType === "exhibition" && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D8CBB3] rounded-2xl p-4 text-center cursor-pointer bg-[#FFFDF8] active:bg-[#EFE5D2]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Upload className="w-5 h-5 text-[#9C866D] mx-auto mb-1" />
                <p className="text-xs text-[#5E5244]">
                  {isCompressing
                    ? "处理照片中..."
                    : `点击添加照片 (${images.length}/9)`}
                </p>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden border border-[#E2D6BE]"
                    >
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/65 text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="标题 / 展览名称"
                  className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] px-3 py-2 text-sm text-[#2C251E] placeholder:text-[#A69886] focus:outline-none"
                />
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-[#C87D32] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="地点"
                    className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] pl-8 pr-3 py-2 text-sm text-[#2C251E] placeholder:text-[#A69886] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-[#6E6153]">胶带：</span>
                  {(
                    [
                      { id: "amber", label: "琥珀", bg: "bg-[#E9C893]" },
                      { id: "sage", label: "抹茶", bg: "bg-[#B8CBB2]" },
                      { id: "rose", label: "玫瑰", bg: "bg-[#E6B8B0]" },
                      { id: "coffee", label: "燕麦", bg: "bg-[#C7B69E]" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTapeStyle(item.id)}
                      className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1 border cursor-pointer ${
                        tapeStyle === item.id
                          ? "border-[#5E4A34] font-semibold"
                          : "border-transparent opacity-75"
                      } ${item.bg}`}
                    >
                      {tapeStyle === item.id && <Check className="w-3 h-3" />}
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* 拍立得 AI 润色与自动打标按钮 */}
                <div className="flex items-center gap-1.5">
                  {prePolishContent !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawContent(prePolishContent);
                        setPrePolishContent(null);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#7E7060] hover:text-[#2C251E] bg-[#EFE6D4] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>撤回润色</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAiPolishCard}
                    disabled={(!rawContent.trim() && !title.trim()) || isPolishing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#C87D32] disabled:opacity-45 text-white cursor-pointer"
                  >
                    <Wand2
                      className={`w-3 h-3 ${isPolishing ? "animate-spin" : ""}`}
                    />
                    <span>
                      {isPolishing ? "AI 润色中..." : "AI 润色与打标"}
                    </span>
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder="写下此刻的感受（支持点击右上方 AI 润色并自动生成标题与标签）..."
                className="w-full rounded-2xl bg-[#FFFDF8] border border-[#DFD2BA] p-3.5 text-sm text-[#2C251E] placeholder:text-[#A69886] focus:outline-none leading-relaxed"
              />
            </div>
          )}

          {cardType === "milestone" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="标题（留空可由 AI 自动提炼）"
                  className="col-span-2 rounded-xl bg-[#FFFDF8] border border-[#E3C590] px-3 py-2 text-sm font-serif-notebook font-semibold text-[#2C251E] placeholder:text-[#A69886] focus:outline-none"
                />
                <select
                  value={milestoneBadge}
                  onChange={(e) => setMilestoneBadge(e.target.value)}
                  className="rounded-xl bg-[#FFF9EB] border border-[#E3C590] px-2.5 py-2 text-xs text-[#8B5215] font-medium focus:outline-none"
                >
                  <option value="高光时刻">✨ 高光时刻</option>
                  <option value="重要里程碑">🏆 里程碑</option>
                  <option value="好运头奖">🎉 好运</option>
                  <option value="小确幸">💛 小确幸</option>
                </select>
              </div>

              <textarea
                rows={4}
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder="记录这件值得回味的事..."
                className="w-full rounded-2xl bg-[#FFFDF8] border border-[#E3C590] p-3.5 text-sm text-[#2C251E] placeholder:text-[#A69886] focus:outline-none leading-relaxed"
              />

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs text-[#8E5B28] bg-[#F7E9CF] px-3 py-1.5 rounded-xl font-medium cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>添加配图 ({images.length})</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {prePolishContent !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawContent(prePolishContent);
                        setPrePolishContent(null);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#7E7060] hover:text-[#2C251E] bg-[#EFE6D4] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>撤回润色</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAiPolishCard}
                    disabled={(!rawContent.trim() && !title.trim()) || isPolishing}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#C87D32] disabled:opacity-45 text-white cursor-pointer"
                  >
                    <Wand2
                      className={`w-3 h-3 ${isPolishing ? "animate-spin" : ""}`}
                    />
                    <span>
                      {isPolishing ? "AI 提炼中..." : "AI 提炼标题与润色"}
                    </span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden border border-[#E2D6BE]"
                    >
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/65 text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 标签输入 + 真实日历日期选择器 */}
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3 relative">
                <Tag className="w-3.5 h-3.5 text-[#8E8070] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="标签（空格分隔，或点下方标签）"
                  className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] pl-8 pr-3 py-2 text-xs text-[#2C251E] placeholder:text-[#A69886] focus:outline-none"
                />
              </div>

              {/* 真实日历选择 + 自动星期计算 */}
              <div className="col-span-2 relative flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      datePickerRef.current?.showPicker?.();
                    } catch {
                      datePickerRef.current?.focus();
                    }
                  }}
                  title="点击选择日历日期"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#C87D32] hover:text-[#9A5B13] z-10 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  value={dateLabel}
                  onChange={(e) => setDateLabel(e.target.value)}
                  className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] pl-7 pr-7 py-2 text-xs font-mono text-[#2C251E] focus:outline-none"
                />
                <input
                  ref={datePickerRef}
                  type="date"
                  value={isoDateInput}
                  onChange={handleDatePickerChange}
                  className="absolute right-1.5 w-5 h-6 opacity-0 cursor-pointer"
                  title="选择日期自动计算星期"
                />
                <span className="pointer-events-none absolute right-2 text-[10px] text-[#9A8C7A]">
                  📅
                </span>
              </div>
            </div>

            {/* 快捷标签候选池：一键点选常用标签 */}
            {candidateTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap px-0.5">
                <span className="text-[11px] text-[#8E8070]">快捷标签：</span>
                {candidateTags.map((tag) => {
                  const selected = currentTagList.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleCandidateTag(tag)}
                      className={`px-2 py-0.5 rounded-full text-[11px] transition-all cursor-pointer ${
                        selected
                          ? "bg-[#2C251E] text-[#FBF6E9] font-medium"
                          : "bg-[#EFE7D6] text-[#66594B] hover:bg-[#E4D9C3]"
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6153] cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="px-6 py-2 rounded-xl text-xs font-semibold bg-[#2C251E] disabled:opacity-50 text-[#FBF6E9] cursor-pointer"
            >
              {isSubmitting ? "保存中..." : "钉上墙"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
