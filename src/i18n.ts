import type { UiLanguage } from './types';

export type ResolvedLanguage = 'ja' | 'en';

const messages = {
  ja: {
    panelTitle: 'note TOC Panel',
    checkingPage: '対応ページを確認しています...',
    loadingToc: 'TOCを読み込んでいます。',
    reload: '再読込',
    legacyModal: '従来モーダル',
    unsupportedPage: 'note.com または editor.note.com の記事・編集画面を開くと、ここにTOCが表示されます。',
    noActiveTab: 'アクティブタブが見つかりません。',
    noTocItems: 'TOC項目がありません。見出しが存在する記事で再度お試しください。',
    failedToLoad: '読み込みに失敗しました',
    failedToJump: 'ジャンプに失敗しました',
    failedToOpenLegacy: '従来モーダルの起動に失敗しました',
    copySelected: '選択項目をコピー',
    selectAll: '全選択',
    clearSelection: '全解除',
    copiedSelected: '選択したTOCをコピーしました。',
    noSelectedItems: 'コピー対象のTOC項目を選択してください。',
    topOfPage: '一番上へ',
    bottomOfPage: '一番下へ',
    missingJumpId: 'ジャンプID未検出',
    headings: 'headings'
  },
  en: {
    panelTitle: 'note TOC Panel',
    checkingPage: 'Checking the current page...',
    loadingToc: 'Loading TOC...',
    reload: 'Reload',
    legacyModal: 'Legacy modal',
    unsupportedPage: 'Open a note.com article or editor page to display the TOC here.',
    noActiveTab: 'No active tab was found.',
    noTocItems: 'No TOC items were found. Please try again on an article with headings.',
    failedToLoad: 'Failed to load',
    failedToJump: 'Failed to jump',
    failedToOpenLegacy: 'Failed to open the legacy modal',
    copySelected: 'Copy selected',
    selectAll: 'Select all',
    clearSelection: 'Clear',
    copiedSelected: 'Copied the selected TOC items.',
    noSelectedItems: 'Select TOC items to copy.',
    topOfPage: 'Top of page',
    bottomOfPage: 'Bottom of page',
    missingJumpId: 'No jump ID detected',
    headings: 'headings'
  }
} as const;

export type MessageKey = keyof typeof messages.ja;

export function resolveLanguage(language: UiLanguage | undefined, browserLanguage = navigator.language): ResolvedLanguage {
  if (language === 'ja' || language === 'en') return language;
  return /^ja/i.test(browserLanguage) ? 'ja' : 'en';
}

export function t(language: UiLanguage | undefined, key: MessageKey): string {
  const resolved = resolveLanguage(language);
  return messages[resolved][key];
}