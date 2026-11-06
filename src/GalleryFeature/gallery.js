import { GetIcon } from '../AppSystem/icons.js';
import { GetBalancedRows } from './layout.js';

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 组内保序均衡分行并共用行高，末行保持普通尺寸，不把剩余图片撑成封面。
export function ShowGallery(container, snapshot, store, OnCopy, OnEdit, preview) {
  preview.Hide();
  container.replaceChildren();

  for (const entry of snapshot.catalog.entries) {
    const card = document.createElement('article');
    const weight = entry.images.slice(0, 3).reduce((sum, image) => sum + Math.min(2.5, Math.max(0.45, image.width / image.height)), 0);
    const rows = GetBalancedRows(entry.images);
    const referenceRatio = Math.max(...rows.map(row => row.reduce((sum, image) => sum + image.width / image.height, 0)));
    const rowGap = (Math.max(...rows.map(row => row.length)) - 1) * 3;

    card.className = 'collection';
    card.style.setProperty('--basis', `${Math.max(200, Math.min(660, weight * 190))}px`);
    card.style.setProperty('--row-space', `${rowGap}px`);
    card.setAttribute('aria-label', '一组图片与提示词');

    let imageIndex = 0;

    for (const images of rows) {
      const row = document.createElement('div');

      row.className = 'collection-row';

      for (const image of images) {
        const tile = document.createElement('div');
        const button = document.createElement('button');
        const picture = document.createElement('img');
        const openPreview = document.createElement('button');

        imageIndex++;

        tile.className = 'photo';
        tile.style.setProperty('--ratio', image.width / image.height);
        tile.style.setProperty('--share', (image.width / image.height) / referenceRatio);
        button.className = 'copy-photo';
        button.type = 'button';
        button.title = '复制提示词';
        button.setAttribute('aria-label', `复制第 ${imageIndex} 张图片的提示词`);
        picture.src = store.GetImageUrl(image.path, snapshot.head);
        picture.alt = `收藏图片 ${imageIndex}`;
        picture.width = image.width;
        picture.height = image.height;
        picture.loading = 'lazy';
        picture.decoding = 'async';
        picture.addEventListener('error', () => {
          tile.classList.add('image-unavailable');
          picture.alt = '图片暂时无法加载，仍可点击复制提示词';
        });
        button.append(picture);
        button.addEventListener('click', () => {
          preview.Hide();
          OnCopy(entry.prompt);
        });
        preview.AddTarget(button, picture.src, image);
        tile.append(button);

        // 显式预览按钮与复制按钮并列，触屏和键盘均可打开，不冒泡触发复制。
        openPreview.type = 'button';
        openPreview.className = 'preview-photo icon-button';
        openPreview.title = '查看大图';
        openPreview.setAttribute('aria-label', `查看第 ${imageIndex} 张大图`);
        openPreview.innerHTML = GetIcon('zoom');
        openPreview.addEventListener('click', () => preview.ShowDialog(picture.src));
        tile.append(openPreview);

        if (store.IsEditing()) {
          const edit = document.createElement('button');

          edit.type = 'button';
          edit.className = 'edit-photo icon-button';
          edit.title = '编辑这一组';
          edit.setAttribute('aria-label', '编辑这一组');
          edit.innerHTML = GetIcon('edit');
          edit.addEventListener('click', () => OnEdit(entry));
          tile.append(edit);
        }

        row.append(tile);
      }

      card.append(row);
    }

    container.append(card);
  }
}
