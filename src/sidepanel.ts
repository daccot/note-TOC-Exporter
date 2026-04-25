export {};

import { DEFAULT_OPTIONS } from './constants';
import { t } from './i18n';
import { loadOptions } from './storage';
import { mergeOptions } from './utils';
import type { ExportOptions, HeadingLevel } from './types';

type SystemLevel = 'top' | 'bottom';
type PanelLevel = HeadingLevel | SystemLevel;

type SidePanelItem = {
  index: number;
  level: PanelLevel;
  text: string;
  id: string | null;
  source: 'editor' | 'published' | 'system';
  parentH2Id?: string | null;
  hasChildren?: boolean;
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
const copySelectedButton = document.getElementById('copySelected') as HTMLButtonElement;
const selectAllButton = document.getElementById('selectAll') as HTMLButtonElement;
const clearSelectionButton = document.getElementById('clearSelection') as HTMLButtonElement;
const titleEl = document.getElementById('panelTitle') as HTMLHeadingElement;

let currentTabId: number | null = null;
let currentItems: SidePanelItem[] = [];
let rawItems: SidePanelItem[] = [];
let currentOptions: ExportOptions = DEFAULT_OPTIONS;
let collapsedH2Ids = new Set<string>();
let userToggledCollapse = false;

function isSupportedUrl(url: string | undefined): boolean {
  return /^https:\/\/note\.com\//.test(url ?? '') || /^https:\/\/editor\.note\.com\//.test(url ?? '');
}

function msg(key: Parameters<typeof t>[1]): string {
  return t(currentOptions.uiLanguage, key);
}


function applyWallpaperTheme(): void {
  const root = document.documentElement;
  const opacity = Math.min(0.92, Math.max(0, Number(currentOptions.backgroundOverlayOpacity)));
  root.style.setProperty('--app-wallpaper-opacity', String(opacity));

  if (currentOptions.backgroundImageMode === 'none') {
    root.style.setProperty('--app-wallpaper', 'none');
    return;
  }

  if (currentOptions.backgroundImageMode === 'custom' && currentOptions.backgroundImageDataUrl) {
    root.style.setProperty('--app-wallpaper', `url("${currentOptions.backgroundImageDataUrl}")`);
    return;
  }

  root.style.setProperty('--app-wallpaper', `url("${chrome.runtime.getURL('assets/default-wallpaper.jpg')}")`);
}
function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function refreshOptions(): Promise<void> {
  currentOptions = mergeOptions(await loadOptions().catch(() => DEFAULT_OPTIONS));
  applyWallpaperTheme();
  titleEl.textContent = msg('panelTitle');
  refreshButton.textContent = msg('reload');
  openModalButton.textContent = msg('legacyModal');
  copySelectedButton.textContent = msg('copySelected');
  selectAllButton.textContent = msg('selectAll');
  clearSelectionButton.textContent = msg('clearSelection');
}

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
    text.textContent = message;
    statusEl.append(spinner, text);
    return;
  }
  statusEl.textContent = message;
}

function clearToc(): void {
  tocEl.hidden = true;
  tocEl.replaceChildren();
  currentItems = [];
  rawItems = [];
}

function annotateHierarchy(items: SidePanelItem[]): SidePanelItem[] {
  let currentH2Id: string | null = null;
  const h2WithChildren = new Set<string>();

  const annotated = items.map((item) => {
    if (item.level === 'h2') {
      currentH2Id = item.id ?? `h2-index-${item.index}`;
      return { ...item, parentH2Id: null };
    }
    if (item.level !== 'top' && item.level !== 'bottom' && currentH2Id) {
      h2WithChildren.add(currentH2Id);
      return { ...item, parentH2Id: currentH2Id };
    }
    return item;
  });

  return annotated.map((item) => {
    if (item.level === 'h2') {
      const h2Key = item.id ?? `h2-index-${item.index}`;
      return { ...item, hasChildren: h2WithChildren.has(h2Key) };
    }
    return item;
  });
}

function filterByOptions(items: SidePanelItem[]): SidePanelItem[] {
  const annotated = annotateHierarchy(items);
  if (currentOptions.showSubHeadings) return annotated;
  return annotated.filter((item) => item.level === 'h2');
}

function setMeta(title: string, url: string, count: number): void {
  metaEl.textContent = `${title || 'Untitled note'}\n${count} ${msg('headings')}`;
  metaEl.title = url;
}

function getRenderableItems(items: SidePanelItem[]): SidePanelItem[] {
  const filtered = filterByOptions(items);
  if (!currentOptions.showTopBottomItems) return filtered;
  return [
    { index: -1, level: 'top', text: msg('topOfPage'), id: '__NOTE_TOC_TOP__', source: 'system' },
    ...filtered,
    { index: -2, level: 'bottom', text: msg('bottomOfPage'), id: '__NOTE_TOC_BOTTOM__', source: 'system' }
  ];
}

function getItemColor(item: SidePanelItem): string {
  if (item.level === 'top' || item.level === 'bottom') return '#eef2ff';
  return currentOptions.headingColors[item.level] ?? DEFAULT_OPTIONS.headingColors[item.level];
}

function getH2Key(item: SidePanelItem): string | null {
  if (item.level !== 'h2') return item.parentH2Id ?? null;
  return item.id ?? `h2-index-${item.index}`;
}

function initializeCollapse(items: SidePanelItem[]): void {
  if (userToggledCollapse || !currentOptions.enableH2Collapse || !currentOptions.collapseH2ByDefault) return;
  collapsedH2Ids = new Set(
    items
      .filter((item) => item.level === 'h2' && item.hasChildren)
      .map((item) => item.id ?? `h2-index-${item.index}`)
  );
}

function applyCollapseVisibility(): void {
  const rows = Array.from(tocEl.querySelectorAll<HTMLDivElement>('.toc-row'));
  for (const row of rows) {
    const parentH2Id = row.dataset.parentH2Id ?? '';
    const hidden = Boolean(parentH2Id) && collapsedH2Ids.has(parentH2Id);
    row.classList.toggle('hidden-by-collapse', hidden);
  }

  tocEl.querySelectorAll<HTMLButtonElement>('[data-role="collapse-toggle"]').forEach((button) => {
    const h2Id = button.dataset.h2Id ?? '';
    button.textContent = collapsedH2Ids.has(h2Id) ? '+' : '−';
    button.title = collapsedH2Ids.has(h2Id) ? 'Expand' : 'Collapse';
  });
}

function toggleCollapse(h2Id: string): void {
  userToggledCollapse = true;
  if (collapsedH2Ids.has(h2Id)) collapsedH2Ids.delete(h2Id);
  else collapsedH2Ids.add(h2Id);
  applyCollapseVisibility();
}

function updateActiveHeading(nextActiveId: string | null): void {
  let activeParentH2Id: string | null = null;
  for (const item of currentItems) {
    if (item.id === nextActiveId) {
      activeParentH2Id = getH2Key(item);
      break;
    }
  }

  for (const row of Array.from(tocEl.querySelectorAll<HTMLDivElement>('.toc-row'))) {
    const rowId = row.dataset.id ?? null;
    const rowParentH2Id = row.dataset.parentH2Id ?? null;
    const isActive = rowId === nextActiveId;
    const isActiveGroup = Boolean(activeParentH2Id && rowParentH2Id === activeParentH2Id);
    row.classList.toggle('active-row', isActive || isActiveGroup);
  }

  for (const button of Array.from(tocEl.querySelectorAll<HTMLButtonElement>('.toc-item'))) {
    const isActive = button.dataset.id === nextActiveId;
    button.classList.toggle('active', isActive);
    if (isActive) button.scrollIntoView({ block: 'nearest' });
  }
}

function renderToc(items: SidePanelItem[], nextActiveId: string | null): void {
  tocEl.replaceChildren();
  currentItems = getRenderableItems(items);
  initializeCollapse(currentItems);

  if (currentItems.length === 0) {
    clearToc();
    setStatus(msg('noTocItems'), 'warn');
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of currentItems) {
    const h2Key = getH2Key(item);
    const row = document.createElement('div');
    row.className = `toc-row ${item.level}`;
    row.style.backgroundColor = getItemColor(item);
    row.dataset.id = item.id ?? '';
    row.dataset.index = String(item.index);
    if (item.parentH2Id) row.dataset.parentH2Id = item.parentH2Id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.index = String(item.index);
    checkbox.dataset.role = 'toc-selection';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `toc-item ${item.level}`;
    button.dataset.id = item.id ?? '';
    button.dataset.index = String(item.index);

    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.dataset.role = 'collapse-toggle';
    collapse.className = 'collapse-toggle';
    if (currentOptions.enableH2Collapse && item.level === 'h2' && item.hasChildren && h2Key) {
      collapse.dataset.h2Id = h2Key;
      collapse.textContent = collapsedH2Ids.has(h2Key) ? '+' : '−';
      collapse.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleCollapse(h2Key);
      });
    } else {
      collapse.className = 'collapse-placeholder';
      collapse.textContent = '';
      collapse.disabled = true;
      collapse.tabIndex = -1;
    }

    const level = document.createElement('span');
    level.className = 'level';
    level.textContent = item.level === 'top' ? 'TOP' : item.level === 'bottom' ? 'END' : item.level.toUpperCase();

    const body = document.createElement('span');
    body.className = 'text';
    body.textContent = item.text;

    button.append(collapse, level, body);
    button.addEventListener('click', () => void jumpToItem(item));
    row.append(checkbox, button);
    fragment.appendChild(row);
  }

  tocEl.appendChild(fragment);
  tocEl.hidden = false;
  statusEl.hidden = true;
  applyCollapseVisibility();
  updateActiveHeading(nextActiveId);
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function ensureContentScript(tabId: number): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'ENSURE_NOTE_TOC_CONTENT_SCRIPT', tabId });
  if (!response?.ok) throw new Error(response?.error ?? 'content script preparation failed.');
}

async function requestState(): Promise<void> {
  await refreshOptions();
  clearToc();
  setStatus(msg('loadingToc'), 'loading');

  const tab = await getActiveTab();
  if (!tab?.id) {
    currentTabId = null;
    setMeta('No active tab', '', 0);
    setStatus(msg('noActiveTab'), 'warn');
    return;
  }

  currentTabId = tab.id;

  try {
    if (!isSupportedUrl(tab.url)) {
      setMeta(tab.title ?? 'Unsupported page', tab.url ?? '', 0);
      setStatus(msg('unsupportedPage'), 'warn');
      return;
    }

    await ensureContentScript(tab.id);
    const state = (await chrome.tabs.sendMessage(tab.id, { type: 'GET_NOTE_TOC_SIDE_PANEL_STATE' })) as SidePanelState;

    if (!state?.ok) {
      setMeta(tab.title ?? 'Error', tab.url ?? '', 0);
      setStatus(state?.error ?? msg('failedToLoad'), 'warn');
      return;
    }

    rawItems = state.items;
    const visibleItems = filterByOptions(rawItems);
    setMeta(state.title, state.url, visibleItems.length);
    renderToc(rawItems, state.activeId);
  } catch (error) {
    setMeta(tab.title ?? 'Error', tab.url ?? '', 0);
    const message = normalizeError(error).includes('Cannot access a chrome:// URL') ? msg('unsupportedPage') : `${msg('failedToLoad')}: ${normalizeError(error)}`;
    setStatus(message, 'warn');
  }
}

async function jumpToItem(item: SidePanelItem): Promise<void> {
  if (!currentTabId) return;
  try {
    await chrome.tabs.sendMessage(currentTabId, { type: 'NOTE_TOC_SIDE_PANEL_JUMP_TO', id: item.id, index: item.index, text: item.text });
    updateActiveHeading(item.id);
  } catch (error) {
    setStatus(`${msg('failedToJump')}: ${normalizeError(error)}`, 'warn');
  }
}

function getSelectedItems(): SidePanelItem[] {
  const selected = Array.from(tocEl.querySelectorAll<HTMLInputElement>('[data-role="toc-selection"]:checked'));
  const indexes = new Set(selected.map((element) => Number(element.dataset.index)));
  return currentItems.filter((item) => indexes.has(item.index));
}

function formatSelectedMarkdown(items: SidePanelItem[]): string {
  return items.map((item) => {
    if (item.level === 'top') return `- [${item.text}](#top)`;
    if (item.level === 'bottom') return `- [${item.text}](#bottom)`;
    const depth = currentOptions.showSubHeadings ? Math.max(0, Number(item.level.slice(1)) - 2) : 0;
    const indent = '  '.repeat(depth);
    if (currentOptions.includeLinks && item.id) return `${indent}- [${item.text}](#${encodeURIComponent(item.id)})`;
    return `${indent}- ${item.text}`;
  }).join('\n');
}

async function copySelected(): Promise<void> {
  const items = getSelectedItems();
  if (items.length === 0) {
    setStatus(msg('noSelectedItems'), 'warn');
    return;
  }
  await navigator.clipboard.writeText(formatSelectedMarkdown(items));
  setStatus(msg('copiedSelected'));
}

function setAllSelection(checked: boolean): void {
  tocEl.querySelectorAll<HTMLInputElement>('[data-role="toc-selection"]').forEach((element) => { element.checked = checked; });
}

async function openLegacyModal(): Promise<void> {
  try { await chrome.runtime.sendMessage({ type: 'RUN_NOTE_TOC_EXPORTER_ON_ACTIVE_TAB' }); }
  catch (error) { setStatus(`${msg('failedToOpenLegacy')}: ${normalizeError(error)}`, 'warn'); }
}

refreshButton.addEventListener('click', () => void requestState());
openModalButton.addEventListener('click', () => void openLegacyModal());
copySelectedButton.addEventListener('click', () => void copySelected());
selectAllButton.addEventListener('click', () => setAllSelection(true));
clearSelectionButton.addEventListener('click', () => setAllSelection(false));
chrome.tabs.onActivated.addListener(() => void requestState());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (tabId === currentTabId && changeInfo.status === 'complete') void requestState(); });
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'NOTE_TOC_ACTIVE_HEADING_CHANGED') return false;
  updateActiveHeading(message.activeId ?? null);
  return false;
});

void requestState();