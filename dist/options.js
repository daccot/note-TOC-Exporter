"use strict";
(() => {
  // src/constants.ts
  var STORAGE_KEY = "noteTocExporterOptions";
  var PROFILES_STORAGE_KEY = "noteTocExporterProfiles";
  var HISTORY_STORAGE_KEY = "noteTocExporterHistory";
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
    hideSupportHeadingInPanel: true,
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
      hideSupportHeadingInPanel: typeof raw.hideSupportHeadingInPanel === "boolean" ? raw.hideSupportHeadingInPanel : DEFAULT_OPTIONS.hideSupportHeadingInPanel,
      backgroundImageMode: raw.backgroundImageMode === "default" || raw.backgroundImageMode === "none" || raw.backgroundImageMode === "custom" ? raw.backgroundImageMode : DEFAULT_OPTIONS.backgroundImageMode,
      backgroundImageDataUrl: typeof raw.backgroundImageDataUrl === "string" ? raw.backgroundImageDataUrl : DEFAULT_OPTIONS.backgroundImageDataUrl,
      backgroundOverlayOpacity: Number.isFinite(raw.backgroundOverlayOpacity) ? Math.min(0.92, Math.max(0, Number(raw.backgroundOverlayOpacity))) : DEFAULT_OPTIONS.backgroundOverlayOpacity,
      headingColors
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
  function getDefaultWallpaperUrl() {
    return chrome.runtime.getURL("assets/default-wallpaper.jpg");
  }
  function applyWallpaperTheme(options) {
    const root = document.documentElement;
    const opacity = Math.min(0.92, Math.max(0, Number(options.backgroundOverlayOpacity)));
    root.style.setProperty("--app-wallpaper-opacity", String(opacity));
    if (options.backgroundImageMode === "none") {
      root.style.setProperty("--app-wallpaper", "none");
      return;
    }
    if (options.backgroundImageMode === "custom" && options.backgroundImageDataUrl) {
      root.style.setProperty("--app-wallpaper", `url("${options.backgroundImageDataUrl}")`);
      return;
    }
    root.style.setProperty("--app-wallpaper", `url("${getDefaultWallpaperUrl()}")`);
  }
  async function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
      reader.readAsDataURL(file);
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
      template: byId("template").value,
      backgroundImageMode: byId("backgroundImageMode").value,
      backgroundImageDataUrl: byId("backgroundImageDataUrl").value,
      backgroundOverlayOpacity: Number(byId("backgroundOverlayOpacity").value),
      uiLanguage: byId("uiLanguage").value,
      showTopBottomItems: byId("showTopBottomItems").value === "true",
      showSubHeadings: byId("showSubHeadings").value === "true",
      enableH2Collapse: byId("enableH2Collapse").value === "true",
      collapseH2ByDefault: byId("collapseH2ByDefault").value === "true",
      hideSupportHeadingInPanel: byId("hideSupportHeadingInPanel").value === "true",
      headingColors: {
        h2: byId("headingColorH2").value,
        h3: byId("headingColorH3").value,
        h4: byId("headingColorH4").value,
        h5: byId("headingColorH5").value,
        h6: byId("headingColorH6").value
      }
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
    byId("backgroundImageMode").value = options.backgroundImageMode;
    byId("backgroundImageDataUrl").value = options.backgroundImageDataUrl;
    byId("backgroundOverlayOpacity").value = String(options.backgroundOverlayOpacity);
    byId("uiLanguage").value = options.uiLanguage;
    byId("showTopBottomItems").value = String(options.showTopBottomItems);
    byId("showSubHeadings").value = String(options.showSubHeadings);
    byId("enableH2Collapse").value = String(options.enableH2Collapse);
    byId("collapseH2ByDefault").value = String(options.collapseH2ByDefault);
    byId("hideSupportHeadingInPanel").value = String(options.hideSupportHeadingInPanel);
    byId("headingColorH2").value = options.headingColors.h2;
    byId("headingColorH3").value = options.headingColors.h3;
    byId("headingColorH4").value = options.headingColors.h4;
    byId("headingColorH5").value = options.headingColors.h5;
    byId("headingColorH6").value = options.headingColors.h6;
    applyWallpaperTheme(options);
  }
  async function renderProfiles() {
    const profiles = await loadProfiles();
    const list = byId("profiles");
    const applySelect = byId("profile-select");
    list.innerHTML = "";
    applySelect.innerHTML = '<option value="">\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044</option>';
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
        setStatus(`\u5C65\u6B74\u304B\u3089 ${entry.title} \u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002`);
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
    byId("wallpaperFile").addEventListener("change", async (event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      const dataUrl = await readFileAsDataUrl(file);
      byId("backgroundImageDataUrl").value = dataUrl;
      byId("backgroundImageMode").value = "custom";
      const options = readForm();
      await saveOptions(options);
      applyWallpaperTheme(options);
      setStatus("\u30AB\u30B9\u30BF\u30E0\u58C1\u7D19\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002");
    });
    byId("options-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const options = readForm();
      await saveOptions(options);
      applyWallpaperTheme(options);
      setStatus("\u8A2D\u5B9A\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002");
    });
    byId("reset-button").addEventListener("click", async () => {
      const options = mergeOptions(DEFAULT_OPTIONS);
      writeForm(options);
      await saveOptions(options);
      setStatus("\u521D\u671F\u8A2D\u5B9A\u306B\u623B\u3057\u307E\u3057\u305F\u3002");
    });
    byId("save-profile-button").addEventListener("click", async () => {
      const name = byId("profile-name").value.trim();
      if (!name) {
        setStatus("\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return;
      }
      await upsertProfile(name, readForm());
      await renderProfiles();
      setStatus(`\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB "${name}" \u3092\u4FDD\u5B58\u3057\u305F\u3067\u3002`);
    });
    byId("apply-profile-button").addEventListener("click", async () => {
      const id = byId("profile-select").value;
      if (!id) {
        setStatus("\u9069\u7528\u3059\u308B\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
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
      setStatus("\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u3092\u524A\u9664\u3057\u307E\u3057\u305F\u3002");
    });
    byId("delete-history-button").addEventListener("click", async () => {
      const ids = getSelectedHistoryIds();
      if (ids.length === 0) {
        setStatus("\u524A\u9664\u3059\u308B\u5C65\u6B74\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return;
      }
      await deleteHistoryEntries(ids);
      await renderHistory();
      setStatus(`\u5C65\u6B74 ${ids.length} \u4EF6\u6D88\u3057\u305F\u3067\u3002`);
    });
    byId("select-all-history-button").addEventListener("click", () => {
      setAllHistorySelection(true);
      setStatus("\u5C65\u6B74\u3092\u5168\u9078\u629E\u3057\u307E\u3057\u305F\u3002");
    });
    byId("clear-history-selection-button").addEventListener("click", () => {
      setAllHistorySelection(false);
      setStatus("\u5C65\u6B74\u306E\u9078\u629E\u3092\u5168\u89E3\u9664\u3057\u307E\u3057\u305F\u3002");
    });
    byId("delete-all-history-button").addEventListener("click", async () => {
      const ids = Array.from(document.querySelectorAll("[data-history-id]")).map((element) => element.value);
      if (ids.length === 0) {
        setStatus("\u524A\u9664\u5BFE\u8C61\u306E\u5C65\u6B74\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
        return;
      }
      await deleteHistoryEntries(ids);
      await renderHistory();
      setStatus(`\u5C65\u6B74 ${ids.length} \u4EF6\u3092\u5168\u524A\u9664\u3057\u305F\u3067\u3002`);
    });
  }
  void initialize();
})();
