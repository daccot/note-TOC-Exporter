import { beforeEach, describe, expect, it } from 'vitest';

import { waitForTocData } from '../src/extractor';

describe('waitForTocData', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('extracts published toc metadata and diagnostics', async () => {
    document.head.innerHTML = `
      <meta property="og:title" content="Published Title">
      <meta property="article:published_time" content="2026-03-20">
      <meta property="og:description" content="desc">
      <meta name="author" content="Author Name">
      <meta property="og:image" content="https://example.com/image.png">
      <meta property="article:tag" content="tag-a">
    `;
    document.body.innerHTML = `
      <nav aria-label="目次">
        <ol>
          <li data-level="h2"><a href="#intro">Introduction</a></li>
          <li data-level="h3"><a href="#deep-dive">Deep Dive</a></li>
        </ol>
      </nav>
      <h2 id="intro">Introduction</h2>
      <h3 id="deep-dive">Deep Dive</h3>
    `;

    const result = await waitForTocData('https://note.com/alice/n/abc123');

    expect(result.label).toBe('公開画面');
    expect(result.meta.author).toBe('Author Name');
    expect(result.meta.tags).toContain('tag-a');
    expect(result.meta.eyecatchUrl).toBe('https://example.com/image.png');
    expect(result.diagnostics.some((entry) => entry.step === 'selector-match')).toBe(true);
  });

  it('extracts editor toc from table-of-contents json', async () => {
    document.head.innerHTML = '<title>Editor Title</title>';
    document.body.innerHTML = `
      <table-of-contents toc='[
        {"level":"h2","text":"Overview","node":{"attrs":{"id":"overview"}}},
        {"level":"h3","text":"Detail","node":{"attrs":{"id":"detail"}}}
      ]'></table-of-contents>
    `;

    const result = await waitForTocData('https://editor.note.com/notes/abc123/edit');

    expect(result.label).toBe('編集画面');
    expect(result.tocData.map((item) => item.text)).toEqual(['Overview', 'Detail']);
    expect(result.meta.title).toBe('Editor Title');
  });
});
