// 图片路径只允许应用生成的文件名，阻止跨域图片、目录穿越与脚本格式。
const imagePathPattern = /^images\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 规范化仓库标识，真实地址仅在运行时输入或由部署环境提供。
export function GetRepository(value) {
  const repository = String(value).trim();

  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repository) || repository.endsWith('/..') || repository.endsWith('/.')) {
    throw new Error('请填写 owner/repository 格式的 GitHub 仓库。');
  }

  return repository;
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 校验远端数据，不把损坏或未知版本的收藏当作空库覆盖。
export function GetCatalog(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.entries)) {
    throw new Error('收藏数据格式不正确，已停止读取，原数据不会被覆盖。');
  }

  const identifiers = new Set();
  const imagePaths = new Set();

  for (const entry of value.entries) {
    if (!entry || typeof entry.id !== 'string' || !/^[a-f0-9-]{36}$/.test(entry.id) || identifiers.has(entry.id) || typeof entry.prompt !== 'string' || !entry.prompt.trim() || entry.prompt.length > 100000 || !Array.isArray(entry.images) || entry.images.length < 1 || entry.images.length > 30) {
      throw new Error('收藏记录不完整或重复，请先检查远端数据。');
    }

    identifiers.add(entry.id);

    for (const image of entry.images) {
      if (!image || typeof image.path !== 'string' || !imagePathPattern.test(image.path) || imagePaths.has(image.path) || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) {
        throw new Error('收藏包含无效图片记录，已停止读取。');
      }

      imagePaths.add(image.path);
    }
  }

  return value;
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 只在目标记录未被其他设备修改时合并，保留其他组的新修改。
export function GetMergedCatalog(catalog, original, replacement) {
  const current = original ? catalog.entries.find(entry => entry.id === original.id) : null;

  if (original && JSON.stringify(current) !== JSON.stringify(original)) {
    throw new Error('这一组已在其他页面修改。请保留当前提示词，关闭弹窗并刷新后再编辑。');
  }

  if (!original && replacement && catalog.entries.some(entry => entry.id === replacement.id)) {
    throw new Error('此记录已经存在，请刷新确认上次保存结果。');
  }

  const entries = original
    ? catalog.entries.flatMap(entry => entry.id === original.id ? (replacement ? [replacement] : []) : [entry])
    : [replacement, ...catalog.entries];

  return GetCatalog({ version: 1, entries });
}
