export type HeadingLevel = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type TocSource = 'editor' | 'published';
export type ExportFormat = 'markdown' | 'html' | 'plain';

export interface TocItem {
  index: number;
  level: HeadingLevel;
  text: string;
  id: string | null;
  source: TocSource;
}

export interface ArticleMeta {
  title: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
  description: string | null;
  tags: string[];
  eyecatchUrl: string | null;
}

export interface TocStats {
  total: number;
  byLevel: Record<HeadingLevel, number>;
}

export interface DiagnosticEntry {
  step: string;
  detail: string;
  selector?: string;
  status: 'info' | 'warn' | 'error';
}

export interface ExportOptions {
  exportFormat: ExportFormat;
  orderedList: boolean;
  indentStyle: 'spaces' | 'fullWidth';
  spacesPerLevel: number;
  includeLinks: boolean;
  minHeadingLevel: HeadingLevel;
  includeTitle: boolean;
  includeUrl: boolean;
  includePublishedAt: boolean;
  includeStats: boolean;
  autoRun: boolean;
  exclusionRules: string[];
  template: string;
}

export interface ExportProfile {
  id: string;
  name: string;
  options: ExportOptions;
  createdAt: string;
}

export interface ExportHistoryEntry {
  id: string;
  createdAt: string;
  title: string;
  exportFormat: ExportFormat;
  output: string;
  filename: string;
}

export interface ExportResult {
  output: string;
  tocData: TocItem[];
  options: ExportOptions;
  label: string;
  meta: ArticleMeta;
  stats: TocStats;
  diagnostics: DiagnosticEntry[];
  filename: string;
}
