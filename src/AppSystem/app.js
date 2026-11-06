import { GitHubStore } from '../GitHubSystem/github.js';
import { ShowGallery } from '../GalleryFeature/gallery.js';
import { EntryEditor } from '../EditorFeature/editor.js';
import { GetIcon } from './icons.js';

// 当前连接与快照只存在页面内存，刷新后不会继承编辑权限。
let store = null;
let snapshot = null;
let toastTimer = null;
let loading = false;

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
function ShowToast(message) {
  const toast = document.querySelector('#toast');

  clearTimeout(toastTimer);
  toast.textContent = `✓  ${message}`;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
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
  document.querySelector('#logout').hidden = !store?.IsEditing();
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
  snapshot = nextSnapshot;
  ShowCurrentGallery();
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 仓库名可显示，凭证输入每次打开都为空。
function ShowSettings() {
  if (loading) return;

  document.querySelector('#access-token').value = '';
  document.querySelector('#settings-error').textContent = '';

  if (store) {
    document.querySelector('#repository').value = store.GetRepository();
  }

  settings.showModal();
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 初始化静态图标、表单与部署配置，不加载第三方脚本或分析服务。
async function Init() {
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
    store.StopEditing();
    settings.close();
    ShowCurrentGallery();
    ShowToast('已退出编辑');
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
    const token = tokenInput.value;

    tokenInput.value = '';
    document.querySelector('#settings-error').textContent = '';

    try {
      await SetConnection(document.querySelector('#repository').value, token);
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

    if (!config.repository) {
      ShowEmpty('图片与提示词，放在一起。', true);
      return;
    }

    ShowEmpty('正在读取收藏…');
    document.querySelector('#repository').value = config.repository;
    await SetConnection(config.repository, '');
  } catch (error) {
    ShowEmpty(error.message, true);
  } finally {
    SetLoading(false);
  }
}

Init();
