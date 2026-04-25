import { HEADING_LEVELS, MODAL_ID } from './constants';
import type { DiagnosticEntry, ExportFormat, ExportOptions, ExportResult, TocItem } from './types';

const STYLE_ID = 'note-toc-exporter-style';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
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

function createButton(label: string, variant: 'primary' | 'secondary'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset[variant] = 'true';
  return button;
}

function buildOptionSelect(value: ExportOptions['minHeadingLevel']): HTMLSelectElement {
  const select = document.createElement('select');
  HEADING_LEVELS.forEach((level) => {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = level.toUpperCase();
    option.selected = level === value;
    select.appendChild(option);
  });
  return select;
}

export function removeModal(): void {
  document.getElementById(MODAL_ID)?.remove();
}

export interface ModalCallbacks {
  onClose: () => void;
  onCopy: () => Promise<boolean>;
  onCopyAs: (format: ExportFormat) => Promise<boolean>;
  onOptionsChange: (options: ExportOptions) => Promise<ExportResult>;
  onDownload: () => void;
  onJumpTo: (item: TocItem) => void;
}

function renderDiagnostics(diagnostics: DiagnosticEntry[]): string {
  return diagnostics.map((entry) => `[${entry.status}] ${entry.step}${entry.selector ? ` (${entry.selector})` : ''}: ${entry.detail}`).join('\n');
}

export function showResultModal(initialResult: ExportResult, copied: boolean, callbacks: ModalCallbacks): void {
  ensureStyles();
  removeModal();
  let result = initialResult;

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const panel = document.createElement('div');
  panel.dataset.panel = 'true';
  const header = document.createElement('div');
  header.dataset.header = 'true';
  const title = document.createElement('div');
  title.style.font = '700 16px/1.4 system-ui,sans-serif';
  const actions = document.createElement('div');
  actions.dataset.actions = 'true';
  const copyButton = createButton('再コピー', 'primary');
  const copyMdButton = createButton('Copy MD', 'secondary');
  const copyHtmlButton = createButton('Copy HTML', 'secondary');
  const copyPlainButton = createButton('Copy Plain', 'secondary');
  const downloadButton = createButton('保存', 'secondary');
  const closeButton = createButton('閉じる', 'secondary');
  actions.append(copyButton, copyMdButton, copyHtmlButton, copyPlainButton, downloadButton, closeButton);
  header.append(title, actions);

  const body = document.createElement('div');
  body.dataset.body = 'true';
  const status = document.createElement('div');
  status.dataset.status = 'true';

  const row = document.createElement('div');
  row.dataset.row = 'true';

  const formatSelect = document.createElement('select');
  const formatOptions: Array<[ExportFormat, string]> = [['markdown', 'Markdown'], ['html', 'HTML'], ['plain', 'プレーン']];
  formatOptions.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    formatSelect.appendChild(option);
  });
  const formatField = document.createElement('div');
  formatField.dataset.field = 'true';
  formatField.append(Object.assign(document.createElement('label'), { textContent: '出力形式' }), formatSelect);

  const listType = document.createElement('select');
  const listOptions: Array<['unordered' | 'ordered', string]> = [['unordered', '箇条書き'], ['ordered', '番号付き']];
  listOptions.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    listType.appendChild(option);
  });
  const listField = document.createElement('div');
  listField.dataset.field = 'true';
  listField.append(Object.assign(document.createElement('label'), { textContent: 'リスト形式' }), listType);

  const levelSelect = buildOptionSelect(result.options.minHeadingLevel);
  const levelField = document.createElement('div');
  levelField.dataset.field = 'true';
  levelField.append(Object.assign(document.createElement('label'), { textContent: '最小見出し' }), levelSelect);

  const linksCheckbox = document.createElement('input');
  linksCheckbox.type = 'checkbox';
  const linksField = document.createElement('div');
  linksField.dataset.field = 'true';
  linksField.append(Object.assign(document.createElement('label'), { textContent: 'リンク' }), linksCheckbox);

  const exclusionInput = document.createElement('textarea');
  exclusionInput.style.minHeight = '88px';
  const exclusionField = document.createElement('div');
  exclusionField.dataset.field = 'true';
  exclusionField.append(Object.assign(document.createElement('label'), { textContent: '除外キーワード' }), exclusionInput);

  const templateInput = document.createElement('textarea');
  templateInput.style.minHeight = '132px';
  const templateField = document.createElement('div');
  templateField.dataset.field = 'true';
  templateField.style.flexBasis = '100%';
  templateField.append(Object.assign(document.createElement('label'), { textContent: 'テンプレート' }), templateInput);

  row.append(formatField, listField, levelField, linksField, exclusionField, templateField);

  const mainGrid = document.createElement('div');
  mainGrid.dataset.twoCol = 'true';
  const outputInput = document.createElement('textarea');
  const preview = document.createElement('div');
  preview.dataset.preview = 'true';
  const previewList = document.createElement('div');
  previewList.dataset.previewList = 'true';
  const diagnosticsBody = document.createElement('div');
  diagnosticsBody.dataset.diagnostics = 'true';

  function syncFormFromResult(): void {
    title.textContent = `TOC作成完了 (${result.label})`;
    status.textContent = copied ? `自動コピーしたで。保存名: ${result.filename}` : `自動コピー失敗や。保存名: ${result.filename}`;
    formatSelect.value = result.options.exportFormat;
    listType.value = result.options.orderedList ? 'ordered' : 'unordered';
    levelSelect.value = result.options.minHeadingLevel;
    linksCheckbox.checked = result.options.includeLinks;
    exclusionInput.value = result.options.exclusionRules.join('\n');
    templateInput.value = result.options.template;
    outputInput.value = result.output;
    previewList.innerHTML = '';
    result.tocData.forEach((item) => {
      const button = createButton(`${item.level.toUpperCase()} ${item.text}`, 'secondary');
      button.dataset.previewItem = 'true';
      button.style.marginLeft = `${Math.max(0, Number(item.level.slice(1)) - 2) * 10}px`;
      button.addEventListener('click', () => callbacks.onJumpTo(item));
      previewList.appendChild(button);
    });
    diagnosticsBody.textContent = renderDiagnostics(result.diagnostics);
  }

  async function rerender(): Promise<void> {
    result = await callbacks.onOptionsChange({
      ...result.options,
      exportFormat: formatSelect.value as ExportFormat,
      orderedList: listType.value === 'ordered',
      minHeadingLevel: levelSelect.value as ExportOptions['minHeadingLevel'],
      includeLinks: linksCheckbox.checked,
      exclusionRules: exclusionInput.value.split(/\r?\n/),
      template: templateInput.value
    });
    syncFormFromResult();
    outputInput.focus();
    outputInput.select();
  }

  [formatSelect, listType, levelSelect, linksCheckbox].forEach((element) => element.addEventListener('change', () => void rerender()));
  [exclusionInput, templateInput].forEach((element) => element.addEventListener('input', () => void rerender()));

  copyButton.addEventListener('click', async () => {
    status.textContent = (await callbacks.onCopy()) ? '再コピーしたで。' : '再コピー失敗や。';
  });
  copyMdButton.addEventListener('click', async () => {
    status.textContent = (await callbacks.onCopyAs('markdown')) ? 'Markdown でコピーしたで。' : 'Markdown コピー失敗や。';
  });
  copyHtmlButton.addEventListener('click', async () => {
    status.textContent = (await callbacks.onCopyAs('html')) ? 'HTML でコピーしたで。' : 'HTML コピー失敗や。';
  });
  copyPlainButton.addEventListener('click', async () => {
    status.textContent = (await callbacks.onCopyAs('plain')) ? 'プレーンでコピーしたで。' : 'プレーンコピー失敗や。';
  });
  downloadButton.addEventListener('click', callbacks.onDownload);
  closeButton.addEventListener('click', callbacks.onClose);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) callbacks.onClose(); });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') callbacks.onClose(); });

  preview.append(
    Object.assign(document.createElement('div'), { textContent: `見出し ${result.stats.total}件`, style: 'font:700 13px/1.4 system-ui,sans-serif' }),
    previewList,
    Object.assign(document.createElement('div'), { textContent: '診断ログ', style: 'font:700 13px/1.4 system-ui,sans-serif' }),
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

export function showErrorModal(message: string): void {
  ensureStyles();
  removeModal();
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  const panel = document.createElement('div');
  panel.dataset.panel = 'true';
  panel.style.width = 'min(720px,92vw)';
  const header = document.createElement('div');
  header.dataset.header = 'true';
  const title = document.createElement('div');
  title.textContent = 'TOC作成エラー';
  title.style.font = '700 16px/1.4 system-ui,sans-serif';
  const closeButton = createButton('閉じる', 'primary');
  closeButton.addEventListener('click', removeModal);
  header.append(title, closeButton);
  const body = document.createElement('div');
  body.dataset.body = 'true';
  const pre = document.createElement('pre');
  pre.textContent = message;
  pre.style.margin = '0';
  pre.style.padding = '12px';
  pre.style.border = '1px solid #e2e8f0';
  pre.style.borderRadius = '10px';
  pre.style.background = '#f8fafc';
  pre.style.whiteSpace = 'pre-wrap';
  body.append(pre);
  panel.append(header, body);
  overlay.append(panel);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) removeModal(); });
  document.body.appendChild(overlay);
  overlay.focus();
}
