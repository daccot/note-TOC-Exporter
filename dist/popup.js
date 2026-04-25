"use strict";
(() => {
  // src/popup.ts
  function byId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing popup element: ${id}`);
    return element;
  }
  function setStatus(message) {
    byId("status").textContent = message;
  }
  async function loadTabState() {
    const response = await chrome.runtime.sendMessage({ type: "GET_NOTE_TOC_ACTIVE_TAB_STATE" });
    const state = byId("tab-state");
    const runButton = byId("run-button");
    if (!response.ok) {
      state.textContent = response.error ?? "\u30BF\u30D6\u60C5\u5831\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u305F\u308F\u3002";
      runButton.disabled = true;
      return;
    }
    if (response.supported) {
      state.textContent = `\u5BFE\u5FDC\u30DA\u30FC\u30B8\u3084\u3067: ${response.url ?? ""}`;
      runButton.disabled = false;
      return;
    }
    state.textContent = "\u3053\u306E\u30BF\u30D6\u306F\u672A\u5BFE\u5FDC\u3084\u3002note.com \u306E\u8A18\u4E8B\u304B editor.note.com \u306E\u7DE8\u96C6\u753B\u9762\u3067\u4F7F\u3063\u3066\u306A\u3002";
    runButton.disabled = true;
  }
  async function sendRun() {
    const response = await chrome.runtime.sendMessage({
      type: "RUN_NOTE_TOC_EXPORTER_ON_ACTIVE_TAB"
    });
    if (!response.ok) {
      setStatus(response.error ?? "\u5B9F\u884C\u5931\u6557\u3084\u3002");
      return;
    }
    setStatus("\u8A18\u4E8B\u30DA\u30FC\u30B8\u5074\u3078\u6295\u3052\u305F\u3067\u3002");
    window.close();
  }
  function bindActions() {
    byId("run-button").addEventListener("click", async () => {
      setStatus("\u5B9F\u884C\u3057\u3068\u308B\u3067...");
      await sendRun();
    });
  }
  async function initialize() {
    await loadTabState();
    bindActions();
  }
  void initialize();
})();
