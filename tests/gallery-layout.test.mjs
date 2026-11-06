import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetBalancedRows } from '../src/GalleryFeature/layout.js';
import { GetPreviewBounds } from '../src/ImagePreviewFeature/geometry.js';

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 构造带稳定身份的合成图片，用于检查保序与分行结果。
function GetImages(ratios) {
  return ratios.map((ratio, index) => ({ id: index, width: ratio * 100, height: 100 }));
}

test('四张同尺寸竖图排成2×2，不再出现三张加一张', () => {
  const images = GetImages([.5625, .5625, .5625, .5625]);
  const rows = GetBalancedRows(images);

  assert.deepEqual(rows.map(row => row.length), [2, 2]);
  assert.deepEqual(rows.flat(), images);
});

test('不同数量均不丢图、不重排，每行最多三张', () => {
  for (let count = 1; count <= 30; count++) {
    const images = GetImages(Array.from({ length: count }, (_, index) => [.5, 1.5, .75, 2][index % 4]));
    const rows = GetBalancedRows(images);

    assert.equal(rows.length, Math.ceil(count / 3));
    assert.deepEqual(rows.flat(), images);
    assert.ok(rows.every(row => row.length >= 1 && row.length <= 3));
  }
});

test('常见竖图数量优先均衡分行，末行不独占撑满', () => {
  for (const [count, expected] of [[5, [3, 2]], [7, [3, 2, 2]], [10, [3, 3, 2, 2]]]) {
    const rows = GetBalancedRows(GetImages(Array(count).fill(.5)));

    assert.deepEqual(rows.map(row => row.length), expected);
  }
});

test('共同参考比例和留缝使每行不溢出且缩略图高度一致', () => {
  const rows = GetBalancedRows(GetImages([.5, .6, 2, .7, 1.5, .4, .8]));
  const reference = Math.max(...rows.map(row => row.reduce((sum, image) => sum + image.width / image.height, 0)));
  const gapBudget = (Math.max(...rows.map(row => row.length)) - 1) * 3;

  for (const containerWidth of [66, 160, 450, 920]) {
    const targetHeight = (containerWidth - gapBudget) / reference;

    for (const row of rows) {
      const widths = row.map(image => (containerWidth - gapBudget) * (image.width / image.height) / reference);

      assert.ok(widths.reduce((sum, width) => sum + width, 0) + (row.length - 1) * 3 <= containerWidth + .001);
      row.forEach((image, index) => assert.ok(Math.abs(widths[index] / (image.width / image.height) - targetHeight) < .001));
    }
  }
});

test('悬停大图按原比例避开缩略图，并保持在视口内', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    for (const anchor of [
      { left: 16, top: 100, right: 130, bottom: 300 },
      { left: viewport.width - 130, top: 100, right: viewport.width - 16, bottom: 300 },
      { left: 20, top: viewport.height - 160, right: 180, bottom: viewport.height - 20 }
    ]) {
      for (const ratio of [.1, .5625, 1, 2, 10]) {
        const bounds = GetPreviewBounds(anchor, { width: ratio * 100, height: 100 }, viewport);

        assert.ok(bounds.left >= 0 && bounds.top >= 0);
        assert.ok(bounds.left + bounds.width <= viewport.width + .001);
        assert.ok(bounds.top + bounds.height <= viewport.height + .001);
        assert.ok(Math.abs(bounds.width / bounds.height - ratio) < .001);
        assert.ok(bounds.left >= anchor.right || bounds.left + bounds.width <= anchor.left || bounds.top >= anchor.bottom || bounds.top + bounds.height <= anchor.top);
      }
    }
  }
});

test('缩略图占满窗口时，预览仍限制在窗口内', () => {
  const bounds = GetPreviewBounds({ left: 0, top: 0, right: 390, bottom: 844 }, { width: 500, height: 800 }, { width: 390, height: 844 });

  assert.ok(bounds.left >= 12 && bounds.top >= 12);
  assert.ok(bounds.left + bounds.width <= 378);
  assert.ok(bounds.top + bounds.height <= 832);
});
