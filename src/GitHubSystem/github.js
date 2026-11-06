import { GetCatalog, GetMergedCatalog, GetRepository } from './catalog.js';

// 收藏使用独立分支，上传不会修改网页源码或触发页面重建。
export const dataBranch = 'gallery-data';

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// GitHub 是最终权限边界；凭证为私有字段，不进入 URL、存储、日志或部署产物。
export class GitHubStore {
  #token;
  #repository;

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 每次连接建立独立会话，只有验证后的实例才交给界面。
  constructor(repository, token = '') {
    this.#repository = GetRepository(repository);
    this.#token = token.trim();
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 返回非敏感仓库标识供界面显示。
  GetRepository() {
    return this.#repository;
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 此状态只控制界面，写入仍必须通过 GitHub 服务端鉴权。
  IsEditing() {
    return Boolean(this.#token);
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 清除会话凭证，保留公开读取能力。
  StopEditing() {
    this.#token = '';
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 固定请求域名并拒绝重定向，确保授权头只发送给 GitHub API。
  async GetResponse(path, method = 'GET', body) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

    if (this.#token) {
      headers.Authorization = `Bearer ${this.#token}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    let response;

    try {
      response = await fetch(`https://api.github.com/repos/${this.#repository}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(60000)
      });
    } catch {
      throw new Error('无法连接 GitHub。草稿仍保留，请检查网络后重试；若刚刚保存，请先刷新确认结果。');
    }

    if (!response.ok) {
      const messages = {
        401: '编辑凭证无效或已过期，请重新连接。',
        403: 'GitHub 拒绝访问：请检查 Contents 权限、仓库规则或 API 请求额度。',
        404: '仓库或数据不存在，或当前凭证没有访问权限。',
        409: '远端发生冲突，请刷新后重试。',
        422: '保存被拒绝：可能有其他页面同时保存，或仓库规则禁止此操作。请刷新确认。',
        429: 'GitHub 请求过于频繁，请稍后重试。'
      };
      const error = new Error(messages[response.status] || `GitHub 暂时无法完成请求（${response.status}），请稍后重试。`);

      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 只支持已公开且可访问的仓库，避免凭证把原本私有的资料带到公开界面。
  async GetConnection() {
    const repository = await this.GetResponse('');

    if (repository.private) {
      throw new Error('此版本用于公开收藏，请连接公开仓库。不会自动更改仓库可见性。');
    }

    if (this.IsEditing() && !repository.permissions?.push) {
      throw new Error('此账号没有仓库写入权限，请使用仓库管理员的编辑凭证。');
    }

    return this;
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 图片地址由固定域名与经过校验的路径组成；不在地址中携带凭证。
  GetImageUrl(path, revision = dataBranch) {
    return `https://raw.githubusercontent.com/${this.#repository}/${revision}/${path}`;
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 读取固定提交的索引，与同一次快照的图片保持一致。
  async GetSnapshot() {
    let reference;

    try {
      reference = await this.GetResponse(`/git/ref/heads/${dataBranch}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      // 再确认仓库可见，避免把仓库失联错误误判成首次使用。
      await this.GetConnection();
      return { head: null, tree: null, catalog: { version: 1, entries: [] } };
    }

    const head = reference.object.sha;
    const commit = await this.GetResponse(`/git/commits/${head}`);
    const file = await this.GetResponse(`/contents/catalog.json?ref=${head}`);

    if (file.encoding !== 'base64' || !file.content) {
      throw new Error('索引过大或格式不正确，无法安全编辑。请先导出或拆分收藏库。');
    }

    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), character => character.charCodeAt(0));
    const catalog = GetCatalog(JSON.parse(new TextDecoder().decode(bytes)));

    return { head, tree: commit.tree.sha, catalog };
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // 一次保存只发布一个完整提交，断网或拒绝写入不会暴露半成品记录。
  async SetEntry(original, replacement, pendingImages, OnProgress = () => {}) {
    if (!this.IsEditing()) {
      throw new Error('请先连接编辑凭证。');
    }

    const snapshot = await this.GetSnapshot();
    const catalog = GetMergedCatalog(snapshot.catalog, original, replacement);
    const treeEntries = [];
    const content = JSON.stringify(catalog, null, 2) + '\n';

    // Contents API 的索引读取上限为 1 MiB；写入前保留充足余量。
    if (new TextEncoder().encode(content).length > 900000) {
      throw new Error('收藏索引已接近容量上限，本次未保存。请使用新的收藏仓库。');
    }

    for (const [index, image] of pendingImages.entries()) {
      OnProgress(`上传图片 ${index + 1} / ${pendingImages.length}`);
      const blob = await this.GetResponse('/git/blobs', 'POST', { content: image.base64, encoding: 'base64' });

      treeEntries.push({ path: image.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 只删除该记录原有且已被移除的图片；其他组完全保留。
    for (const image of original?.images || []) {
      if (!replacement?.images.some(candidate => candidate.path === image.path)) {
        treeEntries.push({ path: image.path, mode: '100644', type: 'blob', sha: null });
      }
    }

    treeEntries.push({ path: 'catalog.json', mode: '100644', type: 'blob', content });
    OnProgress('正在保存…');

    const tree = await this.GetResponse('/git/trees', 'POST', {
      ...(snapshot.tree ? { base_tree: snapshot.tree } : {}),
      tree: treeEntries
    });
    const commit = await this.GetResponse('/git/commits', 'POST', {
      message: replacement ? (original ? '修改图片与提示词' : '添加图片与提示词') : '删除图片与提示词',
      tree: tree.sha,
      parents: snapshot.head ? [snapshot.head] : []
    });

    // 禁止强推；并发提交由 GitHub 拒绝，不静默覆盖其他设备的保存。
    if (snapshot.head) {
      await this.GetResponse(`/git/refs/heads/${dataBranch}`, 'PATCH', { sha: commit.sha, force: false });
    } else {
      await this.GetResponse('/git/refs', 'POST', { ref: `refs/heads/${dataBranch}`, sha: commit.sha });
    }

    return { head: commit.sha, tree: tree.sha, catalog };
  }
}
