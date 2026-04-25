import { DEFAULT_OPTIONS, HISTORY_LIMIT, HISTORY_STORAGE_KEY, PROFILES_STORAGE_KEY, STORAGE_KEY } from './constants';
import { makeHistoryEntryId, mergeOptions } from './utils';
import type { ExportHistoryEntry, ExportOptions, ExportProfile } from './types';

export async function loadOptions(): Promise<ExportOptions> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return mergeOptions((stored[STORAGE_KEY] as Partial<ExportOptions> | undefined) ?? DEFAULT_OPTIONS);
}

export async function saveOptions(options: ExportOptions): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: options });
}

export async function loadProfiles(): Promise<ExportProfile[]> {
  const stored = await chrome.storage.local.get(PROFILES_STORAGE_KEY);
  const profiles = stored[PROFILES_STORAGE_KEY];
  if (!Array.isArray(profiles)) return [];

  return profiles
    .map((profile) => {
      const row = profile as Partial<ExportProfile>;
      if (typeof row.id !== 'string' || typeof row.name !== 'string') return null;
      return {
        id: row.id,
        name: row.name,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
        options: mergeOptions(row.options)
      };
    })
    .filter((profile): profile is ExportProfile => Boolean(profile));
}

export async function saveProfiles(profiles: ExportProfile[]): Promise<void> {
  await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles });
}

export async function upsertProfile(name: string, options: ExportOptions, existingId?: string): Promise<ExportProfile[]> {
  const profiles = await loadProfiles();
  const profile: ExportProfile = {
    id: existingId ?? makeHistoryEntryId(),
    name,
    options,
    createdAt: new Date().toISOString()
  };
  const next = profiles.filter((item) => item.id !== profile.id).concat(profile);
  await saveProfiles(next);
  return next;
}

export async function deleteProfile(profileId: string): Promise<ExportProfile[]> {
  const profiles = (await loadProfiles()).filter((profile) => profile.id !== profileId);
  await saveProfiles(profiles);
  return profiles;
}

export async function loadHistory(): Promise<ExportHistoryEntry[]> {
  const stored = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
  const history = stored[HISTORY_STORAGE_KEY];
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => {
      const row = entry as Partial<ExportHistoryEntry>;
      if (
        typeof row.id !== 'string' ||
        typeof row.createdAt !== 'string' ||
        typeof row.title !== 'string' ||
        typeof row.exportFormat !== 'string' ||
        typeof row.output !== 'string' ||
        typeof row.filename !== 'string'
      ) {
        return null;
      }

      return row as ExportHistoryEntry;
    })
    .filter((entry): entry is ExportHistoryEntry => Boolean(entry));
}

export async function addHistoryEntry(entry: Omit<ExportHistoryEntry, 'id'>): Promise<ExportHistoryEntry[]> {
  const history = await loadHistory();
  const nextEntry: ExportHistoryEntry = { ...entry, id: makeHistoryEntryId() };
  const next = [nextEntry, ...history].slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: next });
  return next;
}

export async function deleteHistoryEntries(historyIds: string[]): Promise<ExportHistoryEntry[]> {
  const idSet = new Set(historyIds);
  const next = (await loadHistory()).filter((entry) => !idSet.has(entry.id));
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: next });
  return next;
}
