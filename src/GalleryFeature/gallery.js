import { GetIcon } from '../AppSystem/icons.js';

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 组内最多三张一行，按原图比例分配宽度；组间自由换行，不拆散提示词关联。
export function ShowGallery(container, snapshot, store, OnCopy, OnEdit) {
  container.replaceChildren();

  for (const entry of snapshot.catalog.entries) {
    const card = document.createElement('article');
    const weight = entry.images.slice(0, 3).reduce((sum, image) => sum + Math.min(2.5, Math.max(0.45, image.width / image.height)), 0);

    card.className = 'collection';
    card.style.setProperty('--weight', Math.min(3, weight));
    card.style.setProperty('--basis', `${Math.max(200, Math.min(660, weight * 190))}px`);
    card.setAttribute('aria-label', '一组图片与提示词');

    for (let offset = 0; offset < entry.images.length; offset += 3) {
      const row = document.createElement('div');

      row.className = 'collection-row';

      for (const [index, image] of entry.images.slice(offset, offset + 3).entries()) {
        const tile = document.createElement('div');
        const button = document.createElement('button');
        const picture = document.createElement('img');

        tile.className = 'photo';
        tile.style.setProperty('--ratio', image.width / image.height);
        button.className = 'copy-photo';
        button.type = 'button';
        button.title = '复制提示词';
        button.setAttribute('aria-label', `复制第 ${offset + index + 1} 张图片的提示词`);
        picture.src = store.GetImageUrl(image.path, snapshot.head);
        picture.alt = `收藏图片 ${offset + index + 1}`;
        picture.width = image.width;
        picture.height = image.height;
        picture.loading = 'lazy';
        picture.decoding = 'async';
        picture.addEventListener('error', () => {
          tile.classList.add('image-unavailable');
          picture.alt = '图片暂时无法加载，仍可点击复制提示词';
        });
        button.append(picture);
        button.addEventListener('click', () => OnCopy(entry.prompt));
        tile.append(button);

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
