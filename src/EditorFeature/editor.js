import { GetIcon } from '../AppSystem/icons.js';

// 格式白名单与体积限制保护浏览器内存，也避免上传可执行的 SVG/HTML。
const extensions = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp'], ['image/gif', 'gif']]);

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 编辑器维护独立草稿，保存失败、网络中断或取消都不修改当前收藏。
export class EntryEditor {
  #dialog = document.querySelector('#editor-dialog');
  #images = [];
  #original = null;
  #store;
  #busy = false;
  #dragPath = null;
  #deleteArmed = false;
  #OnSaved;

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 绑定弹窗交互一次，移动端与键盘使用顺序按钮代替拖拽。
  constructor(OnSaved) {
    this.#OnSaved = OnSaved;
    document.querySelector('#close-editor').innerHTML = GetIcon('close');
    document.querySelector('#close-editor').addEventListener('click', () => this.Hide());
    document.querySelector('#cancel-editor').addEventListener('click', () => this.Hide());
    document.querySelector('#choose-images').addEventListener('click', () => document.querySelector('#image-files').click());
    document.querySelector('#image-files').addEventListener('change', event => {
      this.AddImages([...event.target.files]);
      event.target.value = '';
    });
    document.querySelector('#editor-form').addEventListener('submit', event => {
      event.preventDefault();
      this.SetEntry(false);
    });
    document.querySelector('#delete-entry').addEventListener('click', () => {
      if (!this.#deleteArmed) {
        this.#deleteArmed = true;
        document.querySelector('#delete-entry').textContent = '确认删除整组';
        return;
      }

      this.SetEntry(true);
    });
    this.#dialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.Hide();
    });

    // 只拦截文件拖入，内部图片排序走各缩略图的处理器。
    const dropArea = document.querySelector('#drop-area');

    dropArea.addEventListener('dragover', event => {
      event.preventDefault();

      if (event.dataTransfer.types.includes('Files')) {
        dropArea.classList.add('drag-over');
      }
    });
    dropArea.addEventListener('dragleave', event => {
      if (!dropArea.contains(event.relatedTarget)) {
        dropArea.classList.remove('drag-over');
      }
    });
    dropArea.addEventListener('drop', event => {
      event.preventDefault();
      dropArea.classList.remove('drag-over');

      if (event.dataTransfer.files.length) {
        this.AddImages([...event.dataTransfer.files]);
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 从远端记录复制草稿，图片地址固定到打开时的版本。
  Show(store, entry = null, revision) {
    this.#store = store;
    this.#original = entry ? structuredClone(entry) : null;
    this.#images = (entry?.images || []).map(image => ({ ...image, url: store.GetImageUrl(image.path, revision) }));
    this.#deleteArmed = false;
    document.querySelector('#editor-heading').textContent = entry ? '编辑收藏' : '添加收藏';
    document.querySelector('#prompt').value = entry?.prompt || '';
    document.querySelector('#editor-error').textContent = '';
    document.querySelector('#delete-entry').hidden = !entry;
    document.querySelector('#delete-entry').textContent = '删除整组';
    this.ShowImages();
    this.#dialog.showModal();
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 提示未保存修改，确认后释放临时图片 URL。
  Hide(force = false) {
    if (this.#busy) {
      return;
    }

    const changed = document.querySelector('#prompt').value !== (this.#original?.prompt || '') || JSON.stringify(this.#images.map(image => image.path)) !== JSON.stringify((this.#original?.images || []).map(image => image.path));

    if (!force && changed && !window.confirm('放弃尚未保存的修改？')) {
      return;
    }

    for (const image of this.#images) {
      if (image.base64) {
        URL.revokeObjectURL(image.url);
      }
    }

    this.#images = [];
    this.#dialog.close();
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 在读取与保存期间锁定草稿，避免用户操作改变正在上传的记录。
  SetBusy(busy) {
    this.#busy = busy;
    this.#dialog.setAttribute('aria-busy', String(busy));

    for (const input of this.#dialog.querySelectorAll('button, textarea, input')) {
      input.disabled = busy || input.dataset.boundary === 'true';
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 保持文件原始字节，逐张解码检查；任意失败不会丢掉之前已经加入的草稿。
  async AddImages(files) {
    if (this.#busy || !files.length) {
      return;
    }

    this.SetBusy(true);
    document.querySelector('#editor-error').textContent = '';

    try {
      if (this.#images.length + files.length > 30) {
        throw new Error('每组最多 30 张图片。');
      }

      const totalBytes = files.reduce((sum, file) => sum + file.size, 0) + this.#images.reduce((sum, image) => sum + (image.size || 0), 0);

      if (totalBytes > 60 * 1024 * 1024) {
        throw new Error('一组新增图片合计请控制在 60 MB 以内。');
      }

      for (const file of files) {
        if (!extensions.has(file.type) || file.size === 0 || file.size > 20 * 1024 * 1024) {
          throw new Error('请选择 PNG、JPG、WebP 或 GIF，每张不超过 20 MB。');
        }

        const url = URL.createObjectURL(file);

        try {
          const picture = new Image();

          picture.src = url;
          await picture.decode();

          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'));
            reader.readAsDataURL(file);
          });

          this.#images.push({
            path: `images/${crypto.randomUUID()}.${extensions.get(file.type)}`,
            width: picture.naturalWidth,
            height: picture.naturalHeight,
            size: file.size,
            url,
            base64
          });
        } catch {
          URL.revokeObjectURL(url);
          throw new Error('有一张图片无法解码，请检查文件是否完整。已加入的图片仍保留。');
        }
      }
    } catch (error) {
      document.querySelector('#editor-error').textContent = error.message;
    } finally {
      this.ShowImages();
      this.SetBusy(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 重新渲染草稿缩略图；删除与移动仅作用于草稿，保存时才写入 GitHub。
  ShowImages() {
    const container = document.querySelector('#editor-images');

    container.replaceChildren();

    for (const [index, image] of this.#images.entries()) {
      const tile = document.createElement('div');
      const picture = document.createElement('img');
      const controls = document.createElement('div');

      tile.className = 'editor-image';
      tile.draggable = true;
      picture.src = image.url;
      picture.alt = `图片 ${index + 1}`;
      picture.draggable = false;
      controls.className = 'image-controls';

      for (const [icon, label, action] of [
        ['left', '向前移动', () => this.SwitchImage(index, index - 1)],
        ['trash', '移除图片', () => {
          if (this.#busy) return;
          const [removed] = this.#images.splice(index, 1);
          if (removed.base64) URL.revokeObjectURL(removed.url);
          this.ShowImages();
        }],
        ['right', '向后移动', () => this.SwitchImage(index, index + 1)]
      ]) {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'icon-button';
        button.setAttribute('aria-label', `${label} ${index + 1}`);
        button.title = label;
        button.innerHTML = GetIcon(icon);
        button.disabled = (icon === 'left' && index === 0) || (icon === 'right' && index === this.#images.length - 1);
        button.dataset.boundary = String(button.disabled);
        button.addEventListener('click', action);
        controls.append(button);
      }

      tile.addEventListener('dragstart', event => {
        if (this.#busy) {
          event.preventDefault();
          return;
        }

        this.#dragPath = image.path;
        event.dataTransfer.setData('text/plain', image.path);
        event.dataTransfer.effectAllowed = 'move';
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', () => {
        this.#dragPath = null;
        tile.classList.remove('dragging');
      });
      tile.addEventListener('dragover', event => event.preventDefault());
      tile.addEventListener('drop', event => {
        if (!this.#dragPath || event.dataTransfer.files.length) return;
        event.preventDefault();
        event.stopPropagation();
        this.SwitchImage(this.#images.findIndex(candidate => candidate.path === this.#dragPath), index);
        this.#dragPath = null;
      });
      tile.append(picture, controls);
      container.append(tile);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 拖动与顺序按钮共用同一个排序操作。
  SwitchImage(from, to) {
    if (this.#busy || from < 0 || to < 0 || to >= this.#images.length || from === to) return;

    const [image] = this.#images.splice(from, 1);

    this.#images.splice(to, 0, image);
    this.ShowImages();
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 保存与整组删除共享事务入口；成功前不关闭弹窗、不清空草稿。
  async SetEntry(deleting) {
    if (this.#busy) return;

    const prompt = document.querySelector('#prompt').value;
    const errorLabel = document.querySelector('#editor-error');

    if (!deleting && (!this.#images.length || !prompt.trim())) {
      errorLabel.textContent = '请至少添加一张图片，并填写提示词。';
      return;
    }

    if (prompt.length > 100000) {
      errorLabel.textContent = '提示词最多 100,000 个字符。';
      return;
    }

    this.SetBusy(true);
    errorLabel.textContent = '';

    try {
      const replacement = deleting ? null : {
        id: this.#original?.id || crypto.randomUUID(),
        prompt,
        images: this.#images.map(({ path, width, height }) => ({ path, width, height }))
      };
      const pendingImages = deleting ? [] : this.#images.filter(image => image.base64);
      const snapshot = await this.#store.SetEntry(this.#original, replacement, pendingImages, message => {
        document.querySelector('#save-entry').textContent = message;
      });

      this.SetBusy(false);
      this.Hide(true);
      this.#OnSaved(snapshot, deleting);
    } catch (error) {
      errorLabel.textContent = error.message;
    } finally {
      this.SetBusy(false);
      document.querySelector('#save-entry').textContent = '保存';
    }
  }
}
