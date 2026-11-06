import { GetRepository } from '../GitHubSystem/catalog.js';

// 尺寸百分比与滑条一致，缺失或损坏的本地值恢复到较小的默认预览。
export const defaultGallerySize = 70;

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 凭证与非敏感显示偏好独立存储；作用域避免同源下其他工具的键名碰撞。
export class BrowserPreferences {
  // 延迟获取存储，兼容浏览器禁止站点存储的情况。
  #GetStorage;

  // 部署路径只用于键名隔离，不构成同源脚本之间的安全隔离。
  #prefix;

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 测试可注入内存存储，生产只访问当前浏览器，不上传这些偏好。
  constructor(GetStorage = () => globalThis.localStorage, scope = new URL('../../', import.meta.url).pathname) {
    this.#GetStorage = GetStorage;
    this.#prefix = `styleprompt:${scope}:`;
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 只接受完整且合法的仓库/凭证组合，绝不将令牌拼入日志或 URL。
  GetConnection() {
    try {
      const value = JSON.parse(this.#GetStorage().getItem(`${this.#prefix}connection`));

      if (!value || typeof value.repository !== 'string' || typeof value.token !== 'string' || !value.token.trim()) return null;

      return { repository: GetRepository(value.repository), token: value.token.trim() };
    } catch {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 先清除旧连接再写新连接；调用方仅在远端验证成功后保存。
  TrySetConnection(connection) {
    try {
      const value = connection ? { repository: GetRepository(connection.repository), token: connection.token.trim() } : null;
      const storage = this.#GetStorage();

      storage.removeItem(`${this.#prefix}connection`);

      if (value?.token) storage.setItem(`${this.#prefix}connection`, JSON.stringify(value));

      return true;
    } catch {
      return false;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 过滤损坏或越界的尺寸，避免将本地字符串直接放进 CSS。
  GetGallerySize() {
    try {
      const size = Number(this.#GetStorage().getItem(`${this.#prefix}gallery-size`));

      return Number.isInteger(size) && size >= 40 && size <= 140 && size % 5 === 0 ? size : defaultGallerySize;
    } catch {
      return defaultGallerySize;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 尺寸不依赖登录状态，写入受限时允许当前页面继续使用新尺寸。
  TrySetGallerySize(size) {
    if (!Number.isInteger(size) || size < 40 || size > 140 || size % 5 !== 0) return false;

    try {
      this.#GetStorage().setItem(`${this.#prefix}gallery-size`, String(size));
      return true;
    } catch {
      return false;
    }
  }
}
