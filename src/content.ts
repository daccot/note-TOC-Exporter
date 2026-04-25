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
      throw new Error('TOCは取得できたけど、出力が空やった。見出し設定かテンプレ見直してな。');
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
      showErrorModal(`${detail}\n\nnote 側のDOM変更の可能性もあるさけ、下の診断ログとセレクタ結果を見てな。`);
    } finally {
      isAutoRunning = false;
    }
  }

  async function maybeAutoRun(): Promise<void> {
    const options = await loadOptions().catch(() => DEFAULT_OPTIONS);
    if (!options.autoRun) return;
    await runExporter(true);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'RUN_NOTE_TOC_EXPORTER') {
      return false;
    }

    void runExporter(false, message.optionsOverride)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  });

  void maybeAutoRun();
}
