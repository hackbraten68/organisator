import { describe, expect, it } from 'vitest';

import { getNavigationRoutes } from './router-utils';

describe('getNavigationRoutes', () => {
  it('nests the template list below the weekly plan entry', () => {
    const items = getNavigationRoutes();
    const weeklyPlan = items.find((item) => item.path === '/wochenplan');

    expect(weeklyPlan).toBeDefined();
    expect(weeklyPlan?.children?.map((child) => child.path)).toContain(
      '/wochenplan/vorlagen',
    );
    expect(
      weeklyPlan?.children?.find(
        (child) => child.path === '/wochenplan/vorlagen',
      )?.label,
    ).toBe('Vorlagen');
    expect(items.some((item) => item.path === '/wochenplan/vorlagen')).toBe(false);
  });
});
