"use strict";
(() => {
  // src/constants.ts
  var STORAGE_KEY = "noteTocExporterOptions";
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
    headingColors: {
      h2: "#eff6ff",
      h3: "#f0fdf4",
      h4: "#fff7ed",
      h5: "#f5f3ff",
      h6: "#f8fafc"
    }
  };

  // src/i18n.ts
  var messages = {
    ja: {
      panelTitle: "note TOC Panel",
      checkingPage: "\u5BFE\u5FDC\u30DA\u30FC\u30B8\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059...",
      loadingToc: "TOC\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u3002",
      reload: "\u518D\u8AAD\u8FBC",
      legacyModal: "\u5F93\u6765\u30E2\u30FC\u30C0\u30EB",
      unsupportedPage: "note.com \u307E\u305F\u306F editor.note.com \u306E\u8A18\u4E8B\u30FB\u7DE8\u96C6\u753B\u9762\u3092\u958B\u304F\u3068\u3001\u3053\u3053\u306BTOC\u304C\u8868\u793A\u3055\u308C\u307E\u3059\u3002",
      noActiveTab: "\u30A2\u30AF\u30C6\u30A3\u30D6\u30BF\u30D6\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002",
      noTocItems: "TOC\u9805\u76EE\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u898B\u51FA\u3057\u304C\u5B58\u5728\u3059\u308B\u8A18\u4E8B\u3067\u518D\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
      failedToLoad: "\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
      failedToJump: "\u30B8\u30E3\u30F3\u30D7\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
      failedToOpenLegacy: "\u5F93\u6765\u30E2\u30FC\u30C0\u30EB\u306E\u8D77\u52D5\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
      copySelected: "\u9078\u629E\u9805\u76EE\u3092\u30B3\u30D4\u30FC",
      selectAll: "\u5168\u9078\u629E",
      clearSelection: "\u5168\u89E3\u9664",
      copiedSelected: "\u9078\u629E\u3057\u305FTOC\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002",
      noSelectedItems: "\u30B3\u30D4\u30FC\u5BFE\u8C61\u306ETOC\u9805\u76EE\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      topOfPage: "\u4E00\u756A\u4E0A\u3078",
      bottomOfPage: "\u4E00\u756A\u4E0B\u3078",
      missingJumpId: "\u30B8\u30E3\u30F3\u30D7ID\u672A\u691C\u51FA",
      headings: "headings"
    },
    en: {
      panelTitle: "note TOC Panel",
      checkingPage: "Checking the current page...",
      loadingToc: "Loading TOC...",
      reload: "Reload",
      legacyModal: "Legacy modal",
      unsupportedPage: "Open a note.com article or editor page to display the TOC here.",
      noActiveTab: "No active tab was found.",
      noTocItems: "No TOC items were found. Please try again on an article with headings.",
      failedToLoad: "Failed to load",
      failedToJump: "Failed to jump",
      failedToOpenLegacy: "Failed to open the legacy modal",
      copySelected: "Copy selected",
      selectAll: "Select all",
      clearSelection: "Clear",
      copiedSelected: "Copied the selected TOC items.",
      noSelectedItems: "Select TOC items to copy.",
      topOfPage: "Top of page",
      bottomOfPage: "Bottom of page",
      missingJumpId: "No jump ID detected",
      headings: "headings"
    }
  };
  function resolveLanguage(language, browserLanguage = navigator.language) {
    if (language === "ja" || language === "en") return language;
    return /^ja/i.test(browserLanguage) ? "ja" : "en";
  }
  function t(language, key) {
    const resolved = resolveLanguage(language);
    return messages[resolved][key];
  }

  // src/utils.ts
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
      headingColors
    };
  }

  // src/storage.ts
  async function loadOptions() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return mergeOptions(stored[STORAGE_KEY] ?? DEFAULT_OPTIONS);
  }

  // src/sidepanel.ts
  var metaEl = document.getElementById("meta");
  var statusEl = document.getElementById("status");
  var tocEl = document.getElementById("toc");
  var refreshButton = document.getElementById("refresh");
  var openModalButton = document.getElementById("openModal");
  var copySelectedButton = document.getElementById("copySelected");
  var selectAllButton = document.getElementById("selectAll");
  var clearSelectionButton = document.getElementById("clearSelection");
  var titleEl = document.getElementById("panelTitle");
  var currentTabId = null;
  var currentItems = [];
  var rawItems = [];
  var currentOptions = DEFAULT_OPTIONS;
  var collapsedH2Ids = /* @__PURE__ */ new Set();
  var userToggledCollapse = false;
  function isSupportedUrl(url) {
    return /^https:\/\/note\.com\//.test(url ?? "") || /^https:\/\/editor\.note\.com\//.test(url ?? "");
  }
  function msg(key) {
    return t(currentOptions.uiLanguage, key);
  }
  function normalizeError(error) {
    return error instanceof Error ? error.message : String(error);
  }
  async function refreshOptions() {
    currentOptions = mergeOptions(await loadOptions().catch(() => DEFAULT_OPTIONS));
    titleEl.textContent = msg("panelTitle");
    refreshButton.textContent = msg("reload");
    openModalButton.textContent = msg("legacyModal");
    copySelectedButton.textContent = msg("copySelected");
    selectAllButton.textContent = msg("selectAll");
    clearSelectionButton.textContent = msg("clearSelection");
  }
  function setStatus(message, variant = "normal") {
    statusEl.className = variant === "warn" ? "status warn" : variant === "loading" ? "status loading" : "status";
    statusEl.hidden = false;
    if (variant === "loading") {
      statusEl.replaceChildren();
      const spinner = document.createElement("img");
      spinner.className = "loading-spinner";
      spinner.src = chrome.runtime.getURL("assets/loading-spinner.svg");
      spinner.alt = "Loading";
      const text = document.createElement("span");
      text.textContent = message;
      statusEl.append(spinner, text);
      return;
    }
    statusEl.textContent = message;
  }
  function clearToc() {
    tocEl.hidden = true;
    tocEl.replaceChildren();
    currentItems = [];
    rawItems = [];
  }
  function annotateHierarchy(items) {
    let currentH2Id = null;
    const h2WithChildren = /* @__PURE__ */ new Set();
    const annotated = items.map((item) => {
      if (item.level === "h2") {
        currentH2Id = item.id ?? `h2-index-${item.index}`;
        return { ...item, parentH2Id: null };
      }
      if (item.level !== "top" && item.level !== "bottom" && currentH2Id) {
        h2WithChildren.add(currentH2Id);
        return { ...item, parentH2Id: currentH2Id };
      }
      return item;
    });
    return annotated.map((item) => {
      if (item.level === "h2") {
        const h2Key = item.id ?? `h2-index-${item.index}`;
        return { ...item, hasChildren: h2WithChildren.has(h2Key) };
      }
      return item;
    });
  }
  function filterByOptions(items) {
    const annotated = annotateHierarchy(items);
    if (currentOptions.showSubHeadings) return annotated;
    return annotated.filter((item) => item.level === "h2");
  }
  function setMeta(title, url, count) {
    metaEl.textContent = `${title || "Untitled note"}
${count} ${msg("headings")}`;
    metaEl.title = url;
  }
  function getRenderableItems(items) {
    const filtered = filterByOptions(items);
    if (!currentOptions.showTopBottomItems) return filtered;
    return [
      { index: -1, level: "top", text: msg("topOfPage"), id: "__NOTE_TOC_TOP__", source: "system" },
      ...filtered,
      { index: -2, level: "bottom", text: msg("bottomOfPage"), id: "__NOTE_TOC_BOTTOM__", source: "system" }
    ];
  }
  function getItemColor(item) {
    if (item.level === "top" || item.level === "bottom") return "#eef2ff";
    return currentOptions.headingColors[item.level] ?? DEFAULT_OPTIONS.headingColors[item.level];
  }
  function getH2Key(item) {
    if (item.level !== "h2") return item.parentH2Id ?? null;
    return item.id ?? `h2-index-${item.index}`;
  }
  function initializeCollapse(items) {
    if (userToggledCollapse || !currentOptions.enableH2Collapse || !currentOptions.collapseH2ByDefault) return;
    collapsedH2Ids = new Set(
      items.filter((item) => item.level === "h2" && item.hasChildren).map((item) => item.id ?? `h2-index-${item.index}`)
    );
  }
  function applyCollapseVisibility() {
    const rows = Array.from(tocEl.querySelectorAll(".toc-row"));
    for (const row of rows) {
      const parentH2Id = row.dataset.parentH2Id ?? "";
      const hidden = Boolean(parentH2Id) && collapsedH2Ids.has(parentH2Id);
      row.classList.toggle("hidden-by-collapse", hidden);
    }
    tocEl.querySelectorAll('[data-role="collapse-toggle"]').forEach((button) => {
      const h2Id = button.dataset.h2Id ?? "";
      button.textContent = collapsedH2Ids.has(h2Id) ? "+" : "\u2212";
      button.title = collapsedH2Ids.has(h2Id) ? "Expand" : "Collapse";
    });
  }
  function toggleCollapse(h2Id) {
    userToggledCollapse = true;
    if (collapsedH2Ids.has(h2Id)) collapsedH2Ids.delete(h2Id);
    else collapsedH2Ids.add(h2Id);
    applyCollapseVisibility();
  }
  function updateActiveHeading(nextActiveId) {
    let activeParentH2Id = null;
    for (const item of currentItems) {
      if (item.id === nextActiveId) {
        activeParentH2Id = getH2Key(item);
        break;
      }
    }
    for (const row of Array.from(tocEl.querySelectorAll(".toc-row"))) {
      const rowId = row.dataset.id ?? null;
      const rowParentH2Id = row.dataset.parentH2Id ?? null;
      const isActive = rowId === nextActiveId;
      const isActiveGroup = Boolean(activeParentH2Id && rowParentH2Id === activeParentH2Id);
      row.classList.toggle("active-row", isActive || isActiveGroup);
    }
    for (const button of Array.from(tocEl.querySelectorAll(".toc-item"))) {
      const isActive = button.dataset.id === nextActiveId;
      button.classList.toggle("active", isActive);
      if (isActive) button.scrollIntoView({ block: "nearest" });
    }
  }
  function renderToc(items, nextActiveId) {
    tocEl.replaceChildren();
    currentItems = getRenderableItems(items);
    initializeCollapse(currentItems);
    if (currentItems.length === 0) {
      clearToc();
      setStatus(msg("noTocItems"), "warn");
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of currentItems) {
      const h2Key = getH2Key(item);
      const row = document.createElement("div");
      row.className = `toc-row ${item.level}`;
      row.style.backgroundColor = getItemColor(item);
      row.dataset.id = item.id ?? "";
      row.dataset.index = String(item.index);
      if (item.parentH2Id) row.dataset.parentH2Id = item.parentH2Id;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.index = String(item.index);
      checkbox.dataset.role = "toc-selection";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `toc-item ${item.level}`;
      button.dataset.id = item.id ?? "";
      button.dataset.index = String(item.index);
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.dataset.role = "collapse-toggle";
      collapse.className = "collapse-toggle";
      if (currentOptions.enableH2Collapse && item.level === "h2" && item.hasChildren && h2Key) {
        collapse.dataset.h2Id = h2Key;
        collapse.textContent = collapsedH2Ids.has(h2Key) ? "+" : "\u2212";
        collapse.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleCollapse(h2Key);
        });
      } else {
        collapse.className = "collapse-placeholder";
        collapse.textContent = "";
        collapse.disabled = true;
        collapse.tabIndex = -1;
      }
      const level = document.createElement("span");
      level.className = "level";
      level.textContent = item.level === "top" ? "TOP" : item.level === "bottom" ? "END" : item.level.toUpperCase();
      const body = document.createElement("span");
      body.className = "text";
      body.textContent = item.text;
      button.append(collapse, level, body);
      button.addEventListener("click", () => void jumpToItem(item));
      row.append(checkbox, button);
      fragment.appendChild(row);
    }
    tocEl.appendChild(fragment);
    tocEl.hidden = false;
    statusEl.hidden = true;
    applyCollapseVisibility();
    updateActiveHeading(nextActiveId);
  }
  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] ?? null;
  }
  async function ensureContentScript(tabId) {
    const response = await chrome.runtime.sendMessage({ type: "ENSURE_NOTE_TOC_CONTENT_SCRIPT", tabId });
    if (!response?.ok) throw new Error(response?.error ?? "content script preparation failed.");
  }
  async function requestState() {
    await refreshOptions();
    clearToc();
    setStatus(msg("loadingToc"), "loading");
    const tab = await getActiveTab();
    if (!tab?.id) {
      currentTabId = null;
      setMeta("No active tab", "", 0);
      setStatus(msg("noActiveTab"), "warn");
      return;
    }
    currentTabId = tab.id;
    try {
      if (!isSupportedUrl(tab.url)) {
        setMeta(tab.title ?? "Unsupported page", tab.url ?? "", 0);
        setStatus(msg("unsupportedPage"), "warn");
        return;
      }
      await ensureContentScript(tab.id);
      const state = await chrome.tabs.sendMessage(tab.id, { type: "GET_NOTE_TOC_SIDE_PANEL_STATE" });
      if (!state?.ok) {
        setMeta(tab.title ?? "Error", tab.url ?? "", 0);
        setStatus(state?.error ?? msg("failedToLoad"), "warn");
        return;
      }
      rawItems = state.items;
      const visibleItems = filterByOptions(rawItems);
      setMeta(state.title, state.url, visibleItems.length);
      renderToc(rawItems, state.activeId);
    } catch (error) {
      setMeta(tab.title ?? "Error", tab.url ?? "", 0);
      const message = normalizeError(error).includes("Cannot access a chrome:// URL") ? msg("unsupportedPage") : `${msg("failedToLoad")}: ${normalizeError(error)}`;
      setStatus(message, "warn");
    }
  }
  async function jumpToItem(item) {
    if (!currentTabId) return;
    try {
      await chrome.tabs.sendMessage(currentTabId, { type: "NOTE_TOC_SIDE_PANEL_JUMP_TO", id: item.id, index: item.index, text: item.text });
      updateActiveHeading(item.id);
    } catch (error) {
      setStatus(`${msg("failedToJump")}: ${normalizeError(error)}`, "warn");
    }
  }
  function getSelectedItems() {
    const selected = Array.from(tocEl.querySelectorAll('[data-role="toc-selection"]:checked'));
    const indexes = new Set(selected.map((element) => Number(element.dataset.index)));
    return currentItems.filter((item) => indexes.has(item.index));
  }
  function formatSelectedMarkdown(items) {
    return items.map((item) => {
      if (item.level === "top") return `- [${item.text}](#top)`;
      if (item.level === "bottom") return `- [${item.text}](#bottom)`;
      const depth = currentOptions.showSubHeadings ? Math.max(0, Number(item.level.slice(1)) - 2) : 0;
      const indent = "  ".repeat(depth);
      if (currentOptions.includeLinks && item.id) return `${indent}- [${item.text}](#${encodeURIComponent(item.id)})`;
      return `${indent}- ${item.text}`;
    }).join("\n");
  }
  async function copySelected() {
    const items = getSelectedItems();
    if (items.length === 0) {
      setStatus(msg("noSelectedItems"), "warn");
      return;
    }
    await navigator.clipboard.writeText(formatSelectedMarkdown(items));
    setStatus(msg("copiedSelected"));
  }
  function setAllSelection(checked) {
    tocEl.querySelectorAll('[data-role="toc-selection"]').forEach((element) => {
      element.checked = checked;
    });
  }
  async function openLegacyModal() {
    try {
      await chrome.runtime.sendMessage({ type: "RUN_NOTE_TOC_EXPORTER_ON_ACTIVE_TAB" });
    } catch (error) {
      setStatus(`${msg("failedToOpenLegacy")}: ${normalizeError(error)}`, "warn");
    }
  }
  refreshButton.addEventListener("click", () => void requestState());
  openModalButton.addEventListener("click", () => void openLegacyModal());
  copySelectedButton.addEventListener("click", () => void copySelected());
  selectAllButton.addEventListener("click", () => setAllSelection(true));
  clearSelectionButton.addEventListener("click", () => setAllSelection(false));
  chrome.tabs.onActivated.addListener(() => void requestState());
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.status === "complete") void requestState();
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "NOTE_TOC_ACTIVE_HEADING_CHANGED") return false;
    updateActiveHeading(message.activeId ?? null);
    return false;
  });
  void requestState();
})();
