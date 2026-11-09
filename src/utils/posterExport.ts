import { MemoryCard, PaperColor } from "@/types/memory";

const PAPER_HEX: Record<
  PaperColor,
  { bg: string; border: string; accent: string }
> = {
  cream: { bg: "#FFFDF6", border: "#E2D6BE", accent: "#5C7457" },
  butter: { bg: "#FDF6D8", border: "#E4D59B", accent: "#B57C1E" },
  sage: { bg: "#ECF3E8", border: "#C8D9C1", accent: "#496044" },
  blush: { bg: "#FBECE9", border: "#E6C7C1", accent: "#B35C52" },
  kraft: { bg: "#EFE1C6", border: "#D4BD94", accent: "#8C5828" },
};

export interface GeneratedPosterPayload {
  dataUrl: string;
  fileName: string;
  title: string;
}

export const POSTER_GENERATED_EVENT = "vibe-poster-generated";

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const timer = setTimeout(() => finish(null), 6000);
    const img = new Image();
    if (src.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      clearTimeout(timer);
      // 检查是否因跨域污染 Canvas，若污染则跳过该外链图以保证整张海报能正常导出
      try {
        const testCanvas = document.createElement("canvas");
        testCanvas.width = 1;
        testCanvas.height = 1;
        const tCtx = testCanvas.getContext("2d");
        if (tCtx) {
          tCtx.drawImage(img, 0, 0, 1, 1);
          testCanvas.toDataURL("image/png");
        }
        finish(img);
      } catch {
        finish(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    img.src = src;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 18
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let currentLine = "";
    for (const char of para) {
      const testLine = currentLine + char;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
        if (lines.length >= maxLines) break;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }
    if (lines.length >= maxLines) {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + "…";
      break;
    }
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCoverImageCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  extraCount = 0
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.clip();

  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let drawW = w;
  let drawH = h;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > boxRatio) {
    drawW = h * imgRatio;
    offsetX = -(drawW - w) / 2;
  } else {
    drawH = w / imgRatio;
    offsetY = -(drawH - h) / 2;
  }

  ctx.drawImage(img, x + offsetX, y + offsetY, drawW, drawH);

  if (extraCount > 0) {
    ctx.fillStyle = "rgba(28, 22, 16, 0.56)";
    ctx.fillRect(x, y, w, h);
    ctx.font = 'bold 44px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = "#FFFDF8";
    const badgeText = `+${extraCount}`;
    const tw = ctx.measureText(badgeText).width;
    ctx.fillText(badgeText, x + (w - tw) / 2, y + h / 2 + 16);
  }

  ctx.restore();
}

/**
 * 将单张便签渲染为高清拍立得/手账分享卡片图 (1080px 宽，支持 1~4+ 多图拼图排版) 并下载或调用系统分享
 */
export async function exportCardAsPolaroidImage(
  card: MemoryCard
): Promise<boolean> {
  const canvasWidth = 1080;
  const padX = 96;
  const cardWidth = canvasWidth - padX * 2; // 888px
  const innerPad = 64;
  const contentWidth = cardWidth - innerPad * 2; // 760px

  // 预测量文本高度
  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) return false;

  // 加载前 4 张照片（如有）
  const rawImages = card.images || [];
  const loadedImages = (
    await Promise.all(rawImages.slice(0, 4).map(loadImageElement))
  ).filter((img): img is HTMLImageElement => img !== null);

  const imgCount = loadedImages.length;
  const photoHeight =
    imgCount === 0
      ? 0
      : imgCount === 1
      ? Math.round(contentWidth * 0.72)
      : imgCount === 2
      ? Math.round(contentWidth * 0.56)
      : Math.round(contentWidth * 0.82);

  // 测量标题 / 金句行数
  const headlineText =
    card.type === "ai_insight"
      ? `“${card.summary || card.rawContent.slice(0, 36)}”`
      : card.title || "";

  mCtx.font = 'bold 42px "Songti SC", "Noto Serif SC", Georgia, serif';
  const headlineLines = headlineText
    ? wrapTextLines(mCtx, headlineText, contentWidth, 4)
    : [];

  // 测量正文行数
  mCtx.font = '28px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
  const bodyLines = wrapTextLines(mCtx, card.rawContent, contentWidth, 16);

  const headlineHeight = headlineLines.length * 60;
  const bodyHeight = bodyLines.length * 46;

  const cardHeight =
    innerPad +
    40 +
    (photoHeight > 0 ? photoHeight + 44 : 0) +
    (headlineHeight > 0 ? headlineHeight + 32 : 0) +
    bodyHeight +
    120 +
    innerPad;

  const canvasHeight = Math.max(cardHeight + 220, 1180);
  const cardX = padX;
  const cardY = Math.round((canvasHeight - cardHeight) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  // 1. 绘制暖色点阵墙面背景
  ctx.fillStyle = "#F6EFE0";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "rgba(148, 126, 96, 0.25)";
  for (let y = 24; y < canvasHeight; y += 36) {
    for (let x = 24; x < canvasWidth; x += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. 绘制便签卡片阴影与纸张底板
  const palette =
    PAPER_HEX[card.paperColor || "cream"] || PAPER_HEX.cream;

  ctx.save();
  ctx.shadowColor = "rgba(52, 38, 22, 0.16)";
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 18;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 36);
  ctx.fillStyle = card.type === "exhibition" ? "#FFFDF9" : palette.bg;
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 36);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // 3. 绘制顶部立体图钉或和纸胶带
  if (card.type === "exhibition") {
    ctx.save();
    ctx.translate(canvasWidth / 2, cardY);
    ctx.rotate(-0.03);
    ctx.fillStyle = "rgba(233, 200, 147, 0.82)";
    ctx.fillRect(-110, -22, 220, 44);
    ctx.restore();
  } else {
    const pinColor =
      card.type === "milestone" ? "#D4892A" : palette.accent;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.arc(canvasWidth / 2, cardY + 6, 18, 0, Math.PI * 2);
    ctx.fillStyle = pinColor;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(canvasWidth / 2 - 5, cardY + 1, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  }

  let curY = cardY + innerPad + 28;
  const leftX = cardX + innerPad;

  // 4. 绘制拍立得照片（支持单图、双拼、三图、四宫格拼图）
  if (imgCount > 0 && photoHeight > 0) {
    const gap = 14;
    if (imgCount === 1) {
      drawCoverImageCell(
        ctx,
        loadedImages[0],
        leftX,
        curY,
        contentWidth,
        photoHeight,
        20
      );
    } else if (imgCount === 2) {
      const cellW = Math.floor((contentWidth - gap) / 2);
      drawCoverImageCell(ctx, loadedImages[0], leftX, curY, cellW, photoHeight, 18);
      drawCoverImageCell(
        ctx,
        loadedImages[1],
        leftX + cellW + gap,
        curY,
        cellW,
        photoHeight,
        18
      );
    } else if (imgCount === 3) {
      const topH = Math.floor(photoHeight * 0.56);
      const botH = photoHeight - topH - gap;
      const botW = Math.floor((contentWidth - gap) / 2);
      drawCoverImageCell(
        ctx,
        loadedImages[0],
        leftX,
        curY,
        contentWidth,
        topH,
        18
      );
      drawCoverImageCell(
        ctx,
        loadedImages[1],
        leftX,
        curY + topH + gap,
        botW,
        botH,
        16
      );
      drawCoverImageCell(
        ctx,
        loadedImages[2],
        leftX + botW + gap,
        curY + topH + gap,
        botW,
        botH,
        16
      );
    } else {
      const cellW = Math.floor((contentWidth - gap) / 2);
      const cellH = Math.floor((photoHeight - gap) / 2);
      const extra = Math.max(0, rawImages.length - 4);
      drawCoverImageCell(ctx, loadedImages[0], leftX, curY, cellW, cellH, 16);
      drawCoverImageCell(
        ctx,
        loadedImages[1],
        leftX + cellW + gap,
        curY,
        cellW,
        cellH,
        16
      );
      drawCoverImageCell(
        ctx,
        loadedImages[2],
        leftX,
        curY + cellH + gap,
        cellW,
        cellH,
        16
      );
      drawCoverImageCell(
        ctx,
        loadedImages[3],
        leftX + cellW + gap,
        curY + cellH + gap,
        cellW,
        cellH,
        16,
        extra
      );
    }
    curY += photoHeight + 48;
  }

  // 5. 绘制金句或标题
  if (headlineLines.length > 0) {
    ctx.font = 'bold 42px "Songti SC", "Noto Serif SC", Georgia, serif';
    ctx.fillStyle = "#2A231C";
    for (const line of headlineLines) {
      curY += 54;
      ctx.fillText(line, leftX, curY);
    }
    curY += 34;
  }

  // 6. 绘制正文与信纸横线
  ctx.font = '28px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillStyle = "#4A4035";
  for (const line of bodyLines) {
    curY += 46;
    ctx.strokeStyle = "rgba(186, 169, 142, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX, curY + 10);
    ctx.lineTo(leftX + contentWidth, curY + 10);
    ctx.stroke();

    if (line) {
      ctx.fillText(line, leftX, curY);
    }
  }

  // 7. 底部标签与日期印记
  const footerY = cardY + cardHeight - innerPad;
  ctx.font = '24px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = "#7D7060";
  const tagsStr = card.tags.map((t) => `#${t}`).join("  ");
  ctx.fillText(tagsStr, leftX, footerY);

  ctx.font = "24px monospace";
  ctx.fillStyle = "#948675";
  const dateText = card.location
    ? `${card.location} · ${card.dateLabel}`
    : card.dateLabel;
  const dateWidth = ctx.measureText(dateText).width;
  ctx.fillText(dateText, leftX + contentWidth - dateWidth, footerY);

  // 8. 生成高清 PNG Base64 并唤起应用内海报预览与原生保存/分享弹窗
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const fileName = `记忆手账-${card.id.slice(-6)}.png`;
    const title = card.title || card.summary || "记忆手账分享卡";

    if (typeof window !== "undefined") {
      const payload: GeneratedPosterPayload = {
        dataUrl,
        fileName,
        title,
      };
      window.dispatchEvent(
        new CustomEvent(POSTER_GENERATED_EVENT, { detail: payload })
      );
    }
    return true;
  } catch (err) {
    console.error("生成分享海报失败:", err);
    return false;
  }
}
