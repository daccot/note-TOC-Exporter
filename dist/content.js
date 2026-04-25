"use strict";
(() => {
  // src/constants.ts
  var LOG_PREFIX = "[note-toc-exporter]";
  var MODAL_ID = "note-toc-exporter-modal";
  var STORAGE_KEY = "noteTocExporterOptions";
  var HISTORY_STORAGE_KEY = "noteTocExporterHistory";
  var HISTORY_LIMIT = 10;
  var DEFAULT_OPTIONS = {
    exportFormat: "markdown",
    orderedList: false,
    indentStyle: "spaces",
    spacesPerLevel: 2,
    includeLinks: true,
    minHeadingLevel: "h2",
    includeTitle: false,
    includeUrl: false,
    includePublishedAt: false,
    includeStats: false,
    autoRun: false,
    exclusionRules: [],
    template: "{{title_block}}\n{{toc}}",
    uiLanguage: "auto",
    showTopBottomItems: true,
    showSubHeadings: false,
    enableH2Collapse: true,
    collapseH2ByDefault: false,
    backgroundImageMode: "default",
    backgroundImageDataUrl: "",
    backgroundOverlayOpacity: 0.58,
    headingColors: {
      h2: "#eff6ff",
      h3: "#f0fdf4",
      h4: "#fff7ed",
      h5: "#f5f3ff",
      h6: "#f8fafc"
    }
  };
  var HEADING_LEVELS = ["h2", "h3", "h4", "h5", "h6"];

  // src/utils.ts
  function escapeText(text) {
    return String(text ?? "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  }
  function normalizeLevel(level) {
    if (typeof level === "string") {
      const normalized = level.toLowerCase();
      if (HEADING_LEVELS.includes(normalized)) return normalized;
      if (/^[2-6]$/.test(normalized)) return `h${normalized}`;
    }
    if (typeof level === "number" && level >= 2 && level <= 6) {
      return `h${level}`;
    }
    return "h2";
  }
  function levelToDepth(level, minHeadingLevel) {
    return Math.max(0, Number(level.slice(1)) - Number(minHeadingLevel.slice(1)));
  }
  function buildPublishedUrl(id) {
    return id ? `#${encodeURIComponent(id)}` : null;
  }
  function formatStats(stats) {
    return `Total: ${stats.total}
H2: ${stats.byLevel.h2}
H3: ${stats.byLevel.h3}
H4: ${stats.byLevel.h4}
H5: ${stats.byLevel.h5}
H6: ${stats.byLevel.h6}`;
  }
  function mergeOptions(raw = {}) {
    const headingColors = raw.headingColors && typeof raw.headingColors === "object" ? { ...DEFAULT_OPTIONS.headingColors, ...raw.headingColors } : DEFAULT_OPTIONS.headingColors;
    return {
      exportFormat: raw.exportFormat ?? DEFAULT_OPTIONS.exportFormat,
      orderedList: typeof raw.orderedList === "boolean" ? raw.orderedList : DEFAULT_OPTIONS.orderedList,
      indentStyle: raw.indentStyle ?? DEFAULT_OPTIONS.indentStyle,
      spacesPerLevel: Number.isFinite(raw.spacesPerLevel) ? Number(raw.spacesPerLevel) : DEFAULT_OPTIONS.spacesPerLevel,
      includeLinks: typeof raw.includeLinks === "boolean" ? raw.includeLinks : DEFAULT_OPTIONS.includeLinks,
      minHeadingLevel: raw.minHeadingLevel ?? DEFAULT_OPTIONS.minHeadingLevel,
      includeTitle: typeof raw.includeTitle === "boolean" ? raw.includeTitle : DEFAULT_OPTIONS.includeTitle,
      includeUrl: typeof raw.includeUrl === "boolean" ? raw.includeUrl : DEFAULT_OPTIONS.includeUrl,
      includePublishedAt: typeof raw.includePublishedAt === "boolean" ? raw.includePublishedAt : DEFAULT_OPTIONS.includePublishedAt,
      includeStats: typeof raw.includeStats === "boolean" ? raw.includeStats : DEFAULT_OPTIONS.includeStats,
      autoRun: typeof raw.autoRun === "boolean" ? raw.autoRun : DEFAULT_OPTIONS.autoRun,
      exclusionRules: Array.isArray(raw.exclusionRules) ? raw.exclusionRules.filter(Boolean) : DEFAULT_OPTIONS.exclusionRules,
      template: typeof raw.template === "string" ? raw.template : DEFAULT_OPTIONS.template,
      uiLanguage: raw.uiLanguage === "ja" || raw.uiLanguage === "en" || raw.uiLanguage === "auto" ? raw.uiLanguage : DEFAULT_OPTIONS.uiLanguage,
      showTopBottomItems: typeof raw.showTopBottomItems === "boolean" ? raw.showTopBottomItems : DEFAULT_OPTIONS.showTopBottomItems,
      showSubHeadings: typeof raw.showSubHeadings === "boolean" ? raw.showSubHeadings : DEFAULT_OPTIONS.showSubHeadings,
      enableH2Collapse: typeof raw.enableH2Collapse === "boolean" ? raw.enableH2Collapse : DEFAULT_OPTIONS.enableH2Collapse,
      collapseH2ByDefault: typeof raw.collapseH2ByDefault === "boolean" ? raw.collapseH2ByDefault : DEFAULT_OPTIONS.collapseH2ByDefault,
      backgroundImageMode: raw.backgroundImageMode === "default" || raw.backgroundImageMode === "none" || raw.backgroundImageMode === "custom" ? raw.backgroundImageMode : DEFAULT_OPTIONS.backgroundImageMode,
      backgroundImageDataUrl: typeof raw.backgroundImageDataUrl === "string" ? raw.backgroundImageDataUrl : DEFAULT_OPTIONS.backgroundImageDataUrl,
      backgroundOverlayOpacity: Number.isFinite(raw.backgroundOverlayOpacity) ? Math.min(0.92, Math.max(0, Number(raw.backgroundOverlayOpacity))) : DEFAULT_OPTIONS.backgroundOverlayOpacity,
      headingColors
    };
  }
  function matchesExclusionRule(text, rules) {
    const normalizedText = escapeText(text).toLowerCase();
    return rules.some((rule) => normalizedText.includes(escapeText(rule).toLowerCase()));
  }
  function slugifyFilenamePart(input) {
    return escapeText(input).replace(/[\\/:*?"<>|]+/g, "-").replace(/\.+$/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || "note-toc";
  }
  function buildExportFilename(meta, options, createdAt = /* @__PURE__ */ new Date()) {
    const datePart = createdAt.toISOString().slice(0, 10);
    const base = slugifyFilenamePart(meta.title || "note-toc");
    const extension = options.exportFormat === "markdown" ? "md" : options.exportFormat === "html" ? "html" : "txt";
    return `${datePart}-${base}.${extension}`;
  }
  function makeHistoryEntryId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function buildTemplateContext(meta, stats, toc, options) {
    const tags = meta.tags.join(", ");
    const statsText = formatStats(stats);
    const isHtml = options.exportFormat === "html";
    return {
      title: meta.title,
      url: meta.url,
      published_at: meta.publishedAt ?? "",
      author: meta.author ?? "",
      description: meta.description ?? "",
      tags,
      eyecatch_url: meta.eyecatchUrl ?? "",
      stats: statsText,
      toc,
      title_block: options.includeTitle && meta.title ? isHtml ? `<h1>${meta.title}</h1>` : `# ${meta.title}` : "",
      url_block: options.includeUrl && meta.url ? isHtml ? `<p>URL: <a href="${meta.url}">${meta.url}</a></p>` : `URL: ${meta.url}` : "",
      published_at_block: options.includePublishedAt && meta.publishedAt ? isHtml ? `<p>Published: ${meta.publishedAt}</p>` : `Published: ${meta.publishedAt}` : "",
      author_block: meta.author ? isHtml ? `<p>Author: ${meta.author}</p>` : `Author: ${meta.author}` : "",
      description_block: meta.description ? isHtml ? `<p>Description: ${meta.description}</p>` : `Description: ${meta.description}` : "",
      tags_block: meta.tags.length > 0 ? isHtml ? `<p>Tags: ${tags}</p>` : `Tags: ${tags}` : "",
      stats_block: options.includeStats ? isHtml ? `<pre>${statsText}</pre>` : statsText : ""
    };
  }
  function applyTemplate(template, context, exportFormat) {
    const toc = context.toc ?? "";
    const rendered = template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key) => context[key] ?? "");
    const normalized = rendered.split(/\r?\n/).map((line) => line.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!normalized && exportFormat === "html") {
      return toc;
    }
    return normalized || toc;
  }

  // src/extractor.ts
  function pushDiagnostic(diagnostics, step, detail, status = "info", selector) {
    const entry = selector ? { step, detail, status, selector } : { step, detail, status };
    diagnostics.push(entry);
  }
  function queryWithDiagnostics(diagnostics, selectors, multiple = false) {
    for (const selector of selectors) {
      const result = Array.from(document.querySelectorAll(selector));
      if (result.length > 0) {
        pushDiagnostic(diagnostics, "selector-match", `Matched ${result.length} element(s).`, "info", selector);
        return result;
      }
      pushDiagnostic(diagnostics, "selector-miss", "No element matched selector.", "warn", selector);
    }
    return [];
  }
  function getEditorTocData(diagnostics) {
    const [tocHost] = queryWithDiagnostics(diagnostics, ["table-of-contents", '[data-testid="table-of-contents"]']);
    if (!tocHost) {
      throw new Error("\u7DE8\u96C6\u753B\u9762\u306E table-of-contents \u8981\u7D20\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002note \u5074\u306EDOM\u5909\u66F4\u306E\u53EF\u80FD\u6027\u3042\u308B\u3067\u3002");
    }
    const raw = tocHost.getAttribute("toc") ?? tocHost.getAttribute("data-toc");
    if (!raw) {
      pushDiagnostic(diagnostics, "editor-toc", "TOC host found but no toc/data-toc attribute was present.", "error");
      throw new Error("\u7DE8\u96C6\u753B\u9762\u306E toc \u5C5E\u6027\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002note \u5074\u306EDOM\u5909\u66F4\u306E\u53EF\u80FD\u6027\u3042\u308B\u3067\u3002");
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`\u7DE8\u96C6\u753B\u9762\u306E toc JSON \u306E\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${message}`);
    }
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("\u7DE8\u96C6\u753B\u9762\u306E toc \u30C7\u30FC\u30BF\u304C\u7A7A\u3067\u3059\u3002");
    }
    pushDiagnostic(diagnostics, "editor-toc", `Parsed ${data.length} TOC row(s) from editor JSON.`);
    return data.map((item, index) => {
      const row = item;
      return {
        index,
        level: normalizeLevel(row.level),
        text: escapeText(row.text),
        id: typeof row.node?.attrs?.id === "string" ? row.node.attrs.id : null,
        source: "editor"
      };
    }).filter((item) => item.text);
  }
  function getPublishedTocItems(diagnostics) {
    return queryWithDiagnostics(
      diagnostics,
      ['nav[aria-label="\u76EE\u6B21"] li[data-level]', "#table-of-contents-list li", '[data-testid="table-of-contents"] li', "aside nav li[data-level]"],
      true
    );
  }
  function readFirstText(diagnostics, step, selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = element?.getAttribute("content") ?? element?.getAttribute("datetime") ?? element?.textContent;
      if (value && escapeText(value)) {
        pushDiagnostic(diagnostics, step, `Resolved value from selector.`, "info", selector);
        return escapeText(value);
      }
      pushDiagnostic(diagnostics, step, "Selector did not resolve a value.", "warn", selector);
    }
    return null;
  }
  function readTags(diagnostics) {
    const selectors = ['meta[property="article:tag"]', 'a[href*="/hashtag/"]', '[data-testid="tag-list"] a'];
    const tags = selectors.flatMap((selector) => {
      const elements = Array.from(document.querySelectorAll(selector));
      if (elements.length > 0) {
        pushDiagnostic(diagnostics, "meta-tags", `Resolved ${elements.length} tag candidate(s).`, "info", selector);
      } else {
        pushDiagnostic(diagnostics, "meta-tags", "No tags found for selector.", "warn", selector);
      }
      return elements.map((element) => escapeText(element.getAttribute("content") ?? element.textContent)).filter(Boolean);
    });
    return Array.from(new Set(tags));
  }
  function getStats(tocData) {
    const byLevel = { h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    tocData.forEach((item) => {
      byLevel[item.level] += 1;
    });
    return { total: tocData.length, byLevel };
  }
  function getMeta(diagnostics) {
    return {
      title: readFirstText(diagnostics, "meta-title", ['meta[property="og:title"]', "h1", "title"]) ?? "note TOC",
      url: location.href,
      publishedAt: readFirstText(diagnostics, "meta-published-at", ['meta[property="article:published_time"]', 'meta[name="publish-date"]', "time[datetime]"]),
      author: readFirstText(diagnostics, "meta-author", ['meta[name="author"]', 'a[rel="author"]', '[data-testid="note-author-name"]']),
      description: readFirstText(diagnostics, "meta-description", ['meta[property="og:description"]', 'meta[name="description"]']),
      tags: readTags(diagnostics),
      eyecatchUrl: readFirstText(diagnostics, "meta-eyecatch", ['meta[property="og:image"]', "img[alt][src]"])
    };
  }
  function getHeadingMap() {
    const headings = Array.from(document.querySelectorAll("h2[id], h3[id], h4[id], h5[id], h6[id]")).filter(
      (element) => escapeText(element.textContent) !== "\u76EE\u6B21"
    );
    const map = /* @__PURE__ */ new Map();
    for (const heading of headings) {
      const key = `${heading.tagName.toLowerCase()}::${escapeText(heading.textContent)}`;
      const bucket = map.get(key) ?? [];
      bucket.push(heading);
      map.set(key, bucket);
    }
    return map;
  }
  function resolvePublishedId(item, headingMap, diagnostics) {
    const anchor = item.querySelector('a[href*="#"]');
    const href = anchor?.getAttribute("href");
    if (href?.includes("#")) {
      pushDiagnostic(diagnostics, "published-anchor", "Resolved heading id from TOC anchor href.");
      return decodeURIComponent(href.slice(href.indexOf("#") + 1));
    }
    const text = escapeText(item.textContent);
    const level = normalizeLevel(item.dataset.level ?? "h2");
    const key = `${level}::${text}`;
    const bucket = headingMap.get(key);
    if (!bucket || bucket.length === 0) {
      pushDiagnostic(diagnostics, "published-id-fallback", `Unable to resolve id for "${text}".`, "warn");
      return null;
    }
    pushDiagnostic(diagnostics, "published-id-fallback", `Resolved id for "${text}" by matching heading text.`, "warn");
    return bucket.shift()?.id ?? null;
  }
  function getPublishedTocData(diagnostics) {
    const tocItems = getPublishedTocItems(diagnostics);
    if (tocItems.length === 0) {
      throw new Error("\u516C\u958B\u753B\u9762\u306E TOC \u9805\u76EE\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002note \u5074\u306EDOM\u5909\u66F4\u306E\u53EF\u80FD\u6027\u3042\u308B\u3067\u3002");
    }
    const headingMap = getHeadingMap();
    pushDiagnostic(diagnostics, "published-headings", `Indexed ${Array.from(headingMap.values()).flat().length} heading(s).`);
    return tocItems.map((element, index) => ({
      index,
      level: normalizeLevel(element.dataset.level ?? "h2"),
      text: escapeText(element.textContent),
      id: resolvePublishedId(element, headingMap, diagnostics),
      source: "published"
    })).filter((item) => item.text);
  }
  async function waitForTocData(url) {
    const maxAttempts = 30;
    const diagnostics = [];
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        pushDiagnostic(diagnostics, "attempt", `Attempt ${attempt + 1}/${maxAttempts} for ${url}`);
        if (/^https:\/\/editor\.note\.com\//.test(url)) {
          const tocData = getEditorTocData(diagnostics);
          if (tocData.length > 0) {
            return { label: "\u7DE8\u96C6\u753B\u9762", tocData, meta: getMeta(diagnostics), stats: getStats(tocData), diagnostics };
          }
        }
        if (/^https:\/\/note\.com\//.test(url)) {
          const tocData = getPublishedTocData(diagnostics);
          if (tocData.length > 0) {
            return { label: "\u516C\u958B\u753B\u9762", tocData, meta: getMeta(diagnostics), stats: getStats(tocData), diagnostics };
          }
        }
        throw new Error(`\u672A\u5BFE\u5FDC\u306EURL\u3067\u3059: ${url}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushDiagnostic(diagnostics, "error", message, "error");
        if (attempt === maxAttempts - 1) throw error;
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }
    }
    throw new Error("TOC\u53D6\u5F97\u306E\u5F85\u6A5F\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F\u3002");
  }

  // src/formatter.ts
  function buildIndent(depth, options) {
    if (depth <= 0) return "";
    if (options.indentStyle === "fullWidth") return "\u3000".repeat(depth);
    return " ".repeat(depth * options.spacesPerLevel);
  }
  function filterItems(tocData, options) {
    return tocData.filter((item) => {
      if (Number(item.level.slice(1)) < Number(options.minHeadingLevel.slice(1))) return false;
      if (matchesExclusionRule(item.text, options.exclusionRules)) return false;
      return true;
    });
  }
  function formatListItems(tocData, options) {
    return filterItems(tocData, options).map((item, visibleIndex) => {
      const indent = buildIndent(levelToDepth(item.level, options.minHeadingLevel), options);
      const marker = options.orderedList ? `${visibleIndex + 1}.` : "-";
      const text = escapeText(item.text);
      if (!options.includeLinks) {
        return `${indent}${marker} ${text}`;
      }
      const href = buildPublishedUrl(item.id);
      return href ? `${indent}${marker} [${text}](${href})` : `${indent}${marker} ${text}`;
    });
  }
  function formatPlainItems(tocData, options) {
    return filterItems(tocData, options).map((item, visibleIndex) => {
      const indent = buildIndent(levelToDepth(item.level, options.minHeadingLevel), options);
      const marker = options.orderedList ? `${visibleIndex + 1}.` : "-";
      const text = escapeText(item.text);
      const href = options.includeLinks ? buildPublishedUrl(item.id) : null;
      const suffix = href ? ` ${href}` : "";
      return `${indent}${marker} ${text}${suffix}`.trimEnd();
    });
  }
  function formatHtmlItems(tocData, options) {
    const items = filterItems(tocData, options).map((item, visibleIndex) => {
      const text = escapeText(item.text);
      const href = options.includeLinks ? buildPublishedUrl(item.id) : null;
      const content = href ? `<a href="${href}">${text}</a>` : text;
      return `<li data-level="${item.level}" data-index="${visibleIndex}">${content}</li>`;
    });
    const listTag = options.orderedList ? "ol" : "ul";
    return `<${listTag}>
${items.join("\n")}
</${listTag}>`;
  }
  function buildTocBody(tocData, options) {
    if (options.exportFormat === "html") {
      return formatHtmlItems(tocData, options);
    }
    if (options.exportFormat === "plain") {
      return formatPlainItems(tocData, options).join("\n");
    }
    return formatListItems(tocData, options).join("\n");
  }
  function formatExport(tocData, meta, stats, options) {
    const tocBody = buildTocBody(tocData, options);
    const context = buildTemplateContext(meta, stats, tocBody, options);
    const output = applyTemplate(options.template, context, options.exportFormat);
    const filename = buildExportFilename(meta, options);
    return { output, filename };
  }

  // src/storage.ts
  async function loadOptions() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return mergeOptions(stored[STORAGE_KEY] ?? DEFAULT_OPTIONS);
  }
  async function saveOptions(options) {
    await chrome.storage.local.set({ [STORAGE_KEY]: options });
  }
  async function loadHistory() {
    const stored = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
    const history = stored[HISTORY_STORAGE_KEY];
    if (!Array.isArray(history)) return [];
    return history.map((entry) => {
      const row = entry;
      if (typeof row.id !== "string" || typeof row.createdAt !== "string" || typeof row.title !== "string" || typeof row.exportFormat !== "string" || typeof row.output !== "string" || typeof row.filename !== "string") {
        return null;
      }
      return row;
    }).filter((entry) => Boolean(entry));
  }
  async function addHistoryEntry(entry) {
    const history = await loadHistory();
    const nextEntry = { ...entry, id: makeHistoryEntryId() };
    const next = [nextEntry, ...history].slice(0, HISTORY_LIMIT);
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: next });
    return next;
  }

  // src/ui.ts
  var STYLE_ID = "note-toc-exporter-style";
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.42)}
#${MODAL_ID} [data-panel]{width:min(1200px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:#fff;color:#0f172a;box-shadow:0 24px 72px rgba(15,23,42,.28)}
#${MODAL_ID} [data-header]{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #e2e8f0}
#${MODAL_ID} [data-body]{display:grid;gap:12px;padding:16px 20px 20px;overflow:auto}
#${MODAL_ID} [data-row]{display:flex;flex-wrap:wrap;gap:12px;align-items:start}
#${MODAL_ID} [data-two-col]{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,360px);gap:12px}
#${MODAL_ID} [data-field]{display:grid;gap:6px;min-width:160px;flex:1 1 180px}
#${MODAL_ID} label,#${MODAL_ID} [data-status]{font:600 12px/1.4 system-ui,sans-serif;color:#334155}
#${MODAL_ID} select,#${MODAL_ID} input[type="number"],#${MODAL_ID} textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;box-sizing:border-box;background:#fff}
#${MODAL_ID} select,#${MODAL_ID} input[type="number"]{height:40px;padding:0 12px}
#${MODAL_ID} textarea{min-height:220px;padding:12px;resize:vertical;white-space:pre-wrap;font:400 13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
#${MODAL_ID} [data-actions],#${MODAL_ID} [data-subactions]{display:flex;flex-wrap:wrap;gap:8px}
#${MODAL_ID} button{height:40px;padding:0 14px;border-radius:10px;border:1px solid transparent;font:700 13px/1 system-ui,sans-serif;cursor:pointer}
#${MODAL_ID} [data-primary]{background:#0f172a;color:#fff}
#${MODAL_ID} [data-secondary]{background:#f8fafc;color:#0f172a;border-color:#cbd5e1}
#${MODAL_ID} [data-inline],#${MODAL_ID} [data-checks]{display:grid;gap:6px}
#${MODAL_ID} [data-preview]{display:grid;gap:10px;align-content:start;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}
#${MODAL_ID} [data-preview-list]{display:grid;gap:6px;max-height:240px;overflow:auto}
#${MODAL_ID} [data-preview-item]{display:block;width:100%;text-align:left}
#${MODAL_ID} [data-diagnostics]{max-height:180px;overflow:auto;padding:12px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;font:400 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap}
@media (max-width:900px){#${MODAL_ID} [data-two-col]{grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }
  function createButton(label, variant) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset[variant] = "true";
    return button;
  }
  function buildOptionSelect(value) {
    const select = document.createElement("select");
    HEADING_LEVELS.forEach((level) => {
      const option = document.createElement("option");
      option.value = level;
      option.textContent = level.toUpperCase();
      option.selected = level === value;
      select.appendChild(option);
    });
    return select;
  }
  function removeModal() {
    document.getElementById(MODAL_ID)?.remove();
  }
  function renderDiagnostics(diagnostics) {
    return diagnostics.map((entry) => `[${entry.status}] ${entry.step}${entry.selector ? ` (${entry.selector})` : ""}: ${entry.detail}`).join("\n");
  }
  function showResultModal(initialResult, copied, callbacks) {
    ensureStyles();
    removeModal();
    let result = initialResult;
    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const panel = document.createElement("div");
    panel.dataset.panel = "true";
    const header = document.createElement("div");
    header.dataset.header = "true";
    const title = document.createElement("div");
    title.style.font = "700 16px/1.4 system-ui,sans-serif";
    const actions = document.createElement("div");
    actions.dataset.actions = "true";
    const copyButton = createButton("\u518D\u30B3\u30D4\u30FC", "primary");
    const copyMdButton = createButton("Copy MD", "secondary");
    const copyHtmlButton = createButton("Copy HTML", "secondary");
    const copyPlainButton = createButton("Copy Plain", "secondary");
    const downloadButton = createButton("\u4FDD\u5B58", "secondary");
    const closeButton = createButton("\u9589\u3058\u308B", "secondary");
    actions.append(copyButton, copyMdButton, copyHtmlButton, copyPlainButton, downloadButton, closeButton);
    header.append(title, actions);
    const body = document.createElement("div");
    body.dataset.body = "true";
    const status = document.createElement("div");
    status.dataset.status = "true";
    const row = document.createElement("div");
    row.dataset.row = "true";
    const formatSelect = document.createElement("select");
    const formatOptions = [["markdown", "Markdown"], ["html", "HTML"], ["plain", "\u30D7\u30EC\u30FC\u30F3"]];
    formatOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      formatSelect.appendChild(option);
    });
    const formatField = document.createElement("div");
    formatField.dataset.field = "true";
    formatField.append(Object.assign(document.createElement("label"), { textContent: "\u51FA\u529B\u5F62\u5F0F" }), formatSelect);
    const listType = document.createElement("select");
    const listOptions = [["unordered", "\u7B87\u6761\u66F8\u304D"], ["ordered", "\u756A\u53F7\u4ED8\u304D"]];
    listOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      listType.appendChild(option);
    });
    const listField = document.createElement("div");
    listField.dataset.field = "true";
    listField.append(Object.assign(document.createElement("label"), { textContent: "\u30EA\u30B9\u30C8\u5F62\u5F0F" }), listType);
    const levelSelect = buildOptionSelect(result.options.minHeadingLevel);
    const levelField = document.createElement("div");
    levelField.dataset.field = "true";
    levelField.append(Object.assign(document.createElement("label"), { textContent: "\u6700\u5C0F\u898B\u51FA\u3057" }), levelSelect);
    const linksCheckbox = document.createElement("input");
    linksCheckbox.type = "checkbox";
    const linksField = document.createElement("div");
    linksField.dataset.field = "true";
    linksField.append(Object.assign(document.createElement("label"), { textContent: "\u30EA\u30F3\u30AF" }), linksCheckbox);
    const exclusionInput = document.createElement("textarea");
    exclusionInput.style.minHeight = "88px";
    const exclusionField = document.createElement("div");
    exclusionField.dataset.field = "true";
    exclusionField.append(Object.assign(document.createElement("label"), { textContent: "\u9664\u5916\u30AD\u30FC\u30EF\u30FC\u30C9" }), exclusionInput);
    const templateInput = document.createElement("textarea");
    templateInput.style.minHeight = "132px";
    const templateField = document.createElement("div");
    templateField.dataset.field = "true";
    templateField.style.flexBasis = "100%";
    templateField.append(Object.assign(document.createElement("label"), { textContent: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8" }), templateInput);
    row.append(formatField, listField, levelField, linksField, exclusionField, templateField);
    const mainGrid = document.createElement("div");
    mainGrid.dataset.twoCol = "true";
    const outputInput = document.createElement("textarea");
    const preview = document.createElement("div");
    preview.dataset.preview = "true";
    const previewList = document.createElement("div");
    previewList.dataset.previewList = "true";
    const diagnosticsBody = document.createElement("div");
    diagnosticsBody.dataset.diagnostics = "true";
    function syncFormFromResult() {
      title.textContent = `TOC\u4F5C\u6210\u5B8C\u4E86 (${result.label})`;
      status.textContent = copied ? `\u81EA\u52D5\u30B3\u30D4\u30FC\u3057\u305F\u3067\u3002\u4FDD\u5B58\u540D: ${result.filename}` : `\u81EA\u52D5\u30B3\u30D4\u30FC\u5931\u6557\u3084\u3002\u4FDD\u5B58\u540D: ${result.filename}`;
      formatSelect.value = result.options.exportFormat;
      listType.value = result.options.orderedList ? "ordered" : "unordered";
      levelSelect.value = result.options.minHeadingLevel;
      linksCheckbox.checked = result.options.includeLinks;
      exclusionInput.value = result.options.exclusionRules.join("\n");
      templateInput.value = result.options.template;
      outputInput.value = result.output;
      previewList.innerHTML = "";
      result.tocData.forEach((item) => {
        const button = createButton(`${item.level.toUpperCase()} ${item.text}`, "secondary");
        button.dataset.previewItem = "true";
        button.style.marginLeft = `${Math.max(0, Number(item.level.slice(1)) - 2) * 10}px`;
        button.addEventListener("click", () => callbacks.onJumpTo(item));
        previewList.appendChild(button);
      });
      diagnosticsBody.textContent = renderDiagnostics(result.diagnostics);
    }
    async function rerender() {
      result = await callbacks.onOptionsChange({
        ...result.options,
        exportFormat: formatSelect.value,
        orderedList: listType.value === "ordered",
        minHeadingLevel: levelSelect.value,
        includeLinks: linksCheckbox.checked,
        exclusionRules: exclusionInput.value.split(/\r?\n/),
        template: templateInput.value
      });
      syncFormFromResult();
      outputInput.focus();
      outputInput.select();
    }
    [formatSelect, listType, levelSelect, linksCheckbox].forEach((element) => element.addEventListener("change", () => void rerender()));
    [exclusionInput, templateInput].forEach((element) => element.addEventListener("input", () => void rerender()));
    copyButton.addEventListener("click", async () => {
      status.textContent = await callbacks.onCopy() ? "\u518D\u30B3\u30D4\u30FC\u3057\u305F\u3067\u3002" : "\u518D\u30B3\u30D4\u30FC\u5931\u6557\u3084\u3002";
    });
    copyMdButton.addEventListener("click", async () => {
      status.textContent = await callbacks.onCopyAs("markdown") ? "Markdown \u3067\u30B3\u30D4\u30FC\u3057\u305F\u3067\u3002" : "Markdown \u30B3\u30D4\u30FC\u5931\u6557\u3084\u3002";
    });
    copyHtmlButton.addEventListener("click", async () => {
      status.textContent = await callbacks.onCopyAs("html") ? "HTML \u3067\u30B3\u30D4\u30FC\u3057\u305F\u3067\u3002" : "HTML \u30B3\u30D4\u30FC\u5931\u6557\u3084\u3002";
    });
    copyPlainButton.addEventListener("click", async () => {
      status.textContent = await callbacks.onCopyAs("plain") ? "\u30D7\u30EC\u30FC\u30F3\u3067\u30B3\u30D4\u30FC\u3057\u305F\u3067\u3002" : "\u30D7\u30EC\u30FC\u30F3\u30B3\u30D4\u30FC\u5931\u6557\u3084\u3002";
    });
    downloadButton.addEventListener("click", callbacks.onDownload);
    closeButton.addEventListener("click", callbacks.onClose);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) callbacks.onClose();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") callbacks.onClose();
    });
    preview.append(
      Object.assign(document.createElement("div"), { textContent: `\u898B\u51FA\u3057 ${result.stats.total}\u4EF6`, style: "font:700 13px/1.4 system-ui,sans-serif" }),
      previewList,
      Object.assign(document.createElement("div"), { textContent: "\u8A3A\u65AD\u30ED\u30B0", style: "font:700 13px/1.4 system-ui,sans-serif" }),
      diagnosticsBody
    );
    mainGrid.append(outputInput, preview);
    body.append(status, row, mainGrid);
    panel.append(header, body);
    overlay.append(panel);
    document.body.appendChild(overlay);
    syncFormFromResult();
    overlay.focus();
    outputInput.focus();
    outputInput.select();
  }
  function showErrorModal(message) {
    ensureStyles();
    removeModal();
    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-modal", "true");
    const panel = document.createElement("div");
    panel.dataset.panel = "true";
    panel.style.width = "min(720px,92vw)";
    const header = document.createElement("div");
    header.dataset.header = "true";
    const title = document.createElement("div");
    title.textContent = "TOC\u4F5C\u6210\u30A8\u30E9\u30FC";
    title.style.font = "700 16px/1.4 system-ui,sans-serif";
    const closeButton = createButton("\u9589\u3058\u308B", "primary");
    closeButton.addEventListener("click", removeModal);
    header.append(title, closeButton);
    const body = document.createElement("div");
    body.dataset.body = "true";
    const pre = document.createElement("pre");
    pre.textContent = message;
    pre.style.margin = "0";
    pre.style.padding = "12px";
    pre.style.border = "1px solid #e2e8f0";
    pre.style.borderRadius = "10px";
    pre.style.background = "#f8fafc";
    pre.style.whiteSpace = "pre-wrap";
    body.append(pre);
    panel.append(header, body);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) removeModal();
    });
    document.body.appendChild(overlay);
    overlay.focus();
  }

  // src/content.ts
  if (window.top === window.self && !window.__NOTE_TOC_EXPORTER_BOOTED__) {
    let jumpToHeading = function(id) {
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, downloadText = function(filename, text) {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    }, isSupportedSidePanelPage = function() {
      return /^https:\/\/note\.com\//.test(location.href) || /^https:\/\/editor\.note\.com\//.test(location.href);
    }, getHeadingElementByTocItem = function(item) {
      if (item.id) {
        const direct = document.getElementById(item.id);
        if (direct instanceof HTMLElement) return direct;
      }
      const candidates = Array.from(document.querySelectorAll(item.level));
      return candidates.find((element) => (element.textContent ?? "").trim() === item.text) ?? null;
    }, getActiveHeadingIdFromViewport = function(items) {
      const viewportOffset = 96;
      let current = null;
      for (const item of items) {
        const element = getHeadingElementByTocItem(item);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= viewportOffset) current = item.id;
        else break;
      }
      return current ?? items[0]?.id ?? null;
    }, notifySidePanelActiveHeading = function() {
      if (sidePanelLastItems.length === 0) return;
      const nextActiveId = getActiveHeadingIdFromViewport(sidePanelLastItems);
      if (nextActiveId === sidePanelActiveId) return;
      sidePanelActiveId = nextActiveId;
      void chrome.runtime.sendMessage({ type: "NOTE_TOC_ACTIVE_HEADING_CHANGED", activeId: sidePanelActiveId }).catch(() => void 0);
    }, attachSidePanelScrollSync = function() {
      if (sidePanelScrollListenerAttached) return;
      sidePanelScrollListenerAttached = true;
      let ticking = false;
      window.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          ticking = false;
          notifySidePanelActiveHeading();
        });
      }, { passive: true });
    }, attachSidePanelMutationObserver = function() {
      if (sidePanelMutationObserver) return;
      sidePanelMutationObserver = new MutationObserver(() => notifySidePanelActiveHeading());
      sidePanelMutationObserver.observe(document.body, { childList: true, subtree: true });
    }, isLikelyNonArticleHeading = function(text) {
      const normalized = text.replace(/\s+/g, " ").trim();
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
    }, isLikelyArticleHeading = function(element) {
      const text = (element.textContent ?? "").trim();
      if (!text || text === "\u76EE\u6B21" || isLikelyNonArticleHeading(text)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const articleLikeRoot = element.closest("article, main, [class*=article], [class*=note-common-styles], [class*=body], [class*=content]");
      if (!articleLikeRoot) return false;
      const excludedRoot = element.closest("aside, nav, footer, header, [class*=recommend], [class*=related], [class*=comment], [class*=profile], [class*=like], [class*=popular]");
      if (excludedRoot && !excludedRoot.closest("article")) return false;
      return true;
    }, buildFallbackSidePanelItems = function() {
      const selectors = [
        "article h1, article h2, article h3, article h4, article h5, article h6",
        "main article h1, main article h2, main article h3, main article h4, main article h5, main article h6",
        "main h1, main h2, main h3, main h4, main h5, main h6",
        "[class*=note-common-styles] h1, [class*=note-common-styles] h2, [class*=note-common-styles] h3, [class*=note-common-styles] h4, [class*=note-common-styles] h5, [class*=note-common-styles] h6",
        "[class*=article] h1, [class*=article] h2, [class*=article] h3, [class*=article] h4, [class*=article] h5, [class*=article] h6"
      ];
      let headingElements = [];
      for (const selector of selectors) {
        headingElements = Array.from(document.querySelectorAll(selector)).filter(isLikelyArticleHeading);
        if (headingElements.length > 0) break;
      }
      const seen = /* @__PURE__ */ new Set();
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
          level: level === "h1" ? "h2" : level,
          text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
          id: element.id,
          source: /^https:\/\/editor\.note\.com\//.test(location.href) ? "editor" : "published"
        };
      });
    }, jumpToSidePanelItem = function(id, index) {
      if (id === "__NOTE_TOC_TOP__") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        sidePanelActiveId = id;
        void chrome.runtime.sendMessage({ type: "NOTE_TOC_ACTIVE_HEADING_CHANGED", activeId: sidePanelActiveId }).catch(() => void 0);
        return;
      }
      if (id === "__NOTE_TOC_BOTTOM__") {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        sidePanelActiveId = id;
        void chrome.runtime.sendMessage({ type: "NOTE_TOC_ACTIVE_HEADING_CHANGED", activeId: sidePanelActiveId }).catch(() => void 0);
        return;
      }
      let target = null;
      if (id) target = document.getElementById(id);
      if (!target && Number.isFinite(index ?? NaN)) {
        const item = sidePanelLastItems[index];
        if (item) target = getHeadingElementByTocItem(item);
      }
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      sidePanelActiveId = target.id || id;
      void chrome.runtime.sendMessage({ type: "NOTE_TOC_ACTIVE_HEADING_CHANGED", activeId: sidePanelActiveId }).catch(() => void 0);
    };
    jumpToHeading2 = jumpToHeading, downloadText2 = downloadText, isSupportedSidePanelPage2 = isSupportedSidePanelPage, getHeadingElementByTocItem2 = getHeadingElementByTocItem, getActiveHeadingIdFromViewport2 = getActiveHeadingIdFromViewport, notifySidePanelActiveHeading2 = notifySidePanelActiveHeading, attachSidePanelScrollSync2 = attachSidePanelScrollSync, attachSidePanelMutationObserver2 = attachSidePanelMutationObserver, isLikelyNonArticleHeading2 = isLikelyNonArticleHeading, isLikelyArticleHeading2 = isLikelyArticleHeading, buildFallbackSidePanelItems2 = buildFallbackSidePanelItems, jumpToSidePanelItem2 = jumpToSidePanelItem;
    window.__NOTE_TOC_EXPORTER_BOOTED__ = true;
    let isAutoRunning = false;
    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const result = document.execCommand("copy");
          textarea.remove();
          return result;
        } catch {
          return false;
        }
      }
    }
    async function persistHistory(result) {
      await addHistoryEntry({
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        title: result.meta.title,
        exportFormat: result.options.exportFormat,
        output: result.output,
        filename: result.filename
      });
    }
    async function buildExportResult(rawOptions) {
      const storedOptions = await loadOptions().catch(() => DEFAULT_OPTIONS);
      const options = mergeOptions({ ...storedOptions, ...rawOptions });
      const { label, tocData, meta, stats, diagnostics } = await waitForTocData(location.href);
      const { output, filename } = formatExport(tocData, meta, stats, options);
      if (!output.trim()) {
        throw new Error("TOC\u306F\u53D6\u5F97\u3067\u304D\u307E\u3057\u305F\u304C\u3001\u51FA\u529B\u304C\u7A7A\u3067\u3059\u3002\u898B\u51FA\u3057\u8A2D\u5B9A\u307E\u305F\u306F\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
      return { label, tocData, options, output, meta, stats, diagnostics, filename };
    }
    async function rerenderWithFormat(result, exportFormat) {
      return buildExportResult({ ...result.options, exportFormat });
    }
    async function runExporter(isAutoTriggered = false, rawOptions) {
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
        console.log(LOG_PREFIX, "exported", { href: location.href, tocData: result.tocData, options: result.options });
      } catch (error) {
        console.error(LOG_PREFIX, error);
        const detail = error instanceof Error ? error.message : String(error);
        showErrorModal(`${detail}

note\u5074\u306EDOM\u5909\u66F4\u306E\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002\u8A3A\u65AD\u30ED\u30B0\u3068\u30BB\u30EC\u30AF\u30BF\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
      } finally {
        isAutoRunning = false;
      }
    }
    async function maybeAutoRun() {
      const options = await loadOptions().catch(() => DEFAULT_OPTIONS);
      if (!options.autoRun) return;
      await runExporter(true);
    }
    let sidePanelLastItems = [];
    let sidePanelActiveId = null;
    let sidePanelScrollListenerAttached = false;
    let sidePanelMutationObserver = null;
    async function getSidePanelState() {
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
          return { ok: true, supported: true, url: location.href, title: document.title || "note", activeId: sidePanelActiveId, items: sidePanelLastItems, generatedFromHeadings: true };
        }
        return { ok: false, supported: true, url: location.href, title: document.title, activeId: null, items: [], error: error instanceof Error ? error.message : String(error) };
      }
    }
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "RUN_NOTE_TOC_EXPORTER") {
        void runExporter(false, message.optionsOverride).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: String(error) }));
        return true;
      }
      if (message?.type === "GET_NOTE_TOC_SIDE_PANEL_STATE") {
        void getSidePanelState().then((state) => sendResponse(state)).catch((error) => sendResponse({
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
      if (message?.type === "NOTE_TOC_SIDE_PANEL_JUMP_TO") {
        jumpToSidePanelItem(
          typeof message.id === "string" ? message.id : null,
          typeof message.index === "number" ? message.index : null
        );
        sendResponse({ ok: true });
        return true;
      }
      return false;
    });
    void maybeAutoRun();
  }
  var jumpToHeading2;
  var downloadText2;
  var isSupportedSidePanelPage2;
  var getHeadingElementByTocItem2;
  var getActiveHeadingIdFromViewport2;
  var notifySidePanelActiveHeading2;
  var attachSidePanelScrollSync2;
  var attachSidePanelMutationObserver2;
  var isLikelyNonArticleHeading2;
  var isLikelyArticleHeading2;
  var buildFallbackSidePanelItems2;
  var jumpToSidePanelItem2;
})();
