import { LOG_PREFIX } from './constants';
import { isEditorPage, isPublishedPage } from './utils';
import type { ExportOptions } from './types';

async function runOnTab(tab: chrome.tabs.Tab, optionsOverride?: Partial<ExportOptions>): Promise<void> {
  if (!tab.id) return;

  const url = tab.url ?? '';
  const isSupportedPage = isEditorPage(url) || isPublishedPage(url);

  if (!isSupportedPage) {
    console.warn(LOG_PREFIX, 'Unsupported page', { url });
    return;
  }

  try {
    await ensureContentScript(tab.id);

    await chrome.tabs.sendMessage(tab.id, { type: 'RUN_NOTE_TOC_EXPORTER', optionsOverride });
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to send message to content script', error);
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'run-note-toc-exporter') return;

  const tab = await getActiveTab();
  if (tab) {
    await runOnTab(tab);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'RUN_NOTE_TOC_EXPORTER_ON_ACTIVE_TAB') {
    void getActiveTab()
      .then(async (tab) => {
        if (!tab) {
          sendResponse({ ok: false, error: 'アクティブタブが見つからんわ。' });
          return;
        }

        await runOnTab(tab, message.optionsOverride);
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message?.type === 'ENSURE_NOTE_TOC_CONTENT_SCRIPT') {
    void (async () => {
      const tabId = Number(message.tabId);
      if (!Number.isFinite(tabId)) {
        sendResponse({ ok: false, error: 'tabId が不正です。' });
        return;
      }
      await ensureContentScript(tabId);
      sendResponse({ ok: true });
    })().catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
    return true;
  }
  if (message?.type === 'GET_NOTE_TOC_ACTIVE_TAB_STATE') {
    void getActiveTab()
      .then((tab) => {
        const url = tab?.url ?? '';
        sendResponse({
          ok: true,
          supported: isEditorPage(url) || isPublishedPage(url),
          url
        });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  return false;
});

if (chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.warn(LOG_PREFIX, 'Failed to set side panel behavior', error);
  });
}