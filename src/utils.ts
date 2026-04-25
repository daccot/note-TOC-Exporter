import { DEFAULT_OPTIONS, HEADING_LEVELS } from './constants';
import type { ArticleMeta, ExportHistoryEntry, ExportOptions, HeadingLevel, TocStats } from './types';

export function isEditorPage(url: string): boolean {
  return /^https:\/\/editor\.note\.com\/notes\/.+\/edit\/?$/.test(url);
}

export function isPublishedPage(url: string): boolean {
  return /^https:\/\/note\.com\/[^/]+\/n\/[^/]+\/?$/.test(url);
}

export function escapeText(text: unknown): string {
  return String(text ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeLevel(level: unknown): HeadingLevel {
  if (typeof level === 'string') {
    const normalized = level.toLowerCase();
    if (HEADING_LEVELS.includes(normalized as HeadingLevel)) return normalized as HeadingLevel;
    if (/^[2-6]$/.test(normalized)) return `h${normalized}` as HeadingLevel;
  }

  if (typeof level === 'number' && level >= 2 && level <= 6) {
    return `h${level}` as HeadingLevel;
  }

  return 'h2';
}

export function levelToDepth(level: HeadingLevel, minHeadingLevel: HeadingLevel): number {
  return Math.max(0, Number(level.slice(1)) - Number(minHeadingLevel.slice(1)));
}

export function buildPublishedUrl(id: string | null): string | null {
  return id ? `#${encodeURIComponent(id)}` : null;
}

export function formatStats(stats: TocStats): string {
  return `Total: ${stats.total}\nH2: ${stats.byLevel.h2}\nH3: ${stats.byLevel.h3}\nH4: ${stats.byLevel.h4}\nH5: ${stats.byLevel.h5}\nH6: ${stats.byLevel.h6}`;
}

export function mergeOptions(raw: Partial<ExportOptions> = {}): ExportOptions {
  const headingColors = raw.headingColors && typeof raw.headingColors === 'object'
    ? { ...DEFAULT_OPTIONS.headingColors, ...raw.headingColors }
    : DEFAULT_OPTIONS.headingColors;

  return {
    exportFormat: raw.exportFormat ?? DEFAULT_OPTIONS.exportFormat,
    orderedList: typeof raw.orderedList === 'boolean' ? raw.orderedList : DEFAULT_OPTIONS.orderedList,
    indentStyle: raw.indentStyle ?? DEFAULT_OPTIONS.indentStyle,
    spacesPerLevel: Number.isFinite(raw.spacesPerLevel) ? Number(raw.spacesPerLevel) : DEFAULT_OPTIONS.spacesPerLevel,
    includeLinks: typeof raw.includeLinks === 'boolean' ? raw.includeLinks : DEFAULT_OPTIONS.includeLinks,
    minHeadingLevel: raw.minHeadingLevel ?? DEFAULT_OPTIONS.minHeadingLevel,
    includeTitle: typeof raw.includeTitle === 'boolean' ? raw.includeTitle : DEFAULT_OPTIONS.includeTitle,
    includeUrl: typeof raw.includeUrl === 'boolean' ? raw.includeUrl : DEFAULT_OPTIONS.includeUrl,
    includePublishedAt: typeof raw.includePublishedAt === 'boolean' ? raw.includePublishedAt : DEFAULT_OPTIONS.includePublishedAt,
    includeStats: typeof raw.includeStats === 'boolean' ? raw.includeStats : DEFAULT_OPTIONS.includeStats,
    autoRun: typeof raw.autoRun === 'boolean' ? raw.autoRun : DEFAULT_OPTIONS.autoRun,
    exclusionRules: Array.isArray(raw.exclusionRules) ? raw.exclusionRules.filter(Boolean) : DEFAULT_OPTIONS.exclusionRules,
    template: typeof raw.template === 'string' ? raw.template : DEFAULT_OPTIONS.template,
    uiLanguage: raw.uiLanguage === 'ja' || raw.uiLanguage === 'en' || raw.uiLanguage === 'auto'
      ? raw.uiLanguage
      : DEFAULT_OPTIONS.uiLanguage,
    showTopBottomItems: typeof raw.showTopBottomItems === 'boolean'
      ? raw.showTopBottomItems
      : DEFAULT_OPTIONS.showTopBottomItems,
    showSubHeadings: typeof raw.showSubHeadings === 'boolean'
      ? raw.showSubHeadings
      : DEFAULT_OPTIONS.showSubHeadings,
    enableH2Collapse: typeof raw.enableH2Collapse === 'boolean'
      ? raw.enableH2Collapse
      : DEFAULT_OPTIONS.enableH2Collapse,
    collapseH2ByDefault: typeof raw.collapseH2ByDefault === 'boolean'
      ? raw.collapseH2ByDefault
      : DEFAULT_OPTIONS.collapseH2ByDefault,
    hideSupportHeadingInPanel: typeof raw.hideSupportHeadingInPanel === 'boolean'
      ? raw.hideSupportHeadingInPanel
      : DEFAULT_OPTIONS.hideSupportHeadingInPanel,
    backgroundImageMode: raw.backgroundImageMode === 'default' || raw.backgroundImageMode === 'none' || raw.backgroundImageMode === 'custom'
      ? raw.backgroundImageMode
      : DEFAULT_OPTIONS.backgroundImageMode,
    backgroundImageDataUrl: typeof raw.backgroundImageDataUrl === 'string'
      ? raw.backgroundImageDataUrl
      : DEFAULT_OPTIONS.backgroundImageDataUrl,
    backgroundOverlayOpacity: Number.isFinite(raw.backgroundOverlayOpacity)
      ? Math.min(0.92, Math.max(0, Number(raw.backgroundOverlayOpacity)))
      : DEFAULT_OPTIONS.backgroundOverlayOpacity,
    headingColors
  };
}

export function matchesExclusionRule(text: string, rules: string[]): boolean {
  const normalizedText = escapeText(text).toLowerCase();
  return rules.some((rule) => normalizedText.includes(escapeText(rule).toLowerCase()));
}

export function slugifyFilenamePart(input: string): string {
  return escapeText(input)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'note-toc';
}

export function buildExportFilename(meta: ArticleMeta, options: ExportOptions, createdAt = new Date()): string {
  const datePart = createdAt.toISOString().slice(0, 10);
  const base = slugifyFilenamePart(meta.title || 'note-toc');
  const extension = options.exportFormat === 'markdown' ? 'md' : options.exportFormat === 'html' ? 'html' : 'txt';
  return `${datePart}-${base}.${extension}`;
}

export function makeHistoryEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildTemplateContext(meta: ArticleMeta, stats: TocStats, toc: string, options: ExportOptions): Record<string, string> {
  const tags = meta.tags.join(', ');
  const statsText = formatStats(stats);
  const isHtml = options.exportFormat === 'html';

  return {
    title: meta.title,
    url: meta.url,
    published_at: meta.publishedAt ?? '',
    author: meta.author ?? '',
    description: meta.description ?? '',
    tags,
    eyecatch_url: meta.eyecatchUrl ?? '',
    stats: statsText,
    toc,
    title_block: options.includeTitle && meta.title ? (isHtml ? `<h1>${meta.title}</h1>` : `# ${meta.title}`) : '',
    url_block: options.includeUrl && meta.url ? (isHtml ? `<p>URL: <a href="${meta.url}">${meta.url}</a></p>` : `URL: ${meta.url}`) : '',
    published_at_block: options.includePublishedAt && meta.publishedAt ? (isHtml ? `<p>Published: ${meta.publishedAt}</p>` : `Published: ${meta.publishedAt}`) : '',
    author_block: meta.author ? (isHtml ? `<p>Author: ${meta.author}</p>` : `Author: ${meta.author}`) : '',
    description_block: meta.description ? (isHtml ? `<p>Description: ${meta.description}</p>` : `Description: ${meta.description}`) : '',
    tags_block: meta.tags.length > 0 ? (isHtml ? `<p>Tags: ${tags}</p>` : `Tags: ${tags}`) : '',
    stats_block: options.includeStats ? (isHtml ? `<pre>${statsText}</pre>` : statsText) : ''
  };
}

export function applyTemplate(template: string, context: Record<string, string>, exportFormat: ExportOptions['exportFormat']): string {
  const toc = context.toc ?? '';
  const rendered = template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => context[key] ?? '');
  const normalized = rendered
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized && exportFormat === 'html') {
    return toc;
  }

  return normalized || toc;
}

export function summarizeHistory(entry: ExportHistoryEntry): string {
  return `${entry.title} (${entry.exportFormat})`;
}
