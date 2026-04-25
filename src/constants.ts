import type { ExportOptions, HeadingLevel } from './types';

export const LOG_PREFIX = '[note-toc-exporter]';
export const MODAL_ID = 'note-toc-exporter-modal';
export const STORAGE_KEY = 'noteTocExporterOptions';
export const PROFILES_STORAGE_KEY = 'noteTocExporterProfiles';
export const HISTORY_STORAGE_KEY = 'noteTocExporterHistory';
export const HISTORY_LIMIT = 10;

export const DEFAULT_TEMPLATE = `{{toc}}`;

export const DEFAULT_OPTIONS: ExportOptions = {
  exportFormat: 'markdown',
  orderedList: false,
  indentStyle: 'spaces',
  spacesPerLevel: 2,
  includeLinks: true,
  minHeadingLevel: 'h2',
  includeTitle: false,
  includeUrl: false,
  includePublishedAt: false,
  includeStats: false,
  autoRun: false,
  exclusionRules: [],
  template: DEFAULT_TEMPLATE
};

export const HEADING_LEVELS: HeadingLevel[] = ['h2', 'h3', 'h4', 'h5', 'h6'];
