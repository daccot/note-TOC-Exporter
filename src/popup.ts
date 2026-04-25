interface ActiveTabState {
  ok: boolean;
  supported?: boolean;
  url?: string;
  error?: string;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: ${id}`);
  return element as T;
}

function setStatus(message: string): void {
  byId<HTMLDivElement>('status').textContent = message;
}

async function loadTabState(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: 'GET_NOTE_TOC_ACTIVE_TAB_STATE' })) as ActiveTabState;
  const state = byId<HTMLDivElement>('tab-state');
  const runButton = byId<HTMLButtonElement>('run-button');
  if (!response.ok) {
    state.textContent = response.error ?? 'タブ情報の取得に失敗したわ。';
    runButton.disabled = true;
    return;
  }
  if (response.supported) {
    state.textContent = `対応ページやで: ${response.url ?? ''}`;
    runButton.disabled = false;
    return;
  }
  state.textContent = 'このタブは未対応や。note.com の記事か editor.note.com の編集画面で使ってな。';
  runButton.disabled = true;
}

async function sendRun(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'RUN_NOTE_TOC_EXPORTER_ON_ACTIVE_TAB'
  })) as ActiveTabState;
  if (!response.ok) {
    setStatus(response.error ?? '実行失敗や。');
    return;
  }
  setStatus('記事ページ側へ投げたで。');
  window.close();
}

function bindActions(): void {
  byId<HTMLButtonElement>('run-button').addEventListener('click', async () => {
    setStatus('実行しとるで...');
    await sendRun();
  });
}

async function initialize(): Promise<void> {
  await loadTabState();
  bindActions();
}

void initialize();
