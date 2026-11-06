// 固定图标路径，不接收远端 HTML，避免提示词或仓库内容变成可执行标记。
const paths = {
  settings: '<path d="M12 8v8m-4-4h8"/><rect x="4" y="4" width="16" height="16" rx="5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>'
};

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 创建仅包含本地常量的 SVG；调用方设置可访问名称。
export function GetIcon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
