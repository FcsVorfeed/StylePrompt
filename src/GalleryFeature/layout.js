// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 保留上传顺序，在相同总行数内平衡各行比例总和，避免机械的三张加一张。
export function GetBalancedRows(images) {
  const rowCount = Math.ceil(images.length / 3);
  const ratios = images.map(image => image.width / image.height);
  const targetRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / rowCount;
  const costs = Array.from({ length: rowCount + 1 }, () => Array(images.length + 1).fill(Infinity));
  const choices = Array.from({ length: rowCount + 1 }, () => Array(images.length + 1).fill(0));

  costs[0][images.length] = 0;

  // 最多三张一行；倒序尝试使等价划分优先把较完整的一行放在前面。
  for (let remaining = 1; remaining <= rowCount; remaining++) {
    for (let start = images.length - 1; start >= 0; start--) {
      for (let count = Math.min(3, images.length - start); count >= 1; count--) {
        const ratio = ratios.slice(start, start + count).reduce((sum, value) => sum + value, 0);
        const cost = ((ratio - targetRatio) / targetRatio) ** 2 + costs[remaining - 1][start + count];

        // 等价分行的浮点误差不应改变先排较完整行的顺序。
        if (cost + 1e-9 < costs[remaining][start]) {
          costs[remaining][start] = cost;
          choices[remaining][start] = count;
        }
      }
    }
  }

  const rows = [];
  let offset = 0;

  for (let remaining = rowCount; remaining > 0; remaining--) {
    const count = choices[remaining][offset];

    rows.push(images.slice(offset, offset + count));
    offset += count;
  }

  return rows;
}
