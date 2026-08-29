import { describe, expect, it } from 'vitest';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { shouldReloadAppForAuthEvent } from './AppContext';

describe('AppContext auth refresh', () => {
  it('keeps the current page mounted when Supabase only refreshes its token', () => {
    expect(shouldReloadAppForAuthEvent('TOKEN_REFRESHED')).toBe(false);
  });

  it.each<AuthChangeEvent>(['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'])(
    'reloads application data for %s',
    (event) => {
      expect(shouldReloadAppForAuthEvent(event)).toBe(true);
    },
  );
});
