// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 优先选择缩略图周围能放下最大完整图片的区域，所有结果都限制在视口内。
export function GetPreviewBounds(anchor, image, viewport) {
  const margin = Math.min(12, viewport.width / 4, viewport.height / 4);
  const gap = 16;
  const maxWidth = Math.min(440, viewport.width - margin * 2);
  const maxHeight = Math.min(640, viewport.height * .8, viewport.height - margin * 2);
  const regions = [
    { side: 'right', width: viewport.width - anchor.right - gap - margin, height: maxHeight },
    { side: 'left', width: anchor.left - gap - margin, height: maxHeight },
    { side: 'bottom', width: maxWidth, height: viewport.height - anchor.bottom - gap - margin },
    { side: 'top', width: maxWidth, height: anchor.top - gap - margin }
  ];
  let best = null;

  // 预览只计算一次位置，不随鼠标移动；留少量侧边优先权，避免无意义的上下切换。
  for (const region of regions) {
    if (region.width <= 0 || region.height <= 0) continue;

    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, region.width / image.width, region.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const score = width * height * (region.side === 'right' || region.side === 'left' ? 1.05 : 1);

    if (!best || score > best.score) best = { side: region.side, width, height, score };
  }

  // 缩略图占满视口时允许浮层重叠；它不接收指针，因此仍可点击原缩略图复制。
  if (!best) {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

    best = { side: 'center', width: image.width * scale, height: image.height * scale };
  }

  let left = (anchor.left + anchor.right - best.width) / 2;
  let top = (anchor.top + anchor.bottom - best.height) / 2;

  if (best.side === 'right') left = anchor.right + gap;
  if (best.side === 'left') left = anchor.left - gap - best.width;
  if (best.side === 'bottom') top = anchor.bottom + gap;
  if (best.side === 'top') top = anchor.top - gap - best.height;

  return {
    left: Math.max(margin, Math.min(left, viewport.width - margin - best.width)),
    top: Math.max(margin, Math.min(top, viewport.height - margin - best.height)),
    width: best.width,
    height: best.height
  };
}
