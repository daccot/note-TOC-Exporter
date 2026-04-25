import { DEFAULT_OPTIONS, LOG_PREFIX } from './constants';
import { waitForTocData } from './extractor';
import { formatExport } from './formatter';
import { addHistoryEntry, loadOptions, saveOptions } from './storage';
import { removeModal, showErrorModal, showResultModal } from './ui';
import { mergeOptions } from './utils';
import type { ExportFormat, ExportOptions, ExportResult } from './types';

declare global {
  interface Window {
    __NOTE_TOC_EXPORTER_BOOTED__?: boolean;
  }
}

if (window.top === window.self && !window.__NOTE_TOC_EXPORTER_BOOTED__) {
  window.__NOTE_TOC_EXPORTER_BOOTED__ = true;
  let isAutoRunning = false;

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const result = document.execCommand('copy');
        textarea.remove();
        return result;
      } catch {
        return false;
      }
    }
  }

  function jumpToHeading(id: string | null): void {
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function downloadText(filename: string, text: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  async function persistHistory(result: ExportResult): Promise<void> {
    await addHistoryEntry({
      createdAt: new Date().toISOString(),
      title: result.meta.title,
      exportFormat: result.options.exportFormat,
      output: result.output,
      filename: result.filename
    });
  }

  async function buildExportResult(rawOptions?: Partial<ExportOptions>): Promise<ExportResult> {
    const storedOptions = await loadOptions().catch(() => DEFAULT_OPTIONS);
    const options = mergeOptions({ ...storedOptions, ...rawOptions });
    const { label, tocData, meta, stats, diagnostics } = await waitForTocData(location.href);
    const { output, filename } = formatExport(tocData, meta, stats, options);

    if (!output.trim()) {
      throw new Error('TOCは取得できましたが、出力が空です。見出し設定またはテンプレートを確認してください。');
    }

    return { label, tocData, options, output, meta, stats, diagnostics, filename };
  }

  async function rerenderWithFormat(result: ExportResult, exportFormat: ExportFormat): Promise<ExportResult> {
    return buildExportResult({ ...result.options, exportFormat });
  }

  async function runExporter(isAutoTriggered = false, rawOptions?: Partial<ExportOptions>): Promise<void> {
    try {
      if (isAutoTriggered && isAutoRunning) return;
      if (isAutoTriggered) isAutoRunning = true;

      let result = await buildExportResult(rawOptions);
      const copied = await copyText(result.output);
      await persistHistory(result);

      showResultModal(result, copied, {
        onClose: removeModal,
        onCopy: async () => copyText(result.output),
        onCopyAs: async (format) => {
          const next = await rerenderWithFormat(result, format);
          result = next;
          await persistHistory(result);
          return copyText(result.output);
        },
        onOptionsChange: async (nextOptions) => {
          result = await buildExportResult(nextOptions);
          await saveOptions(result.options);
          await persistHistory(result);
          return result;
        },
        onDownload: () => {
          downloadText(result.filename, result.output);
        },
        onJumpTo: (item) => {
          jumpToHeading(item.id);
        }
      });

      console.log(LOG_PREFIX, 'exported', { href: location.href, tocData: result.tocData, options: result.options });
    } catch (error) {
      console.error(LOG_PREFIX, error);
      const detail = error instanceof Error ? error.message : String(error);
      showErrorModal(`${detail}\n\nnote側のDOM変更の可能性があります。診断ログとセレクタ結果を確認してください。`);
    } finally {
      isAutoRunning = false;
    }
  }

  async function maybeAutoRun(): Promise<void> {
    const options = await loadOptions().catch(() => DEFAULT_OPTIONS);
    if (!options.autoRun) return;
    await runExporter(true);
  }

  let sidePanelLastItems: ExportResult['tocData'] = [];
  let sidePanelActiveId: string | null = null;
  let sidePanelScrollListenerAttached = false;
  let sidePanelMutationObserver: MutationObserver | null = null;

  function isSupportedSidePanelPage(): boolean {
    return /^https:\/\/note\.com\//.test(location.href) || /^https:\/\/editor\.note\.com\//.test(location.href);
  }

  function getHeadingElementByTocItem(item: ExportResult['tocData'][number]): HTMLElement | null {
    if (item.id) {
      const direct = document.getElementById(item.id);
      if (direct instanceof HTMLElement) return direct;
    }
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(item.level));
    return candidates.find((element) => (element.textContent ?? '').trim() === item.text) ?? null;
  }

  function getActiveHeadingIdFromViewport(items: ExportResult['tocData']): string | null {
    const viewportOffset = 96;
    let current: string | null = null;
    for (const item of items) {
      const element = getHeadingElementByTocItem(item);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.top <= viewportOffset) current = item.id;
      else break;
    }
    return current ?? items[0]?.id ?? null;
  }

  function notifySidePanelActiveHeading(): void {
    if (sidePanelLastItems.length === 0) return;
    const nextActiveId = getActiveHeadingIdFromViewport(sidePanelLastItems);
    if (nextActiveId === sidePanelActiveId) return;
    sidePanelActiveId = nextActiveId;
    void chrome.runtime.sendMessage({ type: 'NOTE_TOC_ACTIVE_HEADING_CHANGED', activeId: sidePanelActiveId }).catch(() => undefined);
  }

  function attachSidePanelScrollSync(): void {
    if (sidePanelScrollListenerAttached) return;
    sidePanelScrollListenerAttached = true;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        notifySidePanelActiveHeading();
      });
    }, { passive: true });
  }

  function attachSidePanelMutationObserver(): void {
    if (sidePanelMutationObserver) return;
    sidePanelMutationObserver = new MutationObserver(() => notifySidePanelActiveHeading());
    sidePanelMutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function isLikelyNonArticleHeading(text: string): boolean {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const noisePatterns = [
      /^記事を高評価したユーザー$/,
      /^人気記事$/,
      /^ピックアップされています$/,
      /^購入者のコメント$/,
      /^こちらもおすすめ$/,
      /^おすすめ$/,
      /^関連記事$/,
      /^コメント$/,
      /^サポート$/,
      /^クリエイター$/,
      /^マガジン$/
    ];
    return noisePatterns.some((pattern) => pattern.test(normalized));
  }

  function isLikelyArticleHeading(element: HTMLElement): boolean {
    const text = (element.textContent ?? '').trim();
    if (!text || text === '目次' || isLikelyNonArticleHeading(text)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const articleLikeRoot = element.closest('article, main, [class*=article], [class*=note-common-styles], [class*=body], [class*=content]');
    if (!articleLikeRoot) return false;

    const excludedRoot = element.closest('aside, nav, footer, header, [class*=recommend], [class*=related], [class*=comment], [class*=profile], [class*=like], [class*=popular]');
    if (excludedRoot && !excludedRoot.closest('article')) return false;

    return true;
  }

  function buildFallbackSidePanelItems(): ExportResult['tocData'] {
    const selectors = [
      'article h1, article h2, article h3, article h4, article h5, article h6',
      'main article h1, main article h2, main article h3, main article h4, main article h5, main article h6',
      'main h1, main h2, main h3, main h4, main h5, main h6',
      '[class*=note-common-styles] h1, [class*=note-common-styles] h2, [class*=note-common-styles] h3, [class*=note-common-styles] h4, [class*=note-common-styles] h5, [class*=note-common-styles] h6',
      '[class*=article] h1, [class*=article] h2, [class*=article] h3, [class*=article] h4, [class*=article] h5, [class*=article] h6'
    ];

    let headingElements: HTMLElement[] = [];
    for (const selector of selectors) {
      headingElements = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isLikelyArticleHeading);
      if (headingElements.length > 0) break;
    }

    const seen = new Set<HTMLElement>();
    const uniqueHeadings = headingElements.filter((element) => {
      if (seen.has(element)) return false;
      seen.add(element);
      return true;
    });

    return uniqueHeadings.map((element, index) => {
      if (!element.id) element.id = `note-toc-fallback-${index + 1}`;
      const level = element.tagName.toLowerCase();
      return {
        index,
        level: level === 'h1' ? 'h2' : level as ExportResult['tocData'][number]['level'],
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
        id: element.id,
        source: /^https:\/\/editor\.note\.com\//.test(location.href) ? 'editor' : 'published'
      };
    });
  }
  async function getSidePanelState(): Promise<{
    ok: boolean;
    supported: boolean;
    url: string;
    title: string;
    activeId: string | null;
    items: ExportResult['tocData'];
    generatedFromHeadings?: boolean;
    error?: string;
  }> {
    if (!isSupportedSidePanelPage()) {
      return { ok: true, supported: false, url: location.href, title: document.title, activeId: null, items: [] };
    }
    try {
      const result = await buildExportResult();
      sidePanelLastItems = result.tocData;
      attachSidePanelScrollSync();
      attachSidePanelMutationObserver();
      sidePanelActiveId = getActiveHeadingIdFromViewport(sidePanelLastItems);
      return { ok: true, supported: true, url: location.href, title: result.meta.title || document.title, activeId: sidePanelActiveId, items: sidePanelLastItems, generatedFromHeadings: false };
    } catch (error) {
      const fallbackItems = buildFallbackSidePanelItems();
      if (fallbackItems.length > 0) {
        sidePanelLastItems = fallbackItems;
        attachSidePanelScrollSync();
        attachSidePanelMutationObserver();
        sidePanelActiveId = getActiveHeadingIdFromViewport(sidePanelLastItems);
        return { ok: true, supported: true, url: location.href, title: document.title || 'note', activeId: sidePanelActiveId, items: sidePanelLastItems, generatedFromHeadings: true };
      }

      return { ok: false, supported: true, url: location.href, title: document.title, activeId: null, items: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  function jumpToSidePanelItem(id: string | null, index: number | null): void {
    if (id === '__NOTE_TOC_TOP__') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      sidePanelActiveId = id;
      void chrome.runtime.sendMessage({ type: 'NOTE_TOC_ACTIVE_HEADING_CHANGED', activeId: sidePanelActiveId }).catch(() => undefined);
      return;
    }
    if (id === '__NOTE_TOC_BOTTOM__') {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      sidePanelActiveId = id;
      void chrome.runtime.sendMessage({ type: 'NOTE_TOC_ACTIVE_HEADING_CHANGED', activeId: sidePanelActiveId }).catch(() => undefined);
      return;
    }
    let target: HTMLElement | null = null;
    if (id) target = document.getElementById(id);
    if (!target && Number.isFinite(index ?? NaN)) {
      const item = sidePanelLastItems[index as number];
      if (item) target = getHeadingElementByTocItem(item);
    }
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sidePanelActiveId = target.id || id;
    void chrome.runtime.sendMessage({ type: 'NOTE_TOC_ACTIVE_HEADING_CHANGED', activeId: sidePanelActiveId }).catch(() => undefined);
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RUN_NOTE_TOC_EXPORTER') {
      void runExporter(false, message.optionsOverride)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }

    if (message?.type === 'GET_NOTE_TOC_SIDE_PANEL_STATE') {
      void getSidePanelState()
        .then((state) => sendResponse(state))
        .catch((error) => sendResponse({
          ok: false,
          supported: isSupportedSidePanelPage(),
          url: location.href,
          title: document.title,
          activeId: null,
          items: [],
          error: error instanceof Error ? error.message : String(error)
        }));
      return true;
    }

    if (message?.type === 'NOTE_TOC_SIDE_PANEL_JUMP_TO') {
      jumpToSidePanelItem(
        typeof message.id === 'string' ? message.id : null,
        typeof message.index === 'number' ? message.index : null
      );
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  void maybeAutoRun();
}
