export {};

type SidePanelHeadingLevel = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

type SidePanelItem = {
  index: number;
  level: SidePanelHeadingLevel;
  text: string;
  id: string | null;
  source: 'editor' | 'published';
};

type SidePanelState = {
  ok: boolean;
  supported: boolean;
  url: string;
  title: string;
  activeId: string | null;
  items: SidePanelItem[];
  error?: string;
};

const metaEl = document.getElementById('meta') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const tocEl = document.getElementById('toc') as HTMLDivElement;
const refreshButton = document.getElementById('refresh') as HTMLButtonElement;
const openModalButton = document.getElementById('openModal') as HTMLButtonElement;

let currentTabId: number | null = null;
let activeId: string | null = null;

function setStatus(message: string, variant: 'normal' | 'warn' | 'loading' = 'normal'): void {
  statusEl.className = variant === 'warn' ? 'status warn' : variant === 'loading' ? 'status loading' : 'status';
  statusEl.hidden = false;

  if (variant === 'loading') {
    statusEl.replaceChildren();

    const spinner = document.createElement('img');
    spinner.className = 'loading-spinner';
    spinner.src = chrome.runtime.getURL('assets/loading-spinner.svg');
    spinner.alt = 'Loading';

    const text = document.createElement('span');
    text.className = 'loading-text';
    text.textContent = message;

    statusEl.append(spinner, text);
    return;
  }

  statusEl.textContent = message;
}

function clearToc(): void {
  tocEl.hidden = true;
  tocEl.replaceChildren();
}

function setMeta(title: string, url: string, count: number): void {
  metaEl.textContent = `${title || 'Untitled note'}\n${count} headings`;
  metaEl.title = url;
}


function isSupportedUrl(url: string | undefined): boolean {
  return /^https:\/\/note\.com\//.test(url ?? '') || /^https:\/\/editor\.note\.com\//.test(url ?? '');
}
function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function updateActiveHeading(nextActiveId: string | null): void {
  activeId = nextActiveId;
  const buttons = Array.from(tocEl.querySelectorAll<HTMLButtonElement>('.toc-item'));
  for (const button of buttons) {
    const isActive = button.dataset.id === nextActiveId;
    button.classList.toggle('active', isActive);
    if (isActive) button.scrollIntoView({ block: 'nearest' });
  }
}

function renderToc(items: SidePanelItem[], nextActiveId: string | null): void {
  tocEl.replaceChildren();
  if (items.length === 0) {
    clearToc();
    setStatus('TOC項目がありません。note側の目次生成状態を確認してください。', 'warn');
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `toc-item ${item.level}`;
    button.dataset.id = item.id ?? '';
    button.dataset.index = String(item.index);

    const level = document.createElement('span');
    level.className = 'level';
    level.textContent = item.level.toUpperCase();

    const body = document.createElement('span');
    body.className = 'text';
    body.textContent = item.text;

    if (!item.id) {
      const small = document.createElement('div');
      small.className = 'small';
      small.textContent = 'ジャンプID未検出';
      body.appendChild(small);
    }

    button.append(level, body);
    button.addEventListener('click', () => void jumpToItem(item));
    fragment.appendChild(button);
  }

  tocEl.appendChild(fragment);
  tocEl.hidden = false;
  statusEl.hidden = true;
  updateActiveHeading(nextActiveId);
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function ensureContentScript(tabId: number): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'ENSURE_NOTE_TOC_CONTENT_SCRIPT', tabId });
  if (!response?.ok) throw new Error(response?.error ?? 'content script の準備に失敗しました。');
}

async function requestState(): Promise<void> {
  clearToc();
  setStatus('TOCを読み込んでいます。', 'loading');

  const tab = await getActiveTab();
  if (!tab?.id) {
    currentTabId = null;
    setMeta('No active tab', '', 0);
    setStatus('アクティブタブが見つかりません。', 'warn');
    return;
  }

  currentTabId = tab.id;

  try {
    if (!isSupportedUrl(tab.url)) {
      setMeta(tab.title ?? 'Unsupported page', tab.url ?? '', 0);
      setStatus('note.com または editor.note.com の記事・編集画面を開くと、ここにTOCが表示されます。', 'warn');
      return;
    }

    await ensureContentScript(tab.id);
    const state = (await chrome.tabs.sendMessage(tab.id, { type: 'GET_NOTE_TOC_SIDE_PANEL_STATE' })) as SidePanelState;

    if (!state?.ok) {
      setMeta(tab.title ?? 'Error', tab.url ?? '', 0);
      setStatus(state?.error ?? 'TOC状態を取得できませんでした。', 'warn');
      return;
    }

    if (!state.supported) {
      setMeta(tab.title ?? 'Unsupported page', tab.url ?? '', 0);
      setStatus('note.com または editor.note.com の対応ページで開いてください。', 'warn');
      return;
    }

    setMeta(state.title, state.url, state.items.length);
    renderToc(state.items, state.activeId);
  } catch (error) {
    setMeta(tab.title ?? 'Error', tab.url ?? '', 0);
    setStatus(`読み込みに失敗しました: ${normalizeError(error)}`, 'warn');
  }
}

async function jumpToItem(item: SidePanelItem): Promise<void> {
  if (!currentTabId) return;
  try {
    await chrome.tabs.sendMessage(currentTabId, {
      type: 'NOTE_TOC_SIDE_PANEL_JUMP_TO',
      id: item.id,
      index: item.index,
      text: item.text
    });
    updateActiveHeading(item.id);
  } catch (error) {
    setStatus(`ジャンプに失敗しました: ${normalizeError(error)}`, 'warn');
  }
}

async function openLegacyModal(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'RUN_NOTE_TOC_EXPORTER_ON_ACTIVE_TAB' });
  } catch (error) {
    setStatus(`従来モーダルの起動に失敗しました: ${normalizeError(error)}`, 'warn');
  }
}

refreshButton.addEventListener('click', () => void requestState());
openModalButton.addEventListener('click', () => void openLegacyModal());

chrome.tabs.onActivated.addListener(() => void requestState());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === currentTabId && changeInfo.status === 'complete') void requestState();
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'NOTE_TOC_ACTIVE_HEADING_CHANGED') return false;
  updateActiveHeading(message.activeId ?? null);
  return false;
});

void requestState();