"use strict";
(() => {
  // src/constants.ts
  var STORAGE_KEY = "noteTocExporterOptions";
  var PROFILES_STORAGE_KEY = "noteTocExporterProfiles";
  var HISTORY_STORAGE_KEY = "noteTocExporterHistory";
  var DEFAULT_TEMPLATE = `{{toc}}`;
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
    template: DEFAULT_TEMPLATE
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
  function mergeOptions(input) {
    return {
      exportFormat: input?.exportFormat === "html" || input?.exportFormat === "plain" ? input.exportFormat : "markdown",
      orderedList: input?.orderedList ?? false,
      indentStyle: input?.indentStyle === "fullWidth" ? "fullWidth" : "spaces",
      spacesPerLevel: Math.max(1, Math.min(8, input?.spacesPerLevel ?? 2)),
      includeLinks: input?.includeLinks ?? true,
      minHeadingLevel: normalizeLevel(input?.minHeadingLevel ?? "h2"),
      includeTitle: input?.includeTitle ?? true,
      includeUrl: input?.includeUrl ?? true,
      includePublishedAt: input?.includePublishedAt ?? true,
      includeStats: input?.includeStats ?? false,
      autoRun: input?.autoRun ?? false,
      exclusionRules: Array.isArray(input?.exclusionRules) ? input.exclusionRules.map((rule) => escapeText(rule)).filter(Boolean) : [],
      template: typeof input?.template === "string" && input.template.trim() ? input.template : DEFAULT_TEMPLATE
    };
  }
  function makeHistoryEntryId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function summarizeHistory(entry) {
    return `${entry.title} (${entry.exportFormat})`;
  }

  // src/storage.ts
  async function loadOptions() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return mergeOptions(stored[STORAGE_KEY] ?? DEFAULT_OPTIONS);
  }
  async function saveOptions(options) {
    await chrome.storage.local.set({ [STORAGE_KEY]: options });
  }
  async function loadProfiles() {
    const stored = await chrome.storage.local.get(PROFILES_STORAGE_KEY);
    const profiles = stored[PROFILES_STORAGE_KEY];
    if (!Array.isArray(profiles)) return [];
    return profiles.map((profile) => {
      const row = profile;
      if (typeof row.id !== "string" || typeof row.name !== "string") return null;
      return {
        id: row.id,
        name: row.name,
        createdAt: typeof row.createdAt === "string" ? row.createdAt : (/* @__PURE__ */ new Date()).toISOString(),
        options: mergeOptions(row.options)
      };
    }).filter((profile) => Boolean(profile));
  }
  async function saveProfiles(profiles) {
    await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles });
  }
  async function upsertProfile(name, options, existingId) {
    const profiles = await loadProfiles();
    const profile = {
      id: existingId ?? makeHistoryEntryId(),
      name,
      options,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const next = profiles.filter((item) => item.id !== profile.id).concat(profile);
    await saveProfiles(next);
    return next;
  }
  async function deleteProfile(profileId) {
    const profiles = (await loadProfiles()).filter((profile) => profile.id !== profileId);
    await saveProfiles(profiles);
    return profiles;
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
  async function deleteHistoryEntries(historyIds) {
    const idSet = new Set(historyIds);
    const next = (await loadHistory()).filter((entry) => !idSet.has(entry.id));
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: next });
    return next;
  }

  // src/options.ts
  function byId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing options element: ${id}`);
    return element;
  }
  function setStatus(message) {
    byId("status").textContent = message;
  }
  function fillSelectOptions() {
    const exportFormat = byId("exportFormat");
    const minHeadingLevel = byId("minHeadingLevel");
    exportFormat.innerHTML = "";
    minHeadingLevel.innerHTML = "";
    [
      { value: "markdown", label: "Markdown" },
      { value: "html", label: "HTML" },
      { value: "plain", label: "\u30D7\u30EC\u30FC\u30F3" }
    ].forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      exportFormat.appendChild(option);
    });
    HEADING_LEVELS.forEach((level) => {
      const option = document.createElement("option");
      option.value = level;
      option.textContent = level.toUpperCase();
      minHeadingLevel.appendChild(option);
    });
  }
  function readForm() {
    return mergeOptions({
      exportFormat: byId("exportFormat").value,
      orderedList: byId("listType").value === "ordered",
      minHeadingLevel: byId("minHeadingLevel").value,
      indentStyle: byId("indentStyle").value,
      spacesPerLevel: Number(byId("spacesPerLevel").value),
      includeLinks: byId("includeLinks").checked,
      includeTitle: byId("includeTitle").checked,
      includeUrl: byId("includeUrl").checked,
      includePublishedAt: byId("includePublishedAt").checked,
      includeStats: byId("includeStats").checked,
      autoRun: byId("autoRun").checked,
      exclusionRules: byId("exclusionRules").value.split(/\r?\n/),
      template: byId("template").value
    });
  }
  function writeForm(options) {
    byId("exportFormat").value = options.exportFormat;
    byId("listType").value = options.orderedList ? "ordered" : "unordered";
    byId("minHeadingLevel").value = options.minHeadingLevel;
    byId("indentStyle").value = options.indentStyle;
    byId("spacesPerLevel").value = String(options.spacesPerLevel);
    byId("includeLinks").checked = options.includeLinks;
    byId("includeTitle").checked = options.includeTitle;
    byId("includeUrl").checked = options.includeUrl;
    byId("includePublishedAt").checked = options.includePublishedAt;
    byId("includeStats").checked = options.includeStats;
    byId("autoRun").checked = options.autoRun;
    byId("exclusionRules").value = options.exclusionRules.join("\n");
    byId("template").value = options.template;
  }
  async function renderProfiles() {
    const profiles = await loadProfiles();
    const list = byId("profiles");
    const applySelect = byId("profile-select");
    list.innerHTML = "";
    applySelect.innerHTML = '<option value="">\u9078\u3093\u3067\u306A</option>';
    profiles.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      applySelect.appendChild(option);
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `<strong>${profile.name}</strong><span>${profile.options.exportFormat} / ${profile.options.minHeadingLevel.toUpperCase()}</span>`;
      list.appendChild(row);
    });
  }
  async function renderHistory() {
    const history = await loadHistory();
    const list = byId("history");
    list.innerHTML = "";
    history.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "list-row";
      const meta = document.createElement("div");
      meta.className = "history-meta";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = entry.id;
      checkbox.dataset.historyId = entry.id;
      const text = document.createElement("div");
      text.innerHTML = `<strong>${summarizeHistory(entry)}</strong><span>${entry.filename}</span>`;
      meta.append(checkbox, text);
      const actions = document.createElement("div");
      actions.className = "tiny-actions";
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "\u518D\u30B3\u30D4\u30FC";
      copyButton.addEventListener("click", async () => {
        await navigator.clipboard.writeText(entry.output);
        setStatus(`\u5C65\u6B74\u304B\u3089 ${entry.title} \u3092\u30B3\u30D4\u30FC\u3057\u305F\u3067\u3002`);
      });
      const downloadButton = document.createElement("button");
      downloadButton.type = "button";
      downloadButton.textContent = "\u4FDD\u5B58";
      downloadButton.addEventListener("click", () => downloadEntry(entry));
      actions.append(copyButton, downloadButton);
      row.append(meta, actions);
      list.appendChild(row);
    });
  }
  function downloadEntry(entry) {
    const blob = new Blob([entry.output], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = entry.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }
  function getSelectedHistoryIds() {
    return Array.from(document.querySelectorAll("[data-history-id]:checked")).map((element) => element.value);
  }
  function setAllHistorySelection(checked) {
    document.querySelectorAll("[data-history-id]").forEach((element) => {
      element.checked = checked;
    });
  }
  async function initialize() {
    fillSelectOptions();
    writeForm(await loadOptions().catch(() => DEFAULT_OPTIONS));
    await renderProfiles();
    await renderHistory();
    byId("options-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const options = readForm();
      await saveOptions(options);
      setStatus("\u65E2\u5B9A\u5024\u3092\u4FDD\u5B58\u3057\u305F\u3067\u3002");
    });
    byId("reset-button").addEventListener("click", async () => {
      const options = mergeOptions(DEFAULT_OPTIONS);
      writeForm(options);
      await saveOptions(options);
      setStatus("\u521D\u671F\u5024\u306B\u623B\u3057\u305F\u3067\u3002");
    });
    byId("save-profile-button").addEventListener("click", async () => {
      const name = byId("profile-name").value.trim();
      if (!name) {
        setStatus("\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u540D\u5165\u308C\u3066\u306A\u3002");
        return;
      }
      await upsertProfile(name, readForm());
      await renderProfiles();
      setStatus(`\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB "${name}" \u3092\u4FDD\u5B58\u3057\u305F\u3067\u3002`);
    });
    byId("apply-profile-button").addEventListener("click", async () => {
      const id = byId("profile-select").value;
      if (!id) {
        setStatus("\u9069\u7528\u3059\u308B\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u9078\u3093\u3067\u306A\u3002");
        return;
      }
      const profile = (await loadProfiles()).find((item) => item.id === id);
      if (!profile) return;
      writeForm(profile.options);
      await saveOptions(profile.options);
      setStatus(`\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB "${profile.name}" \u3092\u65E2\u5B9A\u5024\u3078\u9069\u7528\u3057\u305F\u3067\u3002`);
    });
    byId("delete-profile-button").addEventListener("click", async () => {
      const id = byId("profile-select").value;
      if (!id) return;
      await deleteProfile(id);
      await renderProfiles();
      setStatus("\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u6D88\u3057\u305F\u3067\u3002");
    });
    byId("delete-history-button").addEventListener("click", async () => {
      const ids = getSelectedHistoryIds();
      if (ids.length === 0) {
        setStatus("\u524A\u9664\u3059\u308B\u5C65\u6B74\u3092\u9078\u3093\u3067\u306A\u3002");
        return;
      }
      await deleteHistoryEntries(ids);
      await renderHistory();
      setStatus(`\u5C65\u6B74 ${ids.length} \u4EF6\u6D88\u3057\u305F\u3067\u3002`);
    });
    byId("select-all-history-button").addEventListener("click", () => {
      setAllHistorySelection(true);
      setStatus("\u5C65\u6B74\u3092\u5168\u90E8\u9078\u629E\u3057\u305F\u3067\u3002");
    });
    byId("clear-history-selection-button").addEventListener("click", () => {
      setAllHistorySelection(false);
      setStatus("\u5C65\u6B74\u306E\u9078\u629E\u3092\u5168\u90E8\u5916\u3057\u305F\u3067\u3002");
    });
    byId("delete-all-history-button").addEventListener("click", async () => {
      const ids = Array.from(document.querySelectorAll("[data-history-id]")).map((element) => element.value);
      if (ids.length === 0) {
        setStatus("\u6D88\u3059\u5C65\u6B74\u304C\u7121\u3044\u3067\u3002");
        return;
      }
      await deleteHistoryEntries(ids);
      await renderHistory();
      setStatus(`\u5C65\u6B74 ${ids.length} \u4EF6\u3092\u5168\u524A\u9664\u3057\u305F\u3067\u3002`);
    });
  }
  void initialize();
})();
