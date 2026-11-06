import { GitHubStore } from '../src/GitHubSystem/github.js';

// 仅测试服务器加载的隔离夹具，不进入构建产物，不联系真实 GitHub。
const nativeFetch = window.fetch.bind(window);
const fixtureEntries = [
  { count: 1, width: 800, height: 1000 },
  { count: 3, width: 800, height: 1000 },
  { count: 1, width: 700, height: 1000 },
  { count: 2, width: 1000, height: 700 }
].map((group, index) => ({
  id: `${String(index + 1).repeat(8)}-1111-4111-8111-111111111111`,
  prompt: `合成测试图片 ${index + 1}\n\n  保留缩进与换行\n<script>不是可执行代码</script>`,
  images: Array.from({ length: group.count }, (_, imageIndex) => ({
    path: `images/${String(index + 1).repeat(8)}-1111-4111-8111-${String(imageIndex + 1).repeat(12)}.png`,
    width: group.width,
    height: group.height
  }))
}));
let catalog = JSON.parse(sessionStorage.getItem('qa-catalog') || 'null') || { version: 1, entries: fixtureEntries };
let nextCatalog = catalog;
let networkFailure = false;
let copyFailure = false;
let commitNumber = 1;

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 同域测试图片由本地服务生成，不下载任何真实收藏。
GitHubStore.prototype.GetImageUrl = function GetImageUrl(path) {
  return `/test-images/${path.split('/')[1]}.svg`;
};

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// API 模拟器复用生产存储模块完整调用链，只有传输层被替换。
window.fetch = async function GetFixtureResponse(input, init = {}) {
  const url = new URL(input, location.href);

  if (url.pathname === '/runtime-config.json') {
    return new Response(JSON.stringify({ repository: 'OWNER/REPOSITORY' }));
  }

  if (url.hostname !== 'api.github.com') return nativeFetch(input, init);
  await new Promise(resolve => setTimeout(resolve, 120));
  if (networkFailure) throw new TypeError('Synthetic network error');

  const path = url.pathname.replace('/repos/OWNER/REPOSITORY', '');
  const body = init.body ? JSON.parse(init.body) : null;
  const authorized = init.headers?.Authorization === 'Bearer TEST_ONLY';
  let value = {};

  if (init.method !== 'GET' && !authorized) return new Response('{}', { status: 403 });

  if (path === '') value = { private: false, permissions: { push: authorized } };
  else if (path === '/git/ref/heads/gallery-data') value = { object: { sha: `fixture-${commitNumber}` } };
  else if (path.startsWith('/git/commits/')) value = { tree: { sha: 'fixture-tree' } };
  else if (path === '/contents/catalog.json') {
    const bytes = new TextEncoder().encode(JSON.stringify(catalog));

    value = { encoding: 'base64', content: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')) };
  } else if (path === '/git/blobs') value = { sha: 'fixture-blob' };
  else if (path === '/git/trees') {
    nextCatalog = JSON.parse(body.tree.find(entry => entry.path === 'catalog.json').content);
    value = { sha: 'fixture-tree-next' };
  } else if (path === '/git/commits') value = { sha: `fixture-${++commitNumber}` };
  else if (path.startsWith('/git/refs')) {
    catalog = nextCatalog;
    sessionStorage.setItem('qa-catalog', JSON.stringify(catalog));
  } else return new Response('{}', { status: 404 });

  return new Response(JSON.stringify(value));
};

// 测试控件明显标识模拟环境，页面截图不会被误认为真实收藏。
const panel = document.createElement('aside');

panel.style.cssText = 'padding:8px 18px;background:#edf0e6;font:12px system-ui;color:#687360;display:flex;gap:16px;align-items:center';
panel.textContent = '本地交互验收 · 合成图片 · 不连接 GitHub';

for (const [label, action] of [
  ['模拟网络故障', event => { networkFailure = !networkFailure; event.target.textContent = networkFailure ? '恢复网络' : '模拟网络故障'; }],
  ['模拟复制受限', event => { copyFailure = !copyFailure; event.target.textContent = copyFailure ? '恢复复制' : '模拟复制受限'; }]
]) {
  const button = document.createElement('button');

  button.textContent = label;
  button.addEventListener('click', action);
  panel.append(button);
}

document.body.prepend(panel);

const nativeWrite = navigator.clipboard.writeText.bind(navigator.clipboard);

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    async writeText(text) {
      if (copyFailure) throw new Error('Synthetic clipboard denial');
      return nativeWrite(text);
    }
  }
});

await import('../src/AppSystem/app.js');
