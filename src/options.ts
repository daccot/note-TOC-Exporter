import { DEFAULT_OPTIONS, HEADING_LEVELS } from './constants';
import { deleteHistoryEntries, deleteProfile, loadHistory, loadOptions, loadProfiles, saveOptions, upsertProfile } from './storage';
import { mergeOptions, summarizeHistory } from './utils';
import type { ExportFormat, ExportHistoryEntry, ExportOptions } from './types';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing options element: ${id}`);
  return element as T;
}

function setStatus(message: string): void {
  byId<HTMLDivElement>('status').textContent = message;
}

function fillSelectOptions(): void {
  const exportFormat = byId<HTMLSelectElement>('exportFormat');
  const minHeadingLevel = byId<HTMLSelectElement>('minHeadingLevel');
  exportFormat.innerHTML = '';
  minHeadingLevel.innerHTML = '';

  [
    { value: 'markdown', label: 'Markdown' },
    { value: 'html', label: 'HTML' },
    { value: 'plain', label: 'プレーン' }
  ].forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    exportFormat.appendChild(option);
  });

  HEADING_LEVELS.forEach((level) => {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = level.toUpperCase();
    minHeadingLevel.appendChild(option);
  });
}

function readForm(): ExportOptions {
  return mergeOptions({
    exportFormat: byId<HTMLSelectElement>('exportFormat').value as ExportFormat,
    orderedList: byId<HTMLSelectElement>('listType').value === 'ordered',
    minHeadingLevel: byId<HTMLSelectElement>('minHeadingLevel').value as ExportOptions['minHeadingLevel'],
    indentStyle: byId<HTMLSelectElement>('indentStyle').value as ExportOptions['indentStyle'],
    spacesPerLevel: Number(byId<HTMLInputElement>('spacesPerLevel').value),
    includeLinks: byId<HTMLInputElement>('includeLinks').checked,
    includeTitle: byId<HTMLInputElement>('includeTitle').checked,
    includeUrl: byId<HTMLInputElement>('includeUrl').checked,
    includePublishedAt: byId<HTMLInputElement>('includePublishedAt').checked,
    includeStats: byId<HTMLInputElement>('includeStats').checked,
    autoRun: byId<HTMLInputElement>('autoRun').checked,
    exclusionRules: byId<HTMLTextAreaElement>('exclusionRules').value.split(/\r?\n/),
    template: byId<HTMLTextAreaElement>('template').value,
    uiLanguage: byId<HTMLSelectElement>('uiLanguage').value as ExportOptions['uiLanguage'],
    showTopBottomItems: byId<HTMLSelectElement>('showTopBottomItems').value === 'true',
    showSubHeadings: byId<HTMLSelectElement>('showSubHeadings').value === 'true',
    enableH2Collapse: byId<HTMLSelectElement>('enableH2Collapse').value === 'true',
    collapseH2ByDefault: byId<HTMLSelectElement>('collapseH2ByDefault').value === 'true',
    headingColors: {
      h2: byId<HTMLInputElement>('headingColorH2').value,
      h3: byId<HTMLInputElement>('headingColorH3').value,
      h4: byId<HTMLInputElement>('headingColorH4').value,
      h5: byId<HTMLInputElement>('headingColorH5').value,
      h6: byId<HTMLInputElement>('headingColorH6').value
    }
  });
}

function writeForm(options: ExportOptions): void {
  byId<HTMLSelectElement>('exportFormat').value = options.exportFormat;
  byId<HTMLSelectElement>('listType').value = options.orderedList ? 'ordered' : 'unordered';
  byId<HTMLSelectElement>('minHeadingLevel').value = options.minHeadingLevel;
  byId<HTMLSelectElement>('indentStyle').value = options.indentStyle;
  byId<HTMLInputElement>('spacesPerLevel').value = String(options.spacesPerLevel);
  byId<HTMLInputElement>('includeLinks').checked = options.includeLinks;
  byId<HTMLInputElement>('includeTitle').checked = options.includeTitle;
  byId<HTMLInputElement>('includeUrl').checked = options.includeUrl;
  byId<HTMLInputElement>('includePublishedAt').checked = options.includePublishedAt;
  byId<HTMLInputElement>('includeStats').checked = options.includeStats;
  byId<HTMLInputElement>('autoRun').checked = options.autoRun;
  byId<HTMLTextAreaElement>('exclusionRules').value = options.exclusionRules.join('\n');
  byId<HTMLTextAreaElement>('template').value = options.template;
  byId<HTMLSelectElement>('uiLanguage').value = options.uiLanguage;
  byId<HTMLSelectElement>('showTopBottomItems').value = String(options.showTopBottomItems);
  byId<HTMLSelectElement>('showSubHeadings').value = String(options.showSubHeadings);
  byId<HTMLSelectElement>('enableH2Collapse').value = String(options.enableH2Collapse);
  byId<HTMLSelectElement>('collapseH2ByDefault').value = String(options.collapseH2ByDefault);
  byId<HTMLInputElement>('headingColorH2').value = options.headingColors.h2;
  byId<HTMLInputElement>('headingColorH3').value = options.headingColors.h3;
  byId<HTMLInputElement>('headingColorH4').value = options.headingColors.h4;
  byId<HTMLInputElement>('headingColorH5').value = options.headingColors.h5;
  byId<HTMLInputElement>('headingColorH6').value = options.headingColors.h6;
}

async function renderProfiles(): Promise<void> {
  const profiles = await loadProfiles();
  const list = byId<HTMLDivElement>('profiles');
  const applySelect = byId<HTMLSelectElement>('profile-select');
  list.innerHTML = '';
  applySelect.innerHTML = '<option value="">選択してください</option>';

  profiles.forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    applySelect.appendChild(option);

    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<strong>${profile.name}</strong><span>${profile.options.exportFormat} / ${profile.options.minHeadingLevel.toUpperCase()}</span>`;
    list.appendChild(row);
  });
}

async function renderHistory(): Promise<void> {
  const history = await loadHistory();
  const list = byId<HTMLDivElement>('history');
  list.innerHTML = '';
  history.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = entry.id;
    checkbox.dataset.historyId = entry.id;
    const text = document.createElement('div');
    text.innerHTML = `<strong>${summarizeHistory(entry)}</strong><span>${entry.filename}</span>`;
    meta.append(checkbox, text);
    const actions = document.createElement('div');
    actions.className = 'tiny-actions';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.textContent = '再コピー';
    copyButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(entry.output);
      setStatus(`履歴から ${entry.title} をコピーしました。`);
    });
    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.textContent = '保存';
    downloadButton.addEventListener('click', () => downloadEntry(entry));
    actions.append(copyButton, downloadButton);
    row.append(meta, actions);
    list.appendChild(row);
  });
}

function downloadEntry(entry: ExportHistoryEntry): void {
  const blob = new Blob([entry.output], { type: 'text/plain;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = entry.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function getSelectedHistoryIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('[data-history-id]:checked')).map((element) => element.value);
}

function setAllHistorySelection(checked: boolean): void {
  document.querySelectorAll<HTMLInputElement>('[data-history-id]').forEach((element) => {
    element.checked = checked;
  });
}

async function initialize(): Promise<void> {
  fillSelectOptions();
  writeForm(await loadOptions().catch(() => DEFAULT_OPTIONS));
  await renderProfiles();
  await renderHistory();

  byId<HTMLFormElement>('options-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const options = readForm();
    await saveOptions(options);
    setStatus('設定を保存しました。');
  });

  byId<HTMLButtonElement>('reset-button').addEventListener('click', async () => {
    const options = mergeOptions(DEFAULT_OPTIONS);
    writeForm(options);
    await saveOptions(options);
    setStatus('初期設定に戻しました。');
  });

  byId<HTMLButtonElement>('save-profile-button').addEventListener('click', async () => {
    const name = byId<HTMLInputElement>('profile-name').value.trim();
    if (!name) {
      setStatus('プロファイル名を入力してください。');
      return;
    }
    await upsertProfile(name, readForm());
    await renderProfiles();
    setStatus(`プロファイル "${name}" を保存したで。`);
  });

  byId<HTMLButtonElement>('apply-profile-button').addEventListener('click', async () => {
    const id = byId<HTMLSelectElement>('profile-select').value;
    if (!id) {
      setStatus('適用するプロファイル選択してください。');
      return;
    }
    const profile = (await loadProfiles()).find((item) => item.id === id);
    if (!profile) return;
    writeForm(profile.options);
    await saveOptions(profile.options);
    setStatus(`プロファイル "${profile.name}" を既定値へ適用したで。`);
  });

  byId<HTMLButtonElement>('delete-profile-button').addEventListener('click', async () => {
    const id = byId<HTMLSelectElement>('profile-select').value;
    if (!id) return;
    await deleteProfile(id);
    await renderProfiles();
    setStatus('プロファイルを削除しました。');
  });

  byId<HTMLButtonElement>('delete-history-button').addEventListener('click', async () => {
    const ids = getSelectedHistoryIds();
    if (ids.length === 0) {
      setStatus('削除する履歴を選択してください。');
      return;
    }
    await deleteHistoryEntries(ids);
    await renderHistory();
    setStatus(`履歴 ${ids.length} 件消したで。`);
  });

  byId<HTMLButtonElement>('select-all-history-button').addEventListener('click', () => {
    setAllHistorySelection(true);
    setStatus('履歴を全選択しました。');
  });

  byId<HTMLButtonElement>('clear-history-selection-button').addEventListener('click', () => {
    setAllHistorySelection(false);
    setStatus('履歴の選択を全解除しました。');
  });

  byId<HTMLButtonElement>('delete-all-history-button').addEventListener('click', async () => {
    const ids = Array.from(document.querySelectorAll<HTMLInputElement>('[data-history-id]')).map((element) => element.value);
    if (ids.length === 0) {
      setStatus('削除対象の履歴がありません。');
      return;
    }
    await deleteHistoryEntries(ids);
    await renderHistory();
    setStatus(`履歴 ${ids.length} 件を全削除したで。`);
  });
}

void initialize();
