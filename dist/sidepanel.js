"use strict";
(() => {
  // src/sidepanel.ts
  var metaEl = document.getElementById("meta");
  var statusEl = document.getElementById("status");
  var tocEl = document.getElementById("toc");
  var refreshButton = document.getElementById("refresh");
  var openModalButton = document.getElementById("openModal");
  var currentTabId = null;
  var activeId = null;
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
      text.className = "loading-text";
      text.textContent = message;
      statusEl.append(spinner, text);
      return;
    }
    statusEl.textContent = message;
  }
  function clearToc() {
    tocEl.hidden = true;
    tocEl.replaceChildren();
  }
  function setMeta(title, url, count) {
    metaEl.textContent = `${title || "Untitled note"}
${count} headings`;
    metaEl.title = url;
  }
  function isSupportedUrl(url) {
    return /^https:\/\/note\.com\//.test(url ?? "") || /^https:\/\/editor\.note\.com\//.test(url ?? "");
  }
  function normalizeError(error) {
    return error instanceof Error ? error.message : String(error);
  }
  function updateActiveHeading(nextActiveId) {
    activeId = nextActiveId;
    const buttons = Array.from(tocEl.querySelectorAll(".toc-item"));
    for (const button of buttons) {
      const isActive = button.dataset.id === nextActiveId;
      button.classList.toggle("active", isActive);
      if (isActive) button.scrollIntoView({ block: "nearest" });
    }
  }
  function renderToc(items, nextActiveId) {
    tocEl.replaceChildren();
    if (items.length === 0) {
      clearToc();
      setStatus("TOC\u9805\u76EE\u304C\u3042\u308A\u307E\u305B\u3093\u3002note\u5074\u306E\u76EE\u6B21\u751F\u6210\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "warn");
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `toc-item ${item.level}`;
      button.dataset.id = item.id ?? "";
      button.dataset.index = String(item.index);
      const level = document.createElement("span");
      level.className = "level";
      level.textContent = item.level.toUpperCase();
      const body = document.createElement("span");
      body.className = "text";
      body.textContent = item.text;
      if (!item.id) {
        const small = document.createElement("div");
        small.className = "small";
        small.textContent = "\u30B8\u30E3\u30F3\u30D7ID\u672A\u691C\u51FA";
        body.appendChild(small);
      }
      button.append(level, body);
      button.addEventListener("click", () => void jumpToItem(item));
      fragment.appendChild(button);
    }
    tocEl.appendChild(fragment);
    tocEl.hidden = false;
    statusEl.hidden = true;
    updateActiveHeading(nextActiveId);
  }
  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] ?? null;
  }
  async function ensureContentScript(tabId) {
    const response = await chrome.runtime.sendMessage({ type: "ENSURE_NOTE_TOC_CONTENT_SCRIPT", tabId });
    if (!response?.ok) throw new Error(response?.error ?? "content script \u306E\u6E96\u5099\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
  }
  async function requestState() {
    clearToc();
    setStatus("TOC\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u3002", "loading");
    const tab = await getActiveTab();
    if (!tab?.id) {
      currentTabId = null;
      setMeta("No active tab", "", 0);
      setStatus("\u30A2\u30AF\u30C6\u30A3\u30D6\u30BF\u30D6\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", "warn");
      return;
    }
    currentTabId = tab.id;
    try {
      if (!isSupportedUrl(tab.url)) {
        setMeta(tab.title ?? "Unsupported page", tab.url ?? "", 0);
        setStatus("note.com \u307E\u305F\u306F editor.note.com \u306E\u8A18\u4E8B\u30FB\u7DE8\u96C6\u753B\u9762\u3092\u958B\u304F\u3068\u3001\u3053\u3053\u306BTOC\u304C\u8868\u793A\u3055\u308C\u307E\u3059\u3002", "warn");
        return;
      }
      await ensureContentScript(tab.id);
      const state = await chrome.tabs.sendMessage(tab.id, { type: "GET_NOTE_TOC_SIDE_PANEL_STATE" });
      if (!state?.ok) {
        setMeta(tab.title ?? "Error", tab.url ?? "", 0);
        setStatus(state?.error ?? "TOC\u72B6\u614B\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", "warn");
        return;
      }
      if (!state.supported) {
        setMeta(tab.title ?? "Unsupported page", tab.url ?? "", 0);
        setStatus("note.com \u307E\u305F\u306F editor.note.com \u306E\u5BFE\u5FDC\u30DA\u30FC\u30B8\u3067\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002", "warn");
        return;
      }
      setMeta(state.title, state.url, state.items.length);
      renderToc(state.items, state.activeId);
    } catch (error) {
      setMeta(tab.title ?? "Error", tab.url ?? "", 0);
      setStatus(`\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${normalizeError(error)}`, "warn");
    }
  }
  async function jumpToItem(item) {
    if (!currentTabId) return;
    try {
      await chrome.tabs.sendMessage(currentTabId, {
        type: "NOTE_TOC_SIDE_PANEL_JUMP_TO",
        id: item.id,
        index: item.index,
        text: item.text
      });
      updateActiveHeading(item.id);
    } catch (error) {
      setStatus(`\u30B8\u30E3\u30F3\u30D7\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${normalizeError(error)}`, "warn");
    }
  }
  async function openLegacyModal() {
    try {
      await chrome.runtime.sendMessage({ type: "RUN_NOTE_TOC_EXPORTER_ON_ACTIVE_TAB" });
    } catch (error) {
      setStatus(`\u5F93\u6765\u30E2\u30FC\u30C0\u30EB\u306E\u8D77\u52D5\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${normalizeError(error)}`, "warn");
    }
  }
  refreshButton.addEventListener("click", () => void requestState());
  openModalButton.addEventListener("click", () => void openLegacyModal());
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
