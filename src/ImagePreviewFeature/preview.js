import { GetIcon } from '../AppSystem/icons.js';
import { GetPreviewBounds } from './geometry.js';

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 一份浮层服务所有缩略图，独立于排版；显式按钮用原生模态框供触屏及键盘查看。
export class ImagePreview {
  // 不参与命中测试的悬停层及其图片。
  #layer = document.createElement('div');
  #image = document.createElement('img');

  // 触屏和键盘可打开的持续预览，不与复制动作共用点击处理器。
  #dialog = document.createElement('dialog');
  #dialogImage = document.createElement('img');
  #error = document.createElement('p');

  // 延迟和请求序号阻止快速移开、Esc 或旧图片加载完成后重新弹出。
  #timer = null;
  #target = null;
  #request = 0;

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 全局取消事件只清理悬停层，不影响弹窗、滚动位置或原图的点击语义。
  constructor() {
    this.#layer.className = 'image-preview';
    this.#layer.hidden = true;
    this.#layer.setAttribute('aria-hidden', 'true');
    this.#image.alt = '';
    this.#layer.append(this.#image);

    const header = document.createElement('header');
    const title = document.createElement('h1');
    const close = document.createElement('button');

    this.#dialog.className = 'image-viewer';
    this.#dialog.setAttribute('aria-label', '图片预览');
    header.className = 'dialog-header';
    title.textContent = '图片预览';
    close.type = 'button';
    close.className = 'icon-button';
    close.setAttribute('aria-label', '关闭图片预览');
    close.innerHTML = GetIcon('close');
    close.addEventListener('click', () => this.#dialog.close());
    this.#error.className = 'error-message';
    this.#error.textContent = '图片暂时无法加载，请关闭后重试。';
    this.#error.hidden = true;
    this.#error.setAttribute('role', 'status');
    this.#dialogImage.alt = '预览图片';
    this.#dialogImage.addEventListener('error', () => {
      this.#dialogImage.hidden = true;
      this.#error.hidden = false;
    });
    header.append(title, close);
    this.#dialog.append(header, this.#dialogImage, this.#error);
    this.#dialog.addEventListener('click', event => { if (event.target === this.#dialog) this.#dialog.close(); });
    document.body.append(this.#layer, this.#dialog);

    document.addEventListener('keydown', event => { if (event.key === 'Escape') this.Hide(); });
    document.addEventListener('pointerdown', () => this.Hide(), true);
    document.addEventListener('scroll', () => this.Hide(), true);
    window.addEventListener('resize', () => this.Hide());
    window.addEventListener('blur', () => this.Hide());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.Hide(); });
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 鼠标与键盘焦点可触发延迟预览；触屏点击仍保持原有复制行为。
  AddTarget(button, url, image) {
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && matchMedia('(hover: hover) and (pointer: fine)').matches) this.PlayDelay(button, url, image);
    });
    button.addEventListener('pointerleave', () => { if (this.#target === button) this.Hide(); });
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) this.PlayDelay(button, url, image); });
    button.addEventListener('blur', () => { if (this.#target === button) this.Hide(); });
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 进入另一张图片会重新计时，路过图片不会立刻弹出预览。
  PlayDelay(button, url, image) {
    this.Hide();
    this.#target = button;
    this.#timer = setTimeout(() => this.ShowHover(button, url, image), 300);
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 完整图片解码成功后再显示，避免旧图闪现；过时的加载结果直接丢弃。
  async ShowHover(button, url, image) {
    const request = ++this.#request;

    if (!button.isConnected || document.querySelector('dialog[open]')) return;

    this.#image.src = url;

    try {
      await this.#image.decode();
    } catch {
      if (request === this.#request) this.Hide();
      return;
    }

    if (request !== this.#request || this.#target !== button || !button.isConnected || document.querySelector('dialog[open]')) return;

    const bounds = GetPreviewBounds(button.getBoundingClientRect(), image, { width: document.documentElement.clientWidth, height: window.innerHeight });

    for (const name of ['left', 'top', 'width', 'height']) this.#layer.style[name] = `${bounds[name]}px`;

    this.#layer.hidden = false;
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 浮层隐藏不改变缩略图，Esc 后需要重新进入图片才会再次出现。
  Hide() {
    clearTimeout(this.#timer);
    this.#request++;
    this.#target = null;
    this.#layer.hidden = true;
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 按钮预览只查看图片，原生 dialog 提供焦点约束、Esc 和关闭后焦点恢复。
  ShowDialog(url) {
    this.Hide();
    this.#error.hidden = true;
    this.#dialogImage.hidden = false;
    this.#dialogImage.src = url;
    this.#dialog.showModal();
  }
}
