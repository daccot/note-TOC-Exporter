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
  template: '{{title_block}}\n{{toc}}',
  uiLanguage: 'auto',
  showTopBottomItems: true,
  showSubHeadings: false,
  enableH2Collapse: true,
  collapseH2ByDefault: false,
  hideSupportHeadingInPanel: true,
  backgroundImageMode: 'default',
  backgroundImageDataUrl: '',
  backgroundOverlayOpacity: 0.58,
  headingColors: {
    h2: '#eff6ff',
    h3: '#f0fdf4',
    h4: '#fff7ed',
    h5: '#f5f3ff',
    h6: '#f8fafc'
  }
};

export const HEADING_LEVELS: HeadingLevel[] = ['h2', 'h3', 'h4', 'h5', 'h6'];
