import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import { weeklyPlanTemplate } from '@/features/weekly-plan-template/weekPlanData';
import { WEEKDAYS } from '@/features/weekly-plan-template/types';

describe('WeeklyPlanTemplate', () => {
  it('renders all weekdays, time blocks and the AZAV column', () => {
    render(<WeeklyPlanTemplate plan={weeklyPlanTemplate} />);

    expect(
      screen.getByRole('table', { name: /Wochenplan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Zeitraum' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Dauer' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Format / AZAV-Zuordnung' }),
    ).toBeInTheDocument();

    for (const day of WEEKDAYS) {
      expect(screen.getByRole('columnheader', { name: day })).toBeInTheDocument();
    }

    expect(screen.getAllByRole('row')).toHaveLength(9);
    expect(screen.getAllByRole('rowheader')).toHaveLength(8);
    expect(screen.getByText('Gabi-Session')).toBeInTheDocument();
  });
});
