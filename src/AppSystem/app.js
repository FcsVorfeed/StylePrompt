import { GitHubStore } from '../GitHubSystem/github.js';
import { ShowGallery } from '../GalleryFeature/gallery.js';
import { EntryEditor } from '../EditorFeature/editor.js';
import { GetIcon } from './icons.js';
import { BrowserPreferences } from '../BrowserStorageSystem/preferences.js';

// 当前会话与快照保留在内存；仅用户勾选记住时才持久保存经过验证的凭证。
let store = null;
let snapshot = null;
let toastTimer = null;
let loading = false;

// 用于记住当前已验证会话，不回填到密码输入框或公开 DOM。
let connectionToken = '';

// 本地凭证与显示偏好使用独立键，退出编辑不影响卡片大小。
const preferences = new BrowserPreferences();

// DOM 引用与编辑器归属本应用模块，不挂载到 window。
const settings = document.querySelector('#settings-dialog');
const copyDialog = document.querySelector('#copy-dialog');
const editor = new EntryEditor((nextSnapshot, deleting) => {
  snapshot = nextSnapshot;
  ShowCurrentGallery();
  ShowToast(deleting ? '已删除' : '已保存');
});

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 连接、初始化与刷新互斥，读取期间不允许打开编辑器，防止旧快照覆盖新保存。
function SetLoading(value) {
  loading = value;

  for (const element of document.querySelectorAll('.toolbar button, #empty-action, #settings-dialog button, #settings-dialog input')) {
    element.disabled = value;
  }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 轻量成功反馈不挤占页面布局。
function ShowToast(message, success = true) {
  const toast = document.querySelector('#toast');

  clearTimeout(toastTimer);
  toast.textContent = success ? `✓  ${message}` : message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, success ? 1800 : 6000);
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 优先系统剪贴板；浏览器拒绝时显示可选文本，绝不虚报复制成功。
async function SetClipboard(prompt) {
  try {
    await navigator.clipboard.writeText(prompt);
    ShowToast('已复制提示词');
  } catch {
    const text = document.querySelector('#copy-text');

    text.value = prompt;
    copyDialog.showModal();
    text.focus();
    text.select();
  }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 空库、首次连接和网络错误分别显示，避免误把失败当成没有收藏。
function ShowEmpty(message, showAction = false) {
  document.querySelector('#empty-state').hidden = false;
  document.querySelector('#empty-text').textContent = message;
  document.querySelector('#empty-action').hidden = !showAction;
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 读取权限控制 UI；真实上传权限仍由存储服务检查。
function ShowCurrentGallery() {
  document.querySelector('#add-entry').hidden = !store?.IsEditing();
  document.querySelector('#logout').hidden = !store?.IsEditing() && !preferences.GetConnection();
  document.querySelector('#open-settings').classList.toggle('is-editing', Boolean(store?.IsEditing()));
  document.querySelector('#empty-state').hidden = true;

  if (store && snapshot) {
    ShowGallery(document.querySelector('#gallery'), snapshot, store, SetClipboard, entry => { if (!loading) editor.Show(store, entry, snapshot.head); });

    if (!snapshot.catalog.entries.length) {
      ShowEmpty(store.IsEditing() ? '从第一组图片开始。' : '这里还没有收藏。');
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 连接完成后才替换旧会话，错误输入不会导致现有页面丢失。
async function SetConnection(repository, token) {
  const nextStore = new GitHubStore(repository, token);

  await nextStore.GetConnection();

  const nextSnapshot = await nextStore.GetSnapshot();

  store?.StopEditing();
  store = nextStore;
  connectionToken = token.trim();
  snapshot = nextSnapshot;
  ShowCurrentGallery();
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 仓库名可显示，凭证输入每次打开都为空。
function ShowSettings() {
  if (loading) return;

  document.querySelector('#access-token').value = '';
  document.querySelector('#settings-error').textContent = '';
  document.querySelector('#token-mode-note').textContent = store?.IsEditing() ? '留空保持当前连接' : '可留空，只浏览';
  document.querySelector('#remember-browser').checked = store?.IsEditing() ? Boolean(preferences.GetConnection()) : true;
  document.querySelector('#logout').hidden = !store?.IsEditing() && !preferences.GetConnection();

  if (store) {
    document.querySelector('#repository').value = store.GetRepository();
  }

  settings.showModal();
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 初始化静态图标、表单与部署配置，不加载第三方脚本或分析服务。
async function Init() {
  // 缩放只调整已有卡片布局，不重新读取图片或远端数据。
  const sizeSlider = document.querySelector('#gallery-size');

  sizeSlider.value = String(preferences.GetGallerySize());
  sizeSlider.setAttribute('aria-valuetext', `${sizeSlider.value}%`);
  document.querySelector('#gallery').style.setProperty('--gallery-scale', Number(sizeSlider.value) / 100);
  sizeSlider.addEventListener('input', () => {
    const size = Number(sizeSlider.value);

    sizeSlider.setAttribute('aria-valuetext', `${size}%`);
    document.querySelector('#gallery').style.setProperty('--gallery-scale', size / 100);

    if (!preferences.TrySetGallerySize(size)) ShowToast('大小已调整，但浏览器未允许保存设置。', false);
  });

  document.querySelector('#open-settings').innerHTML = GetIcon('settings');
  document.querySelector('#refresh-gallery').innerHTML = GetIcon('refresh');
  document.querySelector('.close-settings').innerHTML = GetIcon('close');
  document.querySelector('#close-copy').innerHTML = GetIcon('close');
  document.querySelector('#open-settings').addEventListener('click', ShowSettings);
  document.querySelector('#empty-action').addEventListener('click', ShowSettings);
  document.querySelector('.close-settings').addEventListener('click', () => settings.close());
  document.querySelector('#close-copy').addEventListener('click', () => copyDialog.close());
  document.querySelector('#add-entry').addEventListener('click', () => { if (!loading) editor.Show(store); });
  settings.addEventListener('close', () => { document.querySelector('#access-token').value = ''; });
  settings.addEventListener('cancel', event => { if (loading) event.preventDefault(); });
  document.querySelector('#logout').addEventListener('click', () => {
    store?.StopEditing();
    connectionToken = '';

    const cleared = preferences.TrySetConnection(null);

    settings.close();
    ShowCurrentGallery();
    if (!store || !snapshot) ShowEmpty('已退出编辑，请连接收藏库。', true);
    ShowToast(cleared ? '已退出编辑并清除保存的凭证' : '已退出当前页面；无法清除保存的凭证，请清除浏览器网站数据。', cleared);
  });

  // 刷新失败保留之前的图片，同时明确提示当前不是最新快照。
  document.querySelector('#refresh-gallery').addEventListener('click', async event => {
    if (!store || loading) return;
    SetLoading(true);

    try {
      snapshot = await store.GetSnapshot();
      ShowCurrentGallery();
      ShowToast('已刷新');
    } catch (error) {
      ShowEmpty(`刷新失败，已保留当前内容。${error.message}`);
    } finally {
      SetLoading(false);
    }
  });
  document.querySelector('#settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (loading) return;
    SetLoading(true);

    const tokenInput = document.querySelector('#access-token');
    const repository = document.querySelector('#repository').value.trim();
    const sameRepository = repository.toLowerCase() === store?.GetRepository().toLowerCase();
    const token = tokenInput.value.trim() || (sameRepository ? connectionToken : '');
    const remember = document.querySelector('#remember-browser').checked;

    tokenInput.value = '';
    document.querySelector('#settings-error').textContent = '';

    try {
      await SetConnection(repository, token);

      // 远端验证成功才替换本地连接；不勾选或只读连接会移除旧凭证。
      if (!preferences.TrySetConnection(remember && token ? { repository: store.GetRepository(), token } : null)) {
        document.querySelector('#settings-error').textContent = '已连接，但浏览器禁止保存或清除凭证。请检查网站数据设置；当前连接仍可使用。';
        return;
      }

      settings.close();
    } catch (error) {
      document.querySelector('#settings-error').textContent = error.message;
    } finally {
      SetLoading(false);
    }
  });

  // 部署配置只含公开仓库标识；本地没有配置时由用户连接，不猜测私有数据。
  SetLoading(true);

  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });

    if (!response.ok) throw new Error('无法读取网页配置。');

    const config = await response.json();
    const remembered = preferences.GetConnection();
    const repository = remembered?.repository || config.repository;

    if (!repository) {
      ShowEmpty('图片与提示词，放在一起。', true);
      return;
    }

    ShowEmpty('正在读取收藏…');
    document.querySelector('#repository').value = repository;

    try {
      await SetConnection(repository, remembered?.token || '');
    } catch (error) {
      // 仅明确的认证失败清除失效凭证；网络故障、限流或权限不足保留本地记忆。
      if (!remembered || error.status !== 401) throw error;

      const cleared = preferences.TrySetConnection(null);

      await SetConnection(repository, '');
      ShowToast(cleared ? '保存的凭证已失效，请重新连接。' : '凭证已失效，且浏览器禁止清除它，请清除网站数据后重新连接。', false);
    }
  } catch (error) {
    ShowEmpty(error.message, true);
  } finally {
    SetLoading(false);
  }
}

Init();
