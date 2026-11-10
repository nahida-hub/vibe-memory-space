"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Search,
  X,
  Settings,
  Sparkles,
  RotateCcw,
  Sun,
  Moon,
} from "lucide-react";
import {
  CardType,
  LayoutMode,
  MemoryCard,
  PaperColor,
  ThemeMode,
  ThreadColor,
} from "@/types/memory";
import {
  AiConfig,
  AI_CONFIG_STORAGE_KEY,
  DEFAULT_AI_CONFIG,
} from "@/types/aiConfig";
import { INITIAL_MEMORIES } from "@/data/mockMemories";
import { callAiDistill } from "@/utils/aiClient";
import {
  loadAllMemoriesFromDb,
  saveAllMemoriesToDb,
  requestPersistentStorage,
  triggerHaptic,
} from "@/utils/storageDb";
import PinboardWall, {
  computeInitialBoardPosition,
} from "@/components/PinboardWall";
import NoteDetailModal from "@/components/NoteDetailModal";
import AiInsightCard from "@/components/AiInsightCard";
import ExhibitionCard from "@/components/ExhibitionCard";
import MilestoneCard from "@/components/MilestoneCard";
import QuickCaptureModal from "@/components/QuickCaptureModal";
import SettingsModal from "@/components/SettingsModal";
import ImageLightbox from "@/components/ImageLightbox";
import UpdateModal from "@/components/UpdateModal";
import AiReviewModal from "@/components/AiReviewModal";
import PosterPreviewModal from "@/components/PosterPreviewModal";
import {
  RemoteReleaseInfo,
  checkForAppUpdate,
  loadUpdateConfig,
  IGNORED_VERSION_STORAGE_KEY,
} from "@/utils/appUpdater";
import { APP_VERSION } from "@/utils/versionInfo";

export default function HomePage() {
  const [memories, setMemories] = useState<MemoryCard[]>(INITIAL_MEMORIES);
  const [aiConfig, setAiConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  // 顶部搜索与筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | CardType>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // 默认采用四面八方自由滑动的「便签墙」模式
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("wall");
  const [themeMode, setThemeMode] = useState<ThemeMode>("daylight");
  const [linkingFromCardId, setLinkingFromCardId] = useState<string | null>(
    null
  );
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [focusCardRequest, setFocusCardRequest] = useState<{
    id: string;
    seq: number;
  } | null>(null);

  // 弹窗状态
  const [selectedCard, setSelectedCard] = useState<MemoryCard | null>(null);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isAiReviewOpen, setIsAiReviewOpen] = useState(false);
  const [captureInitialType, setCaptureInitialType] =
    useState<CardType>("ai_insight");
  const [editingCard, setEditingCard] = useState<MemoryCard | null>(null);
  const [pendingBoardPos, setPendingBoardPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [redistillingCardId, setRedistillingCardId] = useState<string | null>(
    null
  );
  const [deletedUndoState, setDeletedUndoState] = useState<{
    card: MemoryCard;
    index: number;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    images: string[];
    index: number;
    title?: string;
  } | null>(null);
  const [updateModalState, setUpdateModalState] = useState<{
    isOpen: boolean;
    currentVersion: string;
    release: RemoteReleaseInfo | null;
  }>({
    isOpen: false,
    currentVersion: APP_VERSION,
    release: null,
  });
  const [hasAvailableUpdate, setHasAvailableUpdate] = useState(false);

  // 初始化加载数据与配置
  useEffect(() => {
    let mounted = true;

    if (typeof window !== "undefined") {
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredInstallPrompt(e);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }

      requestPersistentStorage();

      try {
        const savedTheme = localStorage.getItem("vibe_memory_theme_v1");
        if (savedTheme === "night_lamp" || savedTheme === "daylight") {
          setThemeMode(savedTheme);
          document.documentElement.dataset.theme = savedTheme;
        }
      } catch {
        // ignore
      }

      try {
        const savedAiConfig = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
        if (savedAiConfig) {
          const parsedAi = JSON.parse(savedAiConfig);
          if (parsedAi && parsedAi.baseUrl) {
            setAiConfig({
              ...DEFAULT_AI_CONFIG,
              ...parsedAi,
              connectionMode: parsedAi.connectionMode || "direct",
            });
          }
        }
      } catch {
        // ignore
      }

      loadAllMemoriesFromDb(INITIAL_MEMORIES)
        .then(({ memories: loadedCards }) => {
          if (!mounted) return;
          setMemories(loadedCards);
          setIsLoaded(true);
        })
        .catch(() => {
          if (mounted) setIsLoaded(true);
        });

      // 启动时后台静默检测新版本（如已配置 GitHub 仓库或更新源）
      const updCfg = loadUpdateConfig();
      if (updCfg.autoCheckOnLaunch && (updCfg.githubRepo || updCfg.customJsonUrl)) {
        checkForAppUpdate(updCfg)
          .then((res) => {
            if (!mounted || !res.hasUpdate || !res.latest) return;
            setHasAvailableUpdate(true);
            const ignored = localStorage.getItem(IGNORED_VERSION_STORAGE_KEY);
            if (ignored !== res.latest.versionName) {
              setUpdateModalState({
                isOpen: true,
                currentVersion: res.currentVersion,
                release: res.latest,
              });
            }
          })
          .catch(() => {});
      }

      return () => {
        mounted = false;
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt
        );
      };
    }
  }, []);

  // 数据变更自动持久化
  useEffect(() => {
    if (!isLoaded) return;
    saveAllMemoriesToDb(memories);
  }, [memories, isLoaded]);

  // 适配 Android 手机侧滑返回与返回键：打开弹窗时优先关闭最顶层弹窗而非直接退出 App
  const hasAnyModalOpen = Boolean(
    lightboxState ||
      isCaptureOpen ||
      isAiReviewOpen ||
      selectedCard ||
      isSettingsOpen
  );
  useEffect(() => {
    if (typeof window === "undefined" || !hasAnyModalOpen) return;

    window.history.pushState({ notebookModal: true }, "");
    const handlePopState = () => {
      if (lightboxState) {
        setLightboxState(null);
      } else if (isCaptureOpen) {
        setIsCaptureOpen(false);
        setEditingCard(null);
        setPendingBoardPos(null);
      } else if (isAiReviewOpen) {
        setIsAiReviewOpen(false);
      } else if (selectedCard) {
        setSelectedCard(null);
      } else if (isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [
    hasAnyModalOpen,
    lightboxState,
    isCaptureOpen,
    isAiReviewOpen,
    selectedCard,
    isSettingsOpen,
  ]);

  // 保存 AI 配置
  const handleSaveAiConfig = (newConfig: AiConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    } catch {
      // ignore
    }
  };

  // 过滤匹配的便签
  const filteredMemories = useMemo(() => {
    return memories
      .filter((item) => {
        if (activeCategory !== "all" && item.type !== activeCategory) {
          return false;
        }
        if (activeTag && !item.tags.includes(activeTag)) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const inSummary = item.summary?.toLowerCase().includes(q);
          const inRaw = item.rawContent.toLowerCase().includes(q);
          const inTitle = item.title?.toLowerCase().includes(q);
          const inLocation = item.location?.toLowerCase().includes(q);
          const inTags = item.tags.some((t) => t.toLowerCase().includes(q));
          return inSummary || inRaw || inTitle || inLocation || inTags;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [memories, activeCategory, activeTag, searchQuery]);

  const matchedIds = useMemo(
    () => new Set(filteredMemories.map((m) => m.id)),
    [filteredMemories]
  );

  const hasActiveFilter =
    activeCategory !== "all" ||
    Boolean(activeTag) ||
    Boolean(searchQuery.trim());

  // 聚合全墙高频 #标签（用于顶部筛选栏与新建弹窗一键点选）
  const popularTags = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const m of memories) {
      for (const t of m.tags) {
        freq[t] = (freq[t] || 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 12);
  }, [memories]);

  // 新增或编辑便签
  const handleSaveCard = (savedCard: MemoryCard, isEdit: boolean) => {
    triggerHaptic(10);
    if (isEdit) {
      setMemories((prev) =>
        prev.map((item) => (item.id === savedCard.id ? savedCard : item))
      );
      if (selectedCard?.id === savedCard.id) {
        setSelectedCard(savedCard);
      }
    } else {
      // 新便签计算一个靠近中心或螺旋空位的位置，并自动驱动镜头飞跃聚焦到新便签
      const pos = computeInitialBoardPosition(
        savedCard,
        memories.length,
        memories.length + 1
      );
      const cardWithPos: MemoryCard = {
        ...savedCard,
        boardX:
          typeof savedCard.boardX === "number" ? savedCard.boardX : pos.x,
        boardY:
          typeof savedCard.boardY === "number" ? savedCard.boardY : pos.y,
        rotation: pos.rotation,
      };
      setMemories((prev) => [cardWithPos, ...prev]);
      setFocusCardRequest({ id: cardWithPos.id, seq: Date.now() });
    }
    setEditingCard(null);
    setPendingBoardPos(null);
  };

  // 更新便签在墙面上的拖拽坐标
  const handleUpdateCardPosition = (
    id: string,
    boardX: number,
    boardY: number
  ) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, boardX, boardY } : m))
    );
  };

  // 一键重新整齐排布所有墙面便签
  const handleAutoArrangeWall = () => {
    setMemories((prev) =>
      prev.map((card, idx) => {
        const cleanCard = { ...card, boardX: undefined, boardY: undefined };
        const pos = computeInitialBoardPosition(cleanCard, idx, prev.length);
        return {
          ...card,
          boardX: pos.x,
          boardY: pos.y,
          rotation: pos.rotation,
        };
      })
    );
    setCenterTrigger((c) => c + 1);
  };

  const handleEditCard = (card: MemoryCard) => {
    setEditingCard(card);
    setCaptureInitialType(card.type);
    setIsCaptureOpen(true);
  };

  const handleRedistillCard = async (id: string) => {
    const target = memories.find((m) => m.id === id);
    if (!target || redistillingCardId) return;

    setRedistillingCardId(id);
    const res = await callAiDistill(target.rawContent, aiConfig);
    setMemories((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updated = {
          ...m,
          summary: res.summary,
          tags: Array.from(new Set([...res.tags, ...m.tags])).slice(0, 4),
          aiModel: res.modelUsed,
        };
        if (selectedCard?.id === id) {
          setSelectedCard(updated);
        }
        return updated;
      })
    );
    setRedistillingCardId(null);
  };

  const handleDeleteCard = (id: string) => {
    const targetIdx = memories.findIndex((item) => item.id === id);
    if (targetIdx === -1) return;
    const deletedCard = memories[targetIdx];

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setDeletedUndoState({ card: deletedCard, index: targetIdx });
    undoTimerRef.current = setTimeout(() => {
      setDeletedUndoState(null);
      undoTimerRef.current = null;
    }, 6000);

    setMemories((prev) => prev.filter((item) => item.id !== id));
    if (selectedCard?.id === id) {
      setSelectedCard(null);
    }
  };

  const handleUndoDelete = () => {
    if (!deletedUndoState) return;
    triggerHaptic(10);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const { card, index } = deletedUndoState;
    setMemories((prev) => {
      if (prev.some((item) => item.id === card.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, card);
      return next;
    });
    setFocusCardRequest({ id: card.id, seq: Date.now() });
    setDeletedUndoState(null);
  };

  const handleTogglePin = (id: string) => {
    setMemories((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, isPinned: !item.isPinned };
        if (selectedCard?.id === id) {
          setSelectedCard(updated);
        }
        return updated;
      })
    );
  };

  const handleChangePaperColor = (id: string, paperColor: PaperColor) => {
    setMemories((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, paperColor };
        if (selectedCard?.id === id) {
          setSelectedCard(updated);
        }
        return updated;
      })
    );
  };

  const handleChangeThemeMode = (nextTheme: ThemeMode) => {
    setThemeMode(nextTheme);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextTheme;
    }
    try {
      localStorage.setItem("vibe_memory_theme_v1", nextTheme);
    } catch {
      // ignore
    }
  };

  // 切换两张便签之间的连线关联（若已关联但选择了新颜色则直接换色；若颜色一致或未传色则解开；未关联则以所选颜色连线）
  const handleToggleLinkCard = (
    sourceId: string,
    targetId: string,
    color?: ThreadColor
  ) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    triggerHaptic([8, 20, 8]);
    setMemories((prev) => {
      const sourceCard = prev.find((m) => m.id === sourceId);
      const targetCard = prev.find((m) => m.id === targetId);
      if (!sourceCard || !targetCard) return prev;

      const isAlreadyLinked =
        (sourceCard.linkedCardIds || []).includes(targetId) ||
        (targetCard.linkedCardIds || []).includes(sourceId);

      const existingColor: ThreadColor =
        sourceCard.linkedCardColors?.[targetId] ||
        targetCard.linkedCardColors?.[sourceId] ||
        "crimson";

      // 若已连接且传入了不同的新颜色，则更新该条连线的颜色而不解绑
      if (isAlreadyLinked && color && color !== existingColor) {
        return prev.map((item) => {
          if (item.id !== sourceId && item.id !== targetId) return item;
          const otherId = item.id === sourceId ? targetId : sourceId;
          const curList = Array.from(
            new Set([...(item.linkedCardIds || []), otherId])
          );
          const nextColors = {
            ...(item.linkedCardColors || {}),
            [otherId]: color,
          };
          const updated = {
            ...item,
            linkedCardIds: curList,
            linkedCardColors: nextColors,
          };
          if (selectedCard?.id === item.id) {
            setSelectedCard(updated);
          }
          return updated;
        });
      }

      const chosenColor: ThreadColor = color || "crimson";

      return prev.map((item) => {
        if (item.id !== sourceId && item.id !== targetId) return item;
        const otherId = item.id === sourceId ? targetId : sourceId;
        const curList = item.linkedCardIds || [];
        const nextList = isAlreadyLinked
          ? curList.filter((id) => id !== otherId)
          : Array.from(new Set([...curList, otherId]));
        const nextColors = { ...(item.linkedCardColors || {}) };
        if (isAlreadyLinked) {
          delete nextColors[otherId];
        } else {
          nextColors[otherId] = chosenColor;
        }
        const updated = {
          ...item,
          linkedCardIds: nextList,
          linkedCardColors: nextColors,
        };
        if (selectedCard?.id === item.id) {
          setSelectedCard(updated);
        }
        return updated;
      });
    });
  };

  // 单独修改某条已有连线的颜色
  const handleUpdatePairThreadColor = (
    sourceId: string,
    targetId: string,
    color: ThreadColor
  ) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setMemories((prev) =>
      prev.map((item) => {
        if (item.id !== sourceId && item.id !== targetId) return item;
        const otherId = item.id === sourceId ? targetId : sourceId;
        const nextColors = {
          ...(item.linkedCardColors || {}),
          [otherId]: color,
        };
        const updated = {
          ...item,
          linkedCardColors: nextColors,
        };
        if (selectedCard?.id === item.id) {
          setSelectedCard(updated);
        }
        return updated;
      })
    );
  };

  const handleImportMemories = (
    imported: MemoryCard[],
    mode: "merge" | "replace"
  ) => {
    if (mode === "replace") {
      setMemories(imported);
    } else {
      setMemories((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const uniqueNew = imported.filter((item) => !existingIds.has(item.id));
        return [...uniqueNew, ...prev];
      });
    }
  };

  const handleResetDemo = () => {
    if (window.confirm("确定恢复为初始示例便签吗？")) {
      setMemories(INITIAL_MEMORIES);
      saveAllMemoriesToDb(INITIAL_MEMORIES);
      setCenterTrigger((c) => c + 1);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* 顶部极简悬浮搜索栏 + 右侧独立设置按钮 */}
      <header className="fixed top-0 left-0 right-0 z-30 pt-safe px-3.5 sm:px-6 pt-3 pointer-events-none">
        <div className="max-w-lg mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* 搜索胶囊框 */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8E8070] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 180)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索便签、地点、#标签..."
                className={`w-full pl-9 pr-8 py-2.5 rounded-full backdrop-blur-md border shadow-md text-xs focus:outline-none transition-colors ${
                  themeMode === "night_lamp"
                    ? "bg-[#261F1A]/92 border-[#4A3B2F] text-[#EADBC4] placeholder:text-[#8E7D6A] focus:border-[#C87D32]"
                    : "bg-[#FFFDF8]/92 border-[#DED2BA] text-[#2C251E] placeholder:text-[#A39584] focus:border-[#8C7A65]"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8E8070] hover:text-[#2C251E]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 深夜台灯 / 日间暖纸一键切换按钮 */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                handleChangeThemeMode(
                  themeMode === "night_lamp" ? "daylight" : "night_lamp"
                );
              }}
              title={
                themeMode === "night_lamp"
                  ? "切换为日间暖纸模式"
                  : "开启深夜台灯夜读模式"
              }
              className={`w-10 h-10 rounded-full backdrop-blur-md border shadow-md flex items-center justify-center cursor-pointer shrink-0 transition-colors ${
                themeMode === "night_lamp"
                  ? "bg-[#261F1A]/92 border-[#5E4A36] text-[#E8C589]"
                  : "bg-[#FFFDF8]/92 border-[#DED2BA] text-[#8C6D46] hover:text-[#2C251E]"
              }`}
            >
              {themeMode === "night_lamp" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* AI 翻阅手账回顾入口按钮 */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setIsAiReviewOpen(true);
              }}
              title="AI 翻阅手账 · 周期回顾"
              className={`w-10 h-10 rounded-full backdrop-blur-md border shadow-md flex items-center justify-center cursor-pointer shrink-0 transition-colors ${
                themeMode === "night_lamp"
                  ? "bg-[#261F1A]/92 border-[#4A3B2F] text-[#8BAF83]"
                  : "bg-[#FFFDF8]/92 border-[#DED2BA] text-[#496044] hover:text-[#2C251E]"
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* 独立设置入口按钮 */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setIsSettingsOpen(true);
              }}
              title="设置"
              className={`relative w-10 h-10 rounded-full backdrop-blur-md border shadow-md flex items-center justify-center cursor-pointer shrink-0 transition-colors ${
                themeMode === "night_lamp"
                  ? "bg-[#261F1A]/92 border-[#4A3B2F] text-[#C4B299]"
                  : "bg-[#FFFDF8]/92 border-[#DED2BA] text-[#5E5244] hover:text-[#2C251E]"
              }`}
            >
              <Settings className="w-4 h-4" />
              {hasAvailableUpdate && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#C87D32] ring-2 ring-[#FFFDF8]" />
              )}
            </button>
          </div>

          {/* 当点击搜索框或存在过滤条件时，浮现轻量分类与高频标签点选池 */}
          {(isSearchFocused || hasActiveFilter) && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto py-0.5 filter-bar-enter">
              {(
                [
                  { id: "all", label: "全部" },
                  { id: "ai_insight", label: "灵感" },
                  { id: "exhibition", label: "拍立得" },
                  { id: "milestone", label: "高光" },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setActiveCategory(cat.id);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium shadow-xs whitespace-nowrap cursor-pointer ${
                    activeCategory === cat.id
                      ? "bg-[#2C251E] text-[#FBF6E9]"
                      : "bg-[#FFFDF8]/90 text-[#66594B] border border-[#DED2BA]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}

              {activeTag && (
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#C87D32] text-white shadow-xs whitespace-nowrap cursor-pointer"
                >
                  <span>#{activeTag}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* 高频历史标签一键筛选胶囊 */}
              {popularTags
                .filter((t) => t !== activeTag)
                .slice(0, 8)
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      triggerHaptic(6);
                      setActiveTag(tag);
                    }}
                    className="px-2.5 py-1 rounded-full text-xs bg-[#FFFDF8]/88 text-[#6E6050] border border-[#E2D6BE] hover:bg-[#EFE7D6] shadow-2xs whitespace-nowrap cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
            </div>
          )}
        </div>
      </header>

      {/* 主视图：默认 2D 四面八方自由滑动便签墙，或在设置中切换为瀑布流 */}
      {layoutMode === "wall" ? (
        <PinboardWall
          memories={memories}
          matchedIds={matchedIds}
          hasActiveFilter={hasActiveFilter}
          activeTag={activeTag}
          themeMode={themeMode}
          linkingFromCardId={linkingFromCardId}
          onCancelLinking={() => setLinkingFromCardId(null)}
          onToggleLinkCard={handleToggleLinkCard}
          onUpdatePairThreadColor={handleUpdatePairThreadColor}
          onSelectCard={(card) => setSelectedCard(card)}
          onTagClick={(tag) => setActiveTag(activeTag === tag ? null : tag)}
          onUpdateCardPosition={handleUpdateCardPosition}
          onAutoArrangeWall={handleAutoArrangeWall}
          onOpenAiReview={() => setIsAiReviewOpen(true)}
          focusCardRequest={focusCardRequest}
          onDoubleClickWall={(boardX, boardY) => {
            setEditingCard(null);
            setPendingBoardPos({ x: boardX, y: boardY });
            setCaptureInitialType("ai_insight");
            setIsCaptureOpen(true);
          }}
          centerTrigger={centerTrigger}
        />
      ) : (
        <main
          key="view-masonry"
          className="max-w-5xl mx-auto px-4 pt-20 pb-28 view-transition-enter"
        >
          <section className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {filteredMemories.map((card) => (
              <div key={card.id} className="break-inside-avoid">
                {card.type === "ai_insight" && (
                  <AiInsightCard
                    card={card}
                    isRedistilling={redistillingCardId === card.id}
                    onSelect={(c) => setSelectedCard(c)}
                    onTagClick={(tag) =>
                      setActiveTag(activeTag === tag ? null : tag)
                    }
                    onEdit={handleEditCard}
                    onDelete={handleDeleteCard}
                    onTogglePin={handleTogglePin}
                    onRedistill={handleRedistillCard}
                  />
                )}
                {card.type === "exhibition" && (
                  <ExhibitionCard
                    card={card}
                    onSelect={(c) => setSelectedCard(c)}
                    onTagClick={(tag) =>
                      setActiveTag(activeTag === tag ? null : tag)
                    }
                    onEdit={handleEditCard}
                    onDelete={handleDeleteCard}
                    onTogglePin={handleTogglePin}
                    onOpenLightbox={(images, startIndex, title) =>
                      setLightboxState({ images, index: startIndex, title })
                    }
                  />
                )}
                {card.type === "milestone" && (
                  <MilestoneCard
                    card={card}
                    onSelect={(c) => setSelectedCard(c)}
                    onTagClick={(tag) =>
                      setActiveTag(activeTag === tag ? null : tag)
                    }
                    onEdit={handleEditCard}
                    onDelete={handleDeleteCard}
                    onTogglePin={handleTogglePin}
                    onOpenLightbox={(images, startIndex, title) =>
                      setLightboxState({ images, index: startIndex, title })
                    }
                  />
                )}
              </div>
            ))}
          </section>
        </main>
      )}

      {/* 误删便签 6 秒撤销（Undo）浮条 */}
      {deletedUndoState && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-sm pointer-events-auto">
          <div className="rounded-2xl bg-[#2C251E]/95 text-[#FBF6E9] px-4 py-3 shadow-2xl border border-[#5E5042] flex items-center justify-between gap-3 backdrop-blur-md">
            <span className="text-xs truncate">
              已删除「
              {deletedUndoState.card.title ||
                deletedUndoState.card.summary ||
                deletedUndoState.card.rawContent.slice(0, 14)}
              」
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleUndoDelete}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E8C589] text-[#2C251E] text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>撤销</span>
              </button>
              <button
                type="button"
                onClick={() => setDeletedUndoState(null)}
                className="p-1 text-[#A39584] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右下角唯一一个 ➕ 号按钮 */}
      <div className="fixed bottom-6 right-5 z-40 pb-safe">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            setEditingCard(null);
            setPendingBoardPos(null);
            setCaptureInitialType("ai_insight");
            setIsCaptureOpen(true);
          }}
          title="添加新便签"
          className="w-14 h-14 rounded-full bg-[#2C251E] hover:bg-[#3F352C] text-[#FBF6E9] shadow-2xl flex items-center justify-center transition-transform cursor-pointer border border-[#5E5042]"
        >
          <Plus className="w-6 h-6 text-[#E8C589]" />
        </button>
      </div>

      {/* 点击墙上任意便签弹出的详情阅读窗 */}
      <NoteDetailModal
        card={selectedCard}
        allMemories={memories}
        isRedistilling={
          Boolean(selectedCard && redistillingCardId === selectedCard.id)
        }
        onClose={() => setSelectedCard(null)}
        onEdit={handleEditCard}
        onDelete={handleDeleteCard}
        onTogglePin={handleTogglePin}
        onChangePaperColor={handleChangePaperColor}
        onRedistill={handleRedistillCard}
        onTagClick={(tag) => setActiveTag(activeTag === tag ? null : tag)}
        onOpenLightbox={(images, startIndex, title) =>
          setLightboxState({ images, index: startIndex, title })
        }
        onSelectLinkedCard={(linked) => {
          setSelectedCard(linked);
          setFocusCardRequest({ id: linked.id, seq: Date.now() });
        }}
        onToggleLinkCard={handleToggleLinkCard}
        onUpdatePairThreadColor={handleUpdatePairThreadColor}
        onStartWallLinking={(sourceId) => {
          setLayoutMode("wall");
          setLinkingFromCardId(sourceId);
        }}
      />

      {/* 新增 / 编辑便签弹窗 */}
      <QuickCaptureModal
        isOpen={isCaptureOpen}
        initialType={captureInitialType}
        editingCard={editingCard}
        pendingBoardPos={pendingBoardPos}
        popularTags={popularTags}
        aiConfig={aiConfig}
        onClose={() => {
          setIsCaptureOpen(false);
          setEditingCard(null);
          setPendingBoardPos(null);
        }}
        onSaveCard={handleSaveCard}
      />

      {/* AI 翻阅手账 · 周期回顾弹窗 */}
      <AiReviewModal
        isOpen={isAiReviewOpen}
        memories={memories}
        popularTags={popularTags}
        aiConfig={aiConfig}
        onClose={() => setIsAiReviewOpen(false)}
        onPinReviewToWall={(reviewCard) => {
          handleSaveCard(reviewCard, false);
        }}
      />

      {/* 独立设置界面（整合通用、备份、AI 接口配置） */}
      <SettingsModal
        isOpen={isSettingsOpen}
        aiConfig={aiConfig}
        layoutMode={layoutMode}
        themeMode={themeMode}
        memories={memories}
        canInstallPwa={Boolean(deferredInstallPrompt)}
        onTriggerInstallPwa={async () => {
          if (!deferredInstallPrompt) return;
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          if (choice?.outcome === "accepted") {
            setDeferredInstallPrompt(null);
          }
        }}
        onClose={() => setIsSettingsOpen(false)}
        onSaveAiConfig={handleSaveAiConfig}
        onChangeLayoutMode={(m) => setLayoutMode(m)}
        onChangeThemeMode={handleChangeThemeMode}
        onAutoArrangeWall={handleAutoArrangeWall}
        onImportMemories={handleImportMemories}
        onResetDemo={handleResetDemo}
        onOpenUpdateModal={(currentVersion, release) => {
          setHasAvailableUpdate(true);
          setIsSettingsOpen(false);
          setUpdateModalState({
            isOpen: true,
            currentVersion,
            release,
          });
        }}
      />

      {/* 应用内版本更新弹窗 */}
      <UpdateModal
        isOpen={updateModalState.isOpen}
        currentVersion={updateModalState.currentVersion}
        release={updateModalState.release}
        onClose={() =>
          setUpdateModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* 拍立得朋友圈分享海报预览与原生保存/分享弹窗 */}
      <PosterPreviewModal />

      {/* 拍立得全屏看大图 */}
      {lightboxState && (
        <ImageLightbox
          images={lightboxState.images}
          currentIndex={lightboxState.index}
          title={lightboxState.title}
          onClose={() => setLightboxState(null)}
          onPrev={() =>
            setLightboxState((prev) =>
              prev
                ? {
                    ...prev,
                    index:
                      (prev.index - 1 + prev.images.length) %
                      prev.images.length,
                  }
                : null
            )
          }
          onNext={() =>
            setLightboxState((prev) =>
              prev
                ? {
                    ...prev,
                    index: (prev.index + 1) % prev.images.length,
                  }
                : null
            )
          }
        />
      )}
    </div>
  );
}
