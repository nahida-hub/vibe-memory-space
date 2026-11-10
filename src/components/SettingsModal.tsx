"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  RotateCcw,
  LayoutGrid,
  Compass,
  Smartphone,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import {
  AiConfig,
  AiConnectionMode,
  AI_PROVIDER_PRESETS,
  DEFAULT_AI_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
} from "@/types/aiConfig";
import { LayoutMode, MemoryCard, ThemeMode } from "@/types/memory";
import { testAiConnection } from "@/utils/aiClient";
import { triggerHaptic } from "@/utils/storageDb";
import { sanitizeImportedMemories } from "@/utils/security";
import { useSheetDismiss } from "@/utils/useSheetDismiss";
import {
  UpdateConfig,
  RemoteReleaseInfo,
  loadUpdateConfig,
  saveUpdateConfig,
  checkForAppUpdate,
  getCurrentAppVersion,
} from "@/utils/appUpdater";
import { APP_VERSION, APP_VERSION_CODE } from "@/utils/versionInfo";

interface SettingsModalProps {
  isOpen: boolean;
  aiConfig: AiConfig;
  layoutMode: LayoutMode;
  themeMode?: ThemeMode;
  memories: MemoryCard[];
  canInstallPwa?: boolean;
  onTriggerInstallPwa?: () => void;
  onClose: () => void;
  onSaveAiConfig: (newConfig: AiConfig) => void;
  onChangeLayoutMode: (mode: LayoutMode) => void;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  onAutoArrangeWall: () => void;
  onImportMemories: (imported: MemoryCard[], mode: "merge" | "replace") => void;
  onResetDemo: () => void;
  onOpenUpdateModal?: (
    currentVersion: string,
    release: RemoteReleaseInfo
  ) => void;
}

export default function SettingsModal({
  isOpen,
  aiConfig,
  layoutMode,
  themeMode = "daylight",
  memories,
  canInstallPwa = false,
  onTriggerInstallPwa,
  onClose,
  onSaveAiConfig,
  onChangeLayoutMode,
  onChangeThemeMode,
  onAutoArrangeWall,
  onImportMemories,
  onResetDemo,
  onOpenUpdateModal,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "ai">("general");
  const [draft, setDraft] = useState<AiConfig>({
    ...DEFAULT_AI_CONFIG,
    ...aiConfig,
    connectionMode: aiConfig.connectionMode || "direct",
  });
  const [showKey, setShowKey] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [notice, setNotice] = useState<string | null>(null);
  const [testState, setTestState] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // 版本与更新状态
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig>(loadUpdateConfig);
  const [currentVersionInfo, setCurrentVersionInfo] = useState({
    versionName: APP_VERSION,
    versionCode: APP_VERSION_CODE,
  });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState<{
    type: "info" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  const {
    shouldRender,
    isClosing,
    dragY,
    requestClose,
    headerDragProps,
    createScrollBodyPullProps,
    sheetMotionStyle,
    backdropMotionStyle,
  } = useSheetDismiss({ isOpen, onClose });

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...DEFAULT_AI_CONFIG,
        ...aiConfig,
        connectionMode: aiConfig.connectionMode || "direct",
      });
      setTestState({ status: "idle" });
      setNotice(null);
      setUpdateConfig(loadUpdateConfig());
      setUpdateCheckMessage(null);
      getCurrentAppVersion().then((info) => {
        setCurrentVersionInfo({
          versionName: info.versionName,
          versionCode: info.versionCode,
        });
      });
    }
  }, [isOpen, aiConfig]);

  if (!shouldRender) return null;

  const currentPreset = AI_PROVIDER_PRESETS.find(
    (p) => p.name === draft.providerName
  );

  const handleSelectPreset = (presetName: string) => {
    triggerHaptic(8);
    const found = AI_PROVIDER_PRESETS.find((p) => p.name === presetName);
    if (found) {
      setDraft((prev) => ({
        ...prev,
        providerName: found.name,
        baseUrl: found.baseUrl,
        model: found.models[0],
      }));
      setTestState({ status: "idle" });
    }
  };

  const handleTestConnection = async () => {
    triggerHaptic(10);
    setTestState({ status: "testing" });
    const res = await testAiConnection(draft);
    if (res.ok) {
      setTestState({
        status: "success",
        message: `连接正常 (${res.latencyMs}ms)`,
      });
    } else {
      setTestState({
        status: "error",
        message: res.error || "连接失败",
      });
    }
  };

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(10);
    onSaveAiConfig(draft);
    setNotice("设置已保存");
    setTimeout(() => setNotice(null), 2000);
  };

  const handleExportJson = () => {
    triggerHaptic(10);
    const dataStr = JSON.stringify(memories, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memories-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`已导出 ${memories.length} 条记录`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("备份文件超过 50MB 安全限制");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const sanitized = sanitizeImportedMemories(parsed);
        if (sanitized.length === 0) {
          alert("未检测到合法的便签记录，请检查备份文件格式");
          return;
        }
        onImportMemories(sanitized, importMode);
        setNotice(`已安全校验并导入 ${sanitized.length} 条记录`);
      } catch {
        alert("文件格式有误");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FBF6E9] border border-[#DFD2BA] paper-shadow overflow-hidden max-h-[88vh] flex flex-col ${
          isClosing
            ? "modal-sheet-exit"
            : dragY === 0
            ? "modal-sheet-enter"
            : ""
        }`}
      >
        {/* 顶部下拉关闭区域 + 顶栏与 Tab 切换 */}
        <div
          {...headerDragProps}
          className="border-b border-[#E6DBC6] bg-[#F5EDE0] select-none touch-none"
        >
          <div className="pt-2.5 pb-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1.5 rounded-full bg-[#C8BCA8]/85" />
          </div>
          <div className="px-5 pb-3 pt-1 flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EAE0CE]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  setActiveTab("general");
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "general"
                    ? "bg-[#FFFDF8] text-[#2C251E] shadow-2xs"
                    : "text-[#6E6050]"
                }`}
              >
                通用与备份
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  setActiveTab("ai");
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "ai"
                    ? "bg-[#FFFDF8] text-[#2C251E] shadow-2xs"
                    : "text-[#6E6050]"
                }`}
              >
                AI 接口设置
              </button>
            </div>

            <button
              type="button"
              onClick={() => requestClose()}
              className="p-2 rounded-full text-[#7E7060] hover:text-[#2C251E] hover:bg-[#EAE0CC] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div
          ref={bodyScrollRef}
          {...createScrollBodyPullProps(bodyScrollRef)}
          className="p-5 sm:p-6 overflow-y-auto space-y-5 pb-safe"
        >
          {notice && (
            <div className="p-3 rounded-xl bg-[#E8F2E5] border border-[#C6D8C0] text-xs text-[#3B5935] flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {activeTab === "general" ? (
            <div key="tab-general" className="space-y-4 view-transition-enter">
              {/* 视图与氛围主题模式 */}
              <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E2D6BE] space-y-3">
                <div className="text-xs font-semibold text-[#3F3428]">
                  展示方式与灯光氛围
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      onChangeLayoutMode("wall");
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      layoutMode === "wall"
                        ? "bg-[#2C251E] text-[#FBF6E9] border-[#2C251E]"
                        : "bg-[#F6EFE0] text-[#5E5244] border-[#E2D6BE]"
                    }`}
                  >
                    <Compass className="w-4 h-4" />
                    <span>自由便签墙</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      onChangeLayoutMode("masonry");
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      layoutMode === "masonry"
                        ? "bg-[#2C251E] text-[#FBF6E9] border-[#2C251E]"
                        : "bg-[#F6EFE0] text-[#5E5244] border-[#E2D6BE]"
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>瀑布流列表</span>
                  </button>
                </div>

                {onChangeThemeMode && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(8);
                        onChangeThemeMode("daylight");
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        themeMode === "daylight"
                          ? "bg-[#C87D32] text-white border-[#C87D32]"
                          : "bg-[#F6EFE0] text-[#5E5244] border-[#E2D6BE]"
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>日间暖纸模式</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(8);
                        onChangeThemeMode("night_lamp");
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        themeMode === "night_lamp"
                          ? "bg-[#2C251E] text-[#E8C589] border-[#5E4A36]"
                          : "bg-[#F6EFE0] text-[#5E5244] border-[#E2D6BE]"
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>深夜台灯模式</span>
                    </button>
                  </div>
                )}

                {layoutMode === "wall" && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      onAutoArrangeWall();
                      setNotice("已重新排列墙面便签");
                    }}
                    className="w-full py-2 rounded-xl text-xs font-medium bg-[#F4ECE0] hover:bg-[#EAE0CE] text-[#5E4D3B] transition-colors cursor-pointer"
                  >
                    一键整齐重排墙面便签
                  </button>
                )}
              </div>

              {/* 数据导入导出 */}
              <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E2D6BE] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#3F3428]">
                    数据备份
                  </span>
                  <span className="text-xs text-[#8C7E6D]">
                    共 {memories.length} 条记录
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#2C251E] text-[#FBF6E9] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>导出备份</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#EFE7D6] text-[#4A3E31] border border-[#DFD2BA] cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>恢复备份</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-[#6E6050] pt-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                      className="accent-[#6B8065]"
                    />
                    <span>合并导入</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="accent-[#C87D32]"
                    />
                    <span>覆盖导入</span>
                  </label>
                </div>
              </div>

              {/* 版本与在线更新 */}
              <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E2D6BE] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#3F3428]">
                      版本与在线更新
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#EFE7D6] text-[#5E5244]">
                      v{currentVersionInfo.versionName} (Build{" "}
                      {currentVersionInfo.versionCode})
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={checkingUpdate}
                    onClick={async () => {
                      triggerHaptic(8);
                      const saved = saveUpdateConfig(updateConfig);
                      setUpdateConfig(saved);
                      setCheckingUpdate(true);
                      setUpdateCheckMessage(null);
                      const res = await checkForAppUpdate(saved);
                      setCheckingUpdate(false);
                      if (res.error) {
                        setUpdateCheckMessage({
                          type: "error",
                          text: res.error,
                        });
                      } else if (res.hasUpdate && res.latest) {
                        onOpenUpdateModal?.(res.currentVersion, res.latest);
                      } else {
                        setUpdateCheckMessage({
                          type: "info",
                          text: `当前已是最新版本 (v${res.currentVersion})`,
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#2C251E] text-[#FBF6E9] disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        checkingUpdate ? "animate-spin" : ""
                      }`}
                    />
                    <span>{checkingUpdate ? "检查中..." : "检查更新"}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#6E6050] mb-1">
                    GitHub 更新仓库（填入 用户名/仓库名 或完整 GitHub 地址）
                  </label>
                  <input
                    type="text"
                    value={updateConfig.githubRepo}
                    onChange={(e) => {
                      const next = {
                        ...updateConfig,
                        githubRepo: e.target.value,
                      };
                      setUpdateConfig(next);
                      saveUpdateConfig(next);
                    }}
                    placeholder="例如：zhou/vibe-memory-space"
                    className="w-full rounded-xl bg-[#FBF6E9] border border-[#DFD2BA] px-3 py-2 text-xs font-mono text-[#2C251E] placeholder:text-[#A39584] focus:outline-none focus:border-[#5C7457]"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-[#5E5244] pt-0.5 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateConfig.autoCheckOnLaunch}
                      onChange={(e) => {
                        const next = {
                          ...updateConfig,
                          autoCheckOnLaunch: e.target.checked,
                        };
                        setUpdateConfig(next);
                        saveUpdateConfig(next);
                      }}
                      className="rounded accent-[#496044]"
                    />
                    <span>启动时自动检测更新</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateConfig.useMirror}
                      onChange={(e) => {
                        const next = {
                          ...updateConfig,
                          useMirror: e.target.checked,
                        };
                        setUpdateConfig(next);
                        saveUpdateConfig(next);
                      }}
                      className="rounded accent-[#496044]"
                    />
                    <span>国内镜像加速下载</span>
                  </label>
                </div>

                {updateCheckMessage && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-1.5 ${
                      updateCheckMessage.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-[#E8F2E5] text-[#3B5935] border border-[#C6D8C0]"
                    }`}
                  >
                    {updateCheckMessage.type === "error" ? (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{updateCheckMessage.text}</span>
                  </div>
                )}
              </div>

              {/* 安卓桌面安装（如可用） */}
              {canInstallPwa && onTriggerInstallPwa && (
                <button
                  type="button"
                  onClick={onTriggerInstallPwa}
                  className="w-full py-3 rounded-2xl text-xs font-semibold bg-[#496044] text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>安装到手机主屏幕</span>
                </button>
              )}

              {/* 重置示例 */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemo();
                    requestClose();
                  }}
                  className="inline-flex items-center gap-1 text-xs text-[#8C7E6D] hover:text-red-700 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>恢复初始示例数据</span>
                </button>
              </div>
            </div>
          ) : (
            <form
              key="tab-ai"
              onSubmit={handleSaveAi}
              className="space-y-4 view-transition-enter"
            >
              {/* 服务商预设 */}
              <div>
                <label className="block text-xs font-semibold text-[#5E5244] mb-1.5">
                  服务商
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AI_PROVIDER_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(preset.name)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                        draft.providerName === preset.name
                          ? "bg-[#FFFDF8] border-[#5C7457] text-[#3B4F37] font-semibold"
                          : "bg-[#F3ECE0] border-[#E2D6BE] text-[#6E6050]"
                      }`}
                    >
                      <div className="truncate">{preset.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 接口地址 & API Key */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5E5244] mb-1">
                    接口地址 (Base URL)
                  </label>
                  <input
                    type="text"
                    value={draft.baseUrl}
                    onChange={(e) =>
                      setDraft({ ...draft, baseUrl: e.target.value })
                    }
                    placeholder="https://api.deepseek.com"
                    className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] px-3 py-2 text-xs font-mono text-[#2C251E] focus:outline-none focus:border-[#5C7457]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#5E5244]">
                      API Key（仅保存在本机，绝不上传第三方）
                    </label>
                    {draft.apiKey && (
                      <button
                        type="button"
                        onClick={() => {
                          const cleared = { ...draft, apiKey: "" };
                          setDraft(cleared);
                          onSaveAiConfig(cleared);
                          setNotice("已清除本机保存的 API Key");
                        }}
                        className="text-[11px] text-red-700 hover:underline cursor-pointer"
                      >
                        清除本机 Key
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={draft.apiKey}
                      onChange={(e) =>
                        setDraft({ ...draft, apiKey: e.target.value.trim() })
                      }
                      placeholder="填入你的 sk-... 密钥"
                      className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] pl-3 pr-9 py-2 text-xs font-mono text-[#2C251E] focus:outline-none focus:border-[#5C7457]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7E6D] cursor-pointer"
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5E5244] mb-1">
                    模型名称
                  </label>
                  <input
                    type="text"
                    value={draft.model}
                    onChange={(e) =>
                      setDraft({ ...draft, model: e.target.value.trim() })
                    }
                    className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] px-3 py-2 text-xs font-mono text-[#2C251E] focus:outline-none focus:border-[#5C7457]"
                  />
                  {currentPreset && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {currentPreset.models.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDraft({ ...draft, model: m })}
                          className={`text-[11px] px-2 py-0.5 rounded font-mono cursor-pointer ${
                            draft.model === m
                              ? "bg-[#496044] text-white"
                              : "bg-[#EFE7D6] text-[#5E5244]"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 连接方式与思考模式 */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F4EFE2] border border-[#E2D8C3] flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#5E5244] font-medium">请求通道：</span>
                  {(
                    [
                      { id: "direct", label: "直连" },
                      { id: "auto", label: "自动" },
                      { id: "server", label: "代理" },
                    ] as { id: AiConnectionMode; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, connectionMode: item.id })
                      }
                      className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                        (draft.connectionMode || "direct") === item.id
                          ? "bg-[#2C251E] text-[#FBF6E9]"
                          : "bg-[#FFFDF8] text-[#6E6050]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-1.5 text-xs text-[#2C251E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.enableThinking}
                    onChange={(e) =>
                      setDraft({ ...draft, enableThinking: e.target.checked })
                    }
                    className="rounded accent-[#496044]"
                  />
                  <span>深度思考</span>
                </label>
              </div>

              {/* 提示词 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#5E5244]">
                    提炼提示词
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, systemPrompt: DEFAULT_SYSTEM_PROMPT })
                    }
                    className="text-[11px] text-[#7D7060] underline cursor-pointer"
                  >
                    恢复默认
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={draft.systemPrompt}
                  onChange={(e) =>
                    setDraft({ ...draft, systemPrompt: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#FFFDF8] border border-[#DFD2BA] p-2.5 text-xs text-[#3F352B] leading-relaxed focus:outline-none"
                />
              </div>

              {/* 测试连接与保存 */}
              <div className="pt-2 border-t border-[#E6DBC6] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testState.status === "testing"}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium bg-[#E8EFE5] text-[#3F563A] cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {testState.status === "testing" ? "测试中..." : "测试连接"}
                    </span>
                  </button>
                  {testState.status === "success" && (
                    <span className="text-xs text-[#3F6238]">
                      {testState.message}
                    </span>
                  )}
                  {testState.status === "error" && (
                    <span className="text-xs text-red-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {testState.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#2C251E] text-[#FBF6E9] cursor-pointer"
                >
                  保存
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
