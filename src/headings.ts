import { escapeText, normalizeLevel } from './utils';
import type { HeadingLevel, TocItem, TocSource } from './types';

const NOTE_HEADING_SELECTORS = [
  'article h2',
  'article h3',
  'article h4',
  'article h5',
  'article h6',
  'main h2',
  'main h3',
  'main h4',
  'main h5',
  'main h6',
  '[data-name="body"] h2',
  '[data-name="body"] h3',
  '[data-name="body"] h4',
  '[data-name="body"] h5',
  '[data-name="body"] h6',
  '.note-common-styles__textnote-body h2',
  '.note-common-styles__textnote-body h3',
  '.note-common-styles__textnote-body h4',
  '.note-common-styles__textnote-body h5',
  '.note-common-styles__textnote-body h6',
  '[class*="note-common-styles"] h2',
  '[class*="note-common-styles"] h3',
  '[class*="note-common-styles"] h4',
  '[class*="note-common-styles"] h5',
  '[class*="note-common-styles"] h6'
].join(', ');

const EXCLUDED_CONTAINER_SELECTOR = [
  'nav',
  'header',
  'footer',
  'aside',
  'dialog',
  '[role="dialog"]',
  '.modal',
  '[class*="comment"]',
  '[class*="recommend"]',
  '[class*="related"]',
  '[class*="profile"]',
  '[class*="popular"]'
].join(', ');

const ARTICLE_ROOT_SELECTOR = [
  'article',
  'main',
  '[data-name="body"]',
  '[class*="article"]',
  '[class*="note-common-styles"]',
  '[class*="body"]',
  '[class*="content"]'
].join(', ');

const NOISE_PATTERNS = [
  /^目次$/,
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

function getHeadingLevelValue(level: string): number | null {
  const match = level.match(/^h([2-6])$/i);
  return match ? Number(match[1]) : null;
}

function isNoiseHeading(text: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

export function getBaseHeadingLevel(items: Array<{ level: string }>): HeadingLevel {
  const levels = items
    .map((item) => getHeadingLevelValue(item.level))
    .filter((level): level is number => level !== null);

  const baseLevel = levels.length > 0 ? Math.min(...levels) : 2;
  return `h${baseLevel}` as HeadingLevel;
}

export function getEffectiveBaseHeadingLevel(items: Array<{ level: string }>, minimumLevel: HeadingLevel): HeadingLevel {
  const minimumLevelValue = getHeadingLevelValue(minimumLevel) ?? 2;
  const filtered = items.filter((item) => {
    const level = getHeadingLevelValue(item.level);
    return level !== null && level >= minimumLevelValue;
  });

  return filtered.length > 0 ? getBaseHeadingLevel(filtered) : minimumLevel;
}

export function getHeadingDepth(level: string, baseLevel: string): number {
  const levelValue = getHeadingLevelValue(level);
  const baseLevelValue = getHeadingLevelValue(baseLevel);
  if (levelValue === null || baseLevelValue === null) return 0;
  return Math.max(0, levelValue - baseLevelValue);
}

export function isNoteArticleHeadingElement(element: HTMLElement): boolean {
  const text = escapeText(element.textContent);
  if (!text || isNoiseHeading(text)) return false;
  if (getHeadingLevelValue(element.tagName.toLowerCase()) === null) return false;
  if (!element.closest(ARTICLE_ROOT_SELECTOR)) return false;

  const excludedRoot = element.closest(EXCLUDED_CONTAINER_SELECTOR);
  if (excludedRoot && !excludedRoot.closest('article')) return false;

  return true;
}

export function collectNoteArticleHeadingElements(root: ParentNode = document): HTMLElement[] {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(NOTE_HEADING_SELECTORS)).filter(isNoteArticleHeadingElement);
  const seen = new Set<HTMLElement>();

  return candidates.filter((element) => {
    if (seen.has(element)) return false;
    seen.add(element);
    return true;
  });
}

export function buildTocItemsFromHeadingElements(elements: HTMLElement[], source: TocSource): TocItem[] {
  return elements
    .map((element, index) => {
      const text = escapeText(element.textContent);
      if (!text) return null;

      if (!element.id) {
        element.id = `note-toc-heading-${index + 1}`;
      }

      const item: TocItem = {
        index,
        level: normalizeLevel(element.tagName),
        text,
        id: element.id,
        source
      };

      return item;
    })
    .filter((item): item is TocItem => item !== null);
}

export function collectNoteArticleToc(source: TocSource, root: ParentNode = document): TocItem[] {
  return buildTocItemsFromHeadingElements(collectNoteArticleHeadingElements(root), source);
}
