import { describe, expect, it } from 'vitest';

import { formatExport } from '../src/formatter';
import { mergeOptions } from '../src/utils';
import type { ArticleMeta, TocItem, TocStats } from '../src/types';

const tocData: TocItem[] = [
  { index: 0, level: 'h2', text: 'Top', id: 'top', source: 'published' },
  { index: 1, level: 'h3', text: 'Child', id: 'child', source: 'published' }
];

const meta: ArticleMeta = {
  title: 'Sample Title',
  url: 'https://note.com/alice/n/abc123',
  publishedAt: '2026-03-21',
  author: 'Alice',
  description: 'Sample description',
  tags: ['tag1', 'tag2'],
  eyecatchUrl: 'https://example.com/hero.png'
};

const stats: TocStats = {
  total: 2,
  byLevel: { h2: 1, h3: 1, h4: 0, h5: 0, h6: 0 }
};

describe('formatExport', () => {
  it('formats markdown output and filename', () => {
    const { output, filename } = formatExport(tocData, meta, stats, mergeOptions({
      template: '{{toc}}'
    }));
    expect(output).toContain('[Top](#top)');
    expect(filename).toMatch(/Sample-Title\.md$/);
  });

  it('supports html output with template tokens', () => {
    const { output, filename } = formatExport(tocData, meta, stats, mergeOptions({
      exportFormat: 'html',
      includeStats: true,
      includeTitle: true,
      template: '{{title_block}}\n{{author_block}}\n{{toc}}'
    }));
    expect(output).toContain('<h1>Sample Title</h1>');
    expect(output).toContain('<ul>');
    expect(output).toContain('Author: Alice');
    expect(filename).toMatch(/\.html$/);
  });

  it('applies exclusion rules', () => {
    const { output } = formatExport(tocData, meta, stats, mergeOptions({
      exclusionRules: ['Child'],
      template: '{{toc}}'
    }));
    expect(output).not.toContain('Child');
  });

  it('treats h3-only headings as first-level items', () => {
    const h3OnlyData: TocItem[] = [
      { index: 0, level: 'h3', text: 'Alpha', id: 'alpha', source: 'published' },
      { index: 1, level: 'h3', text: 'Beta', id: 'beta', source: 'published' }
    ];

    const { output } = formatExport(h3OnlyData, meta, { total: 2, byLevel: { h2: 0, h3: 2, h4: 0, h5: 0, h6: 0 } }, mergeOptions({
      template: '{{toc}}'
    }));

    expect(output).toContain('- [Alpha](#alpha)');
    expect(output).toContain('\n- [Beta](#beta)');
    expect(output).not.toContain('\n  - [Beta](#beta)');
  });
});
