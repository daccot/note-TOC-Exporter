import { describe, expect, it } from 'vitest';

import { DEFAULT_OPTIONS } from '../src/constants';
import { mergeOptions } from '../src/utils';

describe('mergeOptions', () => {
  it('defaults panel support heading filter to enabled', () => {
    expect(mergeOptions({}).hideSupportHeadingInPanel).toBe(true);
    expect(DEFAULT_OPTIONS.hideSupportHeadingInPanel).toBe(true);
  });

  it('preserves explicit panel support heading filter setting', () => {
    expect(mergeOptions({ hideSupportHeadingInPanel: false }).hideSupportHeadingInPanel).toBe(false);
  });
});
