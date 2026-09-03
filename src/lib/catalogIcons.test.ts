import { describe, expect, it } from 'vitest';
import {
  catalogIconOptions,
  getCatalogIconLabel,
  getDefaultCatalogIcon,
  normalizeCatalogIconKey,
  searchCatalogIcons,
} from './catalogIcons';
import { expenseTypeNames, paymentMethodNames, purposeNames } from './domain';

describe('catalog icons', () => {
  it('maps every default catalog name to an icon key', () => {
    [...purposeNames, ...expenseTypeNames, ...paymentMethodNames].forEach((name) => {
      expect(getDefaultCatalogIcon(name)).toBeTruthy();
    });
  });

  it('searches by Vietnamese keyword and icon name', () => {
    expect(searchCatalogIcons('xe đạp').map((option) => option.key)).toContain('bike');
    expect(searchCatalogIcons('credit-card').map((option) => option.key)).toContain('credit-card');
  });

  it('falls back safely for an unknown key', () => {
    expect(normalizeCatalogIconKey('not-in-the-picker')).toBe('tag');
    expect(getCatalogIconLabel('not-in-the-picker')).toBe('Tag');
    expect(catalogIconOptions.length).toBeGreaterThan(30);
  });
});
