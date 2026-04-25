import { collectNoteArticleToc } from './headings';
import { escapeText, normalizeLevel } from './utils';
import type { ArticleMeta, DiagnosticEntry, TocItem, TocStats } from './types';

interface ExtractionResult {
  label: string;
  tocData: TocItem[];
  meta: ArticleMeta;
  stats: TocStats;
  diagnostics: DiagnosticEntry[];
}

function pushDiagnostic(
  diagnostics: DiagnosticEntry[],
  step: string,
  detail: string,
  status: DiagnosticEntry['status'] = 'info',
  selector?: string
): void {
  const entry: DiagnosticEntry = selector ? { step, detail, status, selector } : { step, detail, status };
  diagnostics.push(entry);
}

function queryWithDiagnostics<T extends Element>(
  diagnostics: DiagnosticEntry[],
  selectors: string[],
  multiple = false
): T[] {
  for (const selector of selectors) {
    const result = Array.from(document.querySelectorAll<T>(selector));
    if (result.length > 0) {
      pushDiagnostic(diagnostics, 'selector-match', `Matched ${result.length} element(s).`, 'info', selector);
      return result;
    }
    pushDiagnostic(diagnostics, 'selector-miss', 'No element matched selector.', 'warn', selector);
  }

  return [];
}

function getEditorTocData(diagnostics: DiagnosticEntry[]): TocItem[] {
  const [tocHost] = queryWithDiagnostics<HTMLElement>(diagnostics, ['table-of-contents', '[data-testid="table-of-contents"]']);
  if (!tocHost) {
    throw new Error('編集画面の table-of-contents 要素が見つかりません。note 側のDOM変更の可能性あるで。');
  }

  const raw = tocHost.getAttribute('toc') ?? tocHost.getAttribute('data-toc');
  if (!raw) {
    pushDiagnostic(diagnostics, 'editor-toc', 'TOC host found but no toc/data-toc attribute was present.', 'error');
    throw new Error('編集画面の toc 属性が見つかりません。note 側のDOM変更の可能性あるで。');
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`編集画面の toc JSON の解析に失敗しました: ${message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('編集画面の toc データが空です。');
  }

  pushDiagnostic(diagnostics, 'editor-toc', `Parsed ${data.length} TOC row(s) from editor JSON.`);

  return data
    .map((item, index) => {
      const row = item as {
        level?: unknown;
        text?: unknown;
        node?: { attrs?: { id?: unknown } };
      };

      return {
        index,
        level: normalizeLevel(row.level),
        text: escapeText(row.text),
        id: typeof row.node?.attrs?.id === 'string' ? row.node.attrs.id : null,
        source: 'editor' as const
      };
    })
    .filter((item) => item.text);
}

function getEditorFallbackTocData(diagnostics: DiagnosticEntry[]): TocItem[] {
  const tocData = collectNoteArticleToc('editor');
  if (tocData.length === 0) {
    throw new Error('編集画面の本文見出しが見つかりません。note 側のDOM変更の可能性あるで。');
  }

  pushDiagnostic(diagnostics, 'editor-fallback-headings', `Collected ${tocData.length} heading(s) from editor body.`);
  return tocData;
}

function getPublishedTocItems(diagnostics: DiagnosticEntry[]): HTMLLIElement[] {
  return queryWithDiagnostics<HTMLLIElement>(
    diagnostics,
    ['nav[aria-label="目次"] li[data-level]', '#table-of-contents-list li', '[data-testid="table-of-contents"] li', 'aside nav li[data-level]'],
    true
  );
}

function readFirstText(diagnostics: DiagnosticEntry[], step: string, selectors: string[]): string | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = element?.getAttribute('content') ?? element?.getAttribute('datetime') ?? element?.textContent;
    if (value && escapeText(value)) {
      pushDiagnostic(diagnostics, step, `Resolved value from selector.`, 'info', selector);
      return escapeText(value);
    }
    pushDiagnostic(diagnostics, step, 'Selector did not resolve a value.', 'warn', selector);
  }
  return null;
}

function readTags(diagnostics: DiagnosticEntry[]): string[] {
  const selectors = ['meta[property="article:tag"]', 'a[href*="/hashtag/"]', '[data-testid="tag-list"] a'];
  const tags = selectors.flatMap((selector) => {
    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length > 0) {
      pushDiagnostic(diagnostics, 'meta-tags', `Resolved ${elements.length} tag candidate(s).`, 'info', selector);
    } else {
      pushDiagnostic(diagnostics, 'meta-tags', 'No tags found for selector.', 'warn', selector);
    }
    return elements.map((element) => escapeText(element.getAttribute('content') ?? element.textContent)).filter(Boolean);
  });

  return Array.from(new Set(tags));
}

function getStats(tocData: TocItem[]): TocStats {
  const byLevel: TocStats['byLevel'] = { h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  tocData.forEach((item) => {
    byLevel[item.level] += 1;
  });
  return { total: tocData.length, byLevel };
}

function getMeta(diagnostics: DiagnosticEntry[]): ArticleMeta {
  return {
    title: readFirstText(diagnostics, 'meta-title', ['meta[property="og:title"]', 'h1', 'title']) ?? 'note TOC',
    url: location.href,
    publishedAt: readFirstText(diagnostics, 'meta-published-at', ['meta[property="article:published_time"]', 'meta[name="publish-date"]', 'time[datetime]']),
    author: readFirstText(diagnostics, 'meta-author', ['meta[name="author"]', 'a[rel="author"]', '[data-testid="note-author-name"]']),
    description: readFirstText(diagnostics, 'meta-description', ['meta[property="og:description"]', 'meta[name="description"]']),
    tags: readTags(diagnostics),
    eyecatchUrl: readFirstText(diagnostics, 'meta-eyecatch', ['meta[property="og:image"]', 'img[alt][src]'])
  };
}

function getHeadingMap(): Map<string, HTMLElement[]> {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h2[id], h3[id], h4[id], h5[id], h6[id]')).filter(
    (element) => escapeText(element.textContent) !== '目次'
  );

  const map = new Map<string, HTMLElement[]>();
  for (const heading of headings) {
    const key = `${heading.tagName.toLowerCase()}::${escapeText(heading.textContent)}`;
    const bucket = map.get(key) ?? [];
    bucket.push(heading);
    map.set(key, bucket);
  }

  return map;
}

function resolvePublishedId(item: HTMLLIElement, headingMap: Map<string, HTMLElement[]>, diagnostics: DiagnosticEntry[]): string | null {
  const anchor = item.querySelector<HTMLAnchorElement>('a[href*="#"]');
  const href = anchor?.getAttribute('href');
  if (href?.includes('#')) {
    pushDiagnostic(diagnostics, 'published-anchor', 'Resolved heading id from TOC anchor href.');
    return decodeURIComponent(href.slice(href.indexOf('#') + 1));
  }

  const text = escapeText(item.textContent);
  const level = normalizeLevel(item.dataset.level ?? 'h2');
  const key = `${level}::${text}`;
  const bucket = headingMap.get(key);
  if (!bucket || bucket.length === 0) {
    pushDiagnostic(diagnostics, 'published-id-fallback', `Unable to resolve id for "${text}".`, 'warn');
    return null;
  }

  pushDiagnostic(diagnostics, 'published-id-fallback', `Resolved id for "${text}" by matching heading text.`, 'warn');
  return bucket.shift()?.id ?? null;
}

function getPublishedTocData(diagnostics: DiagnosticEntry[]): TocItem[] {
  const articleHeadings = collectNoteArticleToc('published');
  if (articleHeadings.length > 0) {
    pushDiagnostic(diagnostics, 'published-body-headings', `Collected ${articleHeadings.length} heading(s) from article body.`);
    return articleHeadings;
  }

  const tocItems = getPublishedTocItems(diagnostics);
  if (tocItems.length === 0) {
    throw new Error('公開画面の TOC 項目が見つかりません。note 側のDOM変更の可能性あるで。');
  }

  const headingMap = getHeadingMap();
  pushDiagnostic(diagnostics, 'published-headings', `Indexed ${Array.from(headingMap.values()).flat().length} heading(s).`);

  return tocItems
    .map((element, index) => ({
      index,
      level: normalizeLevel(element.dataset.level ?? 'h2'),
      text: escapeText(element.textContent),
      id: resolvePublishedId(element, headingMap, diagnostics),
      source: 'published' as const
    }))
    .filter((item) => item.text);
}

export async function waitForTocData(url: string): Promise<ExtractionResult> {
  const maxAttempts = 30;
  const diagnostics: DiagnosticEntry[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      pushDiagnostic(diagnostics, 'attempt', `Attempt ${attempt + 1}/${maxAttempts} for ${url}`);

      if (/^https:\/\/editor\.note\.com\//.test(url)) {
        let tocData: TocItem[];
        try {
          tocData = getEditorTocData(diagnostics);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pushDiagnostic(diagnostics, 'editor-fallback', message, 'warn');
          tocData = getEditorFallbackTocData(diagnostics);
        }
        if (tocData.length > 0) {
          return { label: '編集画面', tocData, meta: getMeta(diagnostics), stats: getStats(tocData), diagnostics };
        }
      }

      if (/^https:\/\/note\.com\//.test(url)) {
        const tocData = getPublishedTocData(diagnostics);
        if (tocData.length > 0) {
          return { label: '公開画面', tocData, meta: getMeta(diagnostics), stats: getStats(tocData), diagnostics };
        }
      }

      throw new Error(`未対応のURLです: ${url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushDiagnostic(diagnostics, 'error', message, 'error');
      if (attempt === maxAttempts - 1) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
  }

  throw new Error('TOC取得の待機がタイムアウトしました。');
}
