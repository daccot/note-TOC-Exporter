import { applyTemplate, buildExportFilename, buildPublishedUrl, buildTemplateContext, escapeText, levelToDepth, matchesExclusionRule } from './utils';
import type { ArticleMeta, ExportOptions, TocItem, TocStats } from './types';

function buildIndent(depth: number, options: ExportOptions): string {
  if (depth <= 0) return '';
  if (options.indentStyle === 'fullWidth') return '　'.repeat(depth);
  return ' '.repeat(depth * options.spacesPerLevel);
}

function filterItems(tocData: TocItem[], options: ExportOptions): TocItem[] {
  return tocData.filter((item) => {
    if (Number(item.level.slice(1)) < Number(options.minHeadingLevel.slice(1))) return false;
    if (matchesExclusionRule(item.text, options.exclusionRules)) return false;
    return true;
  });
}

function formatListItems(tocData: TocItem[], options: ExportOptions): string[] {
  return filterItems(tocData, options).map((item, visibleIndex) => {
    const indent = buildIndent(levelToDepth(item.level, options.minHeadingLevel), options);
    const marker = options.orderedList ? `${visibleIndex + 1}.` : '-';
    const text = escapeText(item.text);

    if (!options.includeLinks) {
      return `${indent}${marker} ${text}`;
    }

    const href = buildPublishedUrl(item.id);
    return href ? `${indent}${marker} [${text}](${href})` : `${indent}${marker} ${text}`;
  });
}

function formatPlainItems(tocData: TocItem[], options: ExportOptions): string[] {
  return filterItems(tocData, options).map((item, visibleIndex) => {
    const indent = buildIndent(levelToDepth(item.level, options.minHeadingLevel), options);
    const marker = options.orderedList ? `${visibleIndex + 1}.` : '-';
    const text = escapeText(item.text);
    const href = options.includeLinks ? buildPublishedUrl(item.id) : null;
    const suffix = href ? ` ${href}` : '';
    return `${indent}${marker} ${text}${suffix}`.trimEnd();
  });
}

function formatHtmlItems(tocData: TocItem[], options: ExportOptions): string {
  const items = filterItems(tocData, options).map((item, visibleIndex) => {
    const text = escapeText(item.text);
    const href = options.includeLinks ? buildPublishedUrl(item.id) : null;
    const content = href ? `<a href="${href}">${text}</a>` : text;
    return `<li data-level="${item.level}" data-index="${visibleIndex}">${content}</li>`;
  });

  const listTag = options.orderedList ? 'ol' : 'ul';
  return `<${listTag}>\n${items.join('\n')}\n</${listTag}>`;
}

function buildTocBody(tocData: TocItem[], options: ExportOptions): string {
  if (options.exportFormat === 'html') {
    return formatHtmlItems(tocData, options);
  }

  if (options.exportFormat === 'plain') {
    return formatPlainItems(tocData, options).join('\n');
  }

  return formatListItems(tocData, options).join('\n');
}

export function formatExport(tocData: TocItem[], meta: ArticleMeta, stats: TocStats, options: ExportOptions): { output: string; filename: string } {
  const tocBody = buildTocBody(tocData, options);
  const context = buildTemplateContext(meta, stats, tocBody, options);
  const output = applyTemplate(options.template, context, options.exportFormat);
  const filename = buildExportFilename(meta, options);
  return { output, filename };
}
