"use client";

import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import {
  X,
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  GeneratedPosterPayload,
  POSTER_GENERATED_EVENT,
} from "@/utils/posterExport";
import { AppUpdaterNative } from "@/utils/appUpdater";
import { triggerHaptic } from "@/utils/storageDb";

export default function PosterPreviewModal() {
  const [poster, setPoster] = useState<GeneratedPosterPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEv = e as CustomEvent<GeneratedPosterPayload>;
      if (customEv.detail?.dataUrl) {
        setPoster(customEv.detail);
        setFeedback(null);
      }
    };
    window.addEventListener(POSTER_GENERATED_EVENT, handleEvent);
    return () => {
      window.removeEventListener(POSTER_GENERATED_EVENT, handleEvent);
    };
  }, []);

  if (!poster) return null;

  const handleSaveToGallery = async () => {
    if (saving) return;
    triggerHaptic(10);
    setSaving(true);
    setFeedback(null);

    try {
      if (Capacitor.isNativePlatform()) {
        const res = await AppUpdaterNative.saveImageToGallery({
          base64Data: poster.dataUrl,
          fileName: poster.fileName,
        });
        if (res.saved) {
          setFeedback({
            type: "success",
            text: "已保存到手机系统相册「记忆手账」相簿，打开微信即可直接发朋友圈！",
          });
        }
      } else {
        const a = document.createElement("a");
        a.href = poster.dataUrl;
        a.download = poster.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setFeedback({
          type: "success",
          text: "高清拍立得海报已下载保存！",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "保存失败，可尝试点击右侧「系统分享」或长按图片",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleShareNative = async () => {
    if (sharing) return;
    triggerHaptic(10);
    setSharing(true);
    setFeedback(null);

    try {
      if (Capacitor.isNativePlatform()) {
        await AppUpdaterNative.shareImage({
          base64Data: poster.dataUrl,
          fileName: poster.fileName,
          title: poster.title,
        });
      } else {
        // 浏览器端优先尝试 Web Share API，不支持则直接触发下载
        const res = await fetch(poster.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], poster.fileName, { type: "image/png" });
        if (
          typeof navigator !== "undefined" &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            files: [file],
            title: poster.title,
          });
        } else {
          await handleSaveToGallery();
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setFeedback({
          type: "error",
          text: err?.message || "调起分享面板失败，请先点击「保存到相册」",
        });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      onClick={() => setPoster(null)}
      className="fixed inset-0 z-[70] bg-[#1E1711]/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#FBF6E9] border border-[#DFD2BA] paper-shadow overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* 顶栏 */}
        <div className="px-5 py-3.5 bg-[#F4ECE0] border-b border-[#E5D8C1] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C87D32]" />
            <h3 className="font-serif-notebook text-sm font-bold text-[#2C251E]">
              拍立得分享海报已生成
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setPoster(null)}
            className="p-1.5 rounded-full text-[#7E7060] hover:text-[#2C251E] hover:bg-[#E6DAC4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 海报预览区 */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-[#EFE6D5]/60">
          <img
            src={poster.dataUrl}
            alt={poster.title}
            className="max-h-[54vh] w-auto rounded-2xl shadow-lg border border-[#E2D6BE] object-contain"
          />
        </div>

        {/* 底部操作区 */}
        <div className="p-4 bg-[#FBF6E9] border-t border-[#E5D8C1] space-y-3 pb-safe">
          {feedback && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-start gap-1.5 ${
                feedback.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-[#E8F2E5] text-[#3B5935] border border-[#C6D8C0]"
              }`}
            >
              {feedback.type === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#496044]" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleSaveToGallery}
              disabled={saving}
              className="py-3 px-3 rounded-2xl text-xs font-semibold bg-[#496044] hover:bg-[#3D5239] disabled:opacity-60 text-white flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{saving ? "保存中..." : "保存到手机相册"}</span>
            </button>

            <button
              type="button"
              onClick={handleShareNative}
              disabled={sharing}
              className="py-3 px-3 rounded-2xl text-xs font-semibold bg-[#2C251E] hover:bg-[#3D332A] disabled:opacity-60 text-[#FBF6E9] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#E8C589]" />
              <span>{sharing ? "调起中..." : "转发微信 / 朋友圈"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
