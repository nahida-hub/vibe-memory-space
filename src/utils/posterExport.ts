import { MemoryCard, PaperColor, PosterTemplate } from "@/types/memory";

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
  card: MemoryCard;
  template: PosterTemplate;
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

function drawPhotoCollage(
  ctx: CanvasRenderingContext2D,
  loadedImages: HTMLImageElement[],
  totalRawCount: number,
  leftX: number,
  curY: number,
  contentWidth: number,
  photoHeight: number,
  radius = 18
) {
  const imgCount = loadedImages.length;
  if (imgCount === 0 || photoHeight <= 0) return;
  const gap = 14;
  if (imgCount === 1) {
    drawCoverImageCell(
      ctx,
      loadedImages[0],
      leftX,
      curY,
      contentWidth,
      photoHeight,
      radius
    );
  } else if (imgCount === 2) {
    const cellW = Math.floor((contentWidth - gap) / 2);
    drawCoverImageCell(
      ctx,
      loadedImages[0],
      leftX,
      curY,
      cellW,
      photoHeight,
      radius
    );
    drawCoverImageCell(
      ctx,
      loadedImages[1],
      leftX + cellW + gap,
      curY,
      cellW,
      photoHeight,
      radius
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
      radius
    );
    drawCoverImageCell(
      ctx,
      loadedImages[1],
      leftX,
      curY + topH + gap,
      botW,
      botH,
      radius - 2
    );
    drawCoverImageCell(
      ctx,
      loadedImages[2],
      leftX + botW + gap,
      curY + topH + gap,
      botW,
      botH,
      radius - 2
    );
  } else {
    const cellW = Math.floor((contentWidth - gap) / 2);
    const cellH = Math.floor((photoHeight - gap) / 2);
    const extra = Math.max(0, totalRawCount - 4);
    drawCoverImageCell(
      ctx,
      loadedImages[0],
      leftX,
      curY,
      cellW,
      cellH,
      radius - 2
    );
    drawCoverImageCell(
      ctx,
      loadedImages[1],
      leftX + cellW + gap,
      curY,
      cellW,
      cellH,
      radius - 2
    );
    drawCoverImageCell(
      ctx,
      loadedImages[2],
      leftX,
      curY + cellH + gap,
      cellW,
      cellH,
      radius - 2
    );
    drawCoverImageCell(
      ctx,
      loadedImages[3],
      leftX + cellW + gap,
      curY + cellH + gap,
      cellW,
      cellH,
      radius - 2,
      extra
    );
  }
}

function parseDateParts(card: MemoryCard): {
  yearMonth: string;
  day: string;
  weekday: string;
} {
  const raw = card.dateLabel || "";
  const [datePart = "2026.11.09", weekPart = "记忆日签"] = raw
    .split("·")
    .map((s) => s.trim());
  const segs = datePart.split(".");
  if (segs.length >= 3) {
    return {
      yearMonth: `${segs[0]}.${segs[1]}`,
      day: segs[2].padStart(2, "0"),
      weekday: weekPart,
    };
  }
  return {
    yearMonth: "2026.11",
    day: "09",
    weekday: weekPart || "日常",
  };
}

/**
 * 根据指定版式 ("polaroid" | "cinema" | "ticket") 渲染高清海报并返回 PNG DataURL
 */
export async function renderPosterDataUrl(
  card: MemoryCard,
  template: PosterTemplate = "polaroid"
): Promise<string | null> {
  const canvasWidth = 1080;
  const padX = 92;
  const cardWidth = canvasWidth - padX * 2; // 896px
  const innerPad = 64;
  const contentWidth = cardWidth - innerPad * 2; // 768px

  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) return null;

  const rawImages = card.images || [];
  const loadedImages = (
    await Promise.all(rawImages.slice(0, 4).map(loadImageElement))
  ).filter((img): img is HTMLImageElement => img !== null);

  const imgCount = loadedImages.length;
  const photoHeight =
    imgCount === 0
      ? 0
      : imgCount === 1
      ? Math.round(contentWidth * 0.7)
      : imgCount === 2
      ? Math.round(contentWidth * 0.56)
      : Math.round(contentWidth * 0.8);

  const headlineText =
    card.type === "ai_insight"
      ? `“${card.summary || card.rawContent.slice(0, 36)}”`
      : card.title || "";

  mCtx.font = 'bold 42px "Songti SC", "Noto Serif SC", Georgia, serif';
  const headlineLines = headlineText
    ? wrapTextLines(mCtx, headlineText, contentWidth, 4)
    : [];

  mCtx.font = '28px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
  const bodyLines = wrapTextLines(mCtx, card.rawContent, contentWidth, 16);

  const headlineHeight = headlineLines.length * 60;
  const bodyHeight = bodyLines.length * 46;

  // ========== 版式 1：经典拍立得 (polaroid) ==========
  if (template === "polaroid") {
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
    if (!ctx) return null;

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

    if (imgCount > 0 && photoHeight > 0) {
      drawPhotoCollage(
        ctx,
        loadedImages,
        rawImages.length,
        leftX,
        curY,
        contentWidth,
        photoHeight,
        18
      );
      curY += photoHeight + 48;
    }

    if (headlineLines.length > 0) {
      ctx.font = 'bold 42px "Songti SC", "Noto Serif SC", Georgia, serif';
      ctx.fillStyle = "#2A231C";
      for (const line of headlineLines) {
        curY += 54;
        ctx.fillText(line, leftX, curY);
      }
      curY += 34;
    }

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

    return canvas.toDataURL("image/png");
  }

  // ========== 版式 2：电影感日签 (cinema) ==========
  if (template === "cinema") {
    const headerBlockH = 136;
    const cardHeight =
      innerPad +
      headerBlockH +
      (photoHeight > 0 ? photoHeight + 48 : 0) +
      (headlineHeight > 0 ? headlineHeight + 36 : 0) +
      bodyHeight +
      130 +
      innerPad;

    const canvasHeight = Math.max(cardHeight + 210, 1220);
    const cardX = padX;
    const cardY = Math.round((canvasHeight - cardHeight) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 暗调胡桃木影院底色 + 暖光晕
    ctx.fillStyle = "#16120F";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const radGrad = ctx.createRadialGradient(
      canvasWidth * 0.5,
      canvasHeight * 0.3,
      40,
      canvasWidth * 0.5,
      canvasHeight * 0.45,
      canvasWidth * 0.75
    );
    radGrad.addColorStop(0, "rgba(224, 168, 92, 0.16)");
    radGrad.addColorStop(1, "rgba(22, 18, 15, 0)");
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 胶片日签主体框
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 24;
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
    ctx.fillStyle = "#221C17";
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
    ctx.strokeStyle = "#4E3E2E";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    const leftX = cardX + innerPad;
    let curY = cardY + innerPad;

    // 顶部大号日历数字与电影场记信息
    const { yearMonth, day, weekday } = parseDateParts(card);
    ctx.font = 'bold 86px "Songti SC", Georgia, serif';
    ctx.fillStyle = "#E8C589";
    ctx.fillText(day, leftX, curY + 74);

    const dayW = ctx.measureText(day).width;
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#C9B393";
    ctx.fillText(yearMonth, leftX + dayW + 22, curY + 38);

    ctx.font = '24px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = "#9C8970";
    ctx.fillText(
      `${weekday}${card.location ? ` · ${card.location}` : ""}`,
      leftX + dayW + 22,
      curY + 72
    );

    // 右上角金色铭牌
    const badgeLabel =
      card.type === "ai_insight"
        ? "INSIGHT · 灵感帧"
        : card.type === "exhibition"
        ? "SCENE · 现场帧"
        : "HIGHLIGHT · 高光帧";
    ctx.font = "bold 20px monospace";
    const bw = ctx.measureText(badgeLabel).width + 32;
    drawRoundedRect(
      ctx,
      leftX + contentWidth - bw,
      curY + 20,
      bw,
      42,
      21
    );
    ctx.fillStyle = "rgba(232, 197, 137, 0.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 197, 137, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#E8C589";
    ctx.fillText(badgeLabel, leftX + contentWidth - bw + 16, curY + 48);

    // 分割金线
    curY += 108;
    ctx.strokeStyle = "rgba(232, 197, 137, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX, curY);
    ctx.lineTo(leftX + contentWidth, curY);
    ctx.stroke();
    curY += 32;

    if (imgCount > 0 && photoHeight > 0) {
      drawPhotoCollage(
        ctx,
        loadedImages,
        rawImages.length,
        leftX,
        curY,
        contentWidth,
        photoHeight,
        14
      );
      curY += photoHeight + 46;
    }

    if (headlineLines.length > 0) {
      // 左侧琥珀金竖线装饰
      ctx.fillStyle = "#D4892A";
      ctx.fillRect(leftX, curY + 12, 6, headlineLines.length * 54 - 8);

      ctx.font = 'bold 40px "Songti SC", "Noto Serif SC", Georgia, serif';
      ctx.fillStyle = "#F7EFE2";
      for (const line of headlineLines) {
        curY += 54;
        ctx.fillText(line, leftX + 24, curY);
      }
      curY += 32;
    }

    ctx.font = '28px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#CFC0AC";
    for (const line of bodyLines) {
      curY += 46;
      if (line) {
        ctx.fillText(line, leftX, curY);
      }
    }

    // 底部电影字幕感底栏
    const footerY = cardY + cardHeight - innerPad;
    ctx.strokeStyle = "rgba(232, 197, 137, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX, footerY - 42);
    ctx.lineTo(leftX + contentWidth, footerY - 42);
    ctx.stroke();

    ctx.font = '23px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = "#D49B4B";
    const tagsStr = card.tags.map((t) => `#${t}`).join("  ");
    ctx.fillText(tagsStr, leftX, footerY);

    ctx.font = "21px monospace";
    ctx.fillStyle = "#857461";
    const brandText = "VIBE MEMORY · 记忆手账";
    const brandW = ctx.measureText(brandText).width;
    ctx.fillText(brandText, leftX + contentWidth - brandW, footerY);

    return canvas.toDataURL("image/png");
  }

  // ========== 版式 3：展览纪念票根 (ticket) ==========
  const topHeaderH = 110;
  const stubHeight = 165;
  const mainBodyH =
    topHeaderH +
    40 +
    (photoHeight > 0 ? photoHeight + 44 : 0) +
    (headlineHeight > 0 ? headlineHeight + 32 : 0) +
    bodyHeight +
    70;
  const cardHeight = mainBodyH + stubHeight;
  const canvasHeight = Math.max(cardHeight + 220, 1220);
  const cardX = padX;
  const cardY = Math.round((canvasHeight - cardHeight) / 2);
  const stubY = cardY + mainBodyH;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 亚麻展览底色
  const bgHex = "#EAE0CE";
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 票根主体白卡
  ctx.save();
  ctx.shadowColor = "rgba(54, 40, 24, 0.16)";
  ctx.shadowBlur = 38;
  ctx.shadowOffsetY = 16;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
  ctx.fillStyle = "#FFFDF8";
  ctx.fill();
  ctx.restore();

  // 顶部复古色块眉头
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardWidth, topHeaderH, 28);
  ctx.fillStyle = "#2C251E";
  ctx.fill();
  ctx.fillRect(cardX, cardY + topHeaderH - 28, cardWidth, 28);
  ctx.restore();

  const leftX = cardX + innerPad;
  ctx.font = "bold 24px monospace";
  ctx.fillStyle = "#E8C589";
  ctx.fillText("ADMIT ONE · 记忆手账珍藏票根", leftX, cardY + 52);

  ctx.font = "21px monospace";
  ctx.fillStyle = "#A89882";
  ctx.fillText(
    `NO. ${card.id.slice(-6).toUpperCase()}  |  ${card.dateLabel}`,
    leftX,
    cardY + 86
  );

  let curY = cardY + topHeaderH + 40;

  if (imgCount > 0 && photoHeight > 0) {
    drawPhotoCollage(
      ctx,
      loadedImages,
      rawImages.length,
      leftX,
      curY,
      contentWidth,
      photoHeight,
      14
    );
    curY += photoHeight + 44;
  }

  if (headlineLines.length > 0) {
    ctx.font = 'bold 42px "Songti SC", "Noto Serif SC", Georgia, serif';
    ctx.fillStyle = "#2A231C";
    for (const line of headlineLines) {
      curY += 54;
      ctx.fillText(line, leftX, curY);
    }
    curY += 30;
  }

  ctx.font = '28px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillStyle = "#4A4035";
  for (const line of bodyLines) {
    curY += 46;
    if (line) {
      ctx.fillText(line, leftX, curY);
    }
  }

  // 撕票虚线与左右半圆齿孔缺口
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "#CBBBA2";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 36, stubY);
  ctx.lineTo(cardX + cardWidth - 36, stubY);
  ctx.stroke();
  ctx.restore();

  // 左右两侧半圆打孔缺口
  const notchR = 26;
  ctx.fillStyle = bgHex;
  ctx.beginPath();
  ctx.arc(cardX, stubY, notchR, 0, Math.PI * 2);
  ctx.arc(cardX + cardWidth, stubY, notchR, 0, Math.PI * 2);
  ctx.fill();

  // 右下角复古朱砂印章
  ctx.save();
  ctx.translate(cardX + cardWidth - 155, stubY - 58);
  ctx.rotate(-0.18);
  ctx.strokeStyle = "rgba(196, 78, 52, 0.72)";
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, -84, -30, 168, 60, 10);
  ctx.stroke();
  ctx.font = 'bold 22px "Songti SC", serif';
  ctx.fillStyle = "rgba(196, 78, 52, 0.78)";
  ctx.fillText("已珍藏 · 记忆库", -70, 8);
  ctx.restore();

  // 副券底部：左侧仿真条形码 + 右侧地点与标签
  const barY = stubY + 40;
  let barX = leftX;
  const barPattern = [4, 2, 6, 3, 2, 5, 2, 4, 7, 2, 3, 5, 2, 4, 3, 6, 2, 4];
  ctx.fillStyle = "#3A3128";
  for (let i = 0; i < barPattern.length; i++) {
    const w = barPattern[i];
    if (i % 2 === 0) {
      ctx.fillRect(barX, barY, w, 74);
    }
    barX += w + 4;
  }
  ctx.font = "18px monospace";
  ctx.fillStyle = "#8C7D6B";
  ctx.fillText(`*${card.id.slice(-8).toUpperCase()}*`, leftX, barY + 96);

  // 副券右侧文字
  const rightInfoX = leftX + 210;
  ctx.font = 'bold 26px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = "#2C251E";
  ctx.fillText(
    card.location || "个人记忆与灵感手账馆",
    rightInfoX,
    barY + 34
  );

  ctx.font = '23px -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = "#7D7060";
  const tagsStr = card.tags.map((t) => `#${t}`).join("  ");
  ctx.fillText(tagsStr, rightInfoX, barY + 76);

  return canvas.toDataURL("image/png");
}

/**
 * 将单张便签渲染为高清分享卡片图并唤起预览/切换版式弹窗
 */
export async function exportCardAsPolaroidImage(
  card: MemoryCard,
  template: PosterTemplate = "polaroid"
): Promise<boolean> {
  try {
    const dataUrl = await renderPosterDataUrl(card, template);
    if (!dataUrl) return false;
    const fileName = `记忆手账-${template}-${card.id.slice(-6)}.png`;
    const title = card.title || card.summary || "记忆手账分享卡";

    if (typeof window !== "undefined") {
      const payload: GeneratedPosterPayload = {
        dataUrl,
        fileName,
        title,
        card,
        template,
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
