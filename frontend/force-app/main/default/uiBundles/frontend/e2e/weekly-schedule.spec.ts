import { test, expect } from '@playwright/test';

/**
 * Portal weekly schedule page (offline).
 *
 * Stubs the CSRF, session and /me endpoints like signed-in-shell.spec.ts, plus
 * the weekly-schedule endpoint, so the page can render without an org.
 */

const CSRF_PATTERN = '**/ui-api/session/csrf';
const GRAPHQL_PATTERN = '**/services/data/v67.0/graphql';
const ME_PATTERN = '**/services/apexrest/participant-portal/me';
const WEEKLY_PATTERN = '**/services/apexrest/participant-portal/me/weekly-schedule*';

async function stubCsrf(page: import('@playwright/test').Page): Promise<void> {
  await page.route(CSRF_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-csrf-token' }),
    });
  });
}

function signedInUserResponse(): string {
  return JSON.stringify({
    data: {
      uiapi: {
        currentUser: {
          Id: '005MEHMETKAYA',
          Name: { value: 'Mehmet Kaya' },
          UserType: { value: 'PowerCustomerSuccess' },
        },
      },
    },
  });
}

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await stubCsrf(page);

  await page.route(GRAPHQL_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: signedInUserResponse(),
    });
  });

  await page.route(ME_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        participantId: 'a0P0000000MEHME',
        contactId: '0030000000MEHME',
        participantName: 'Mehmet Kaya',
        participantStatus: 'Aktiv',
        programName: 'Integrationskurs',
        coachName: 'Sabine Beispiel',
        startDate: '2026-09-01',
        expectedEndDate: '2027-01-31',
        contactName: 'Mehmet Kaya',
        contactEmail: 'mehmet.kaya@example.invalid',
      }),
    });
  });
}

function weeklyScheduleResponse(): string {
  return JSON.stringify({
    weekStart: '2026-10-26',
    weekEnd: '2026-11-01',
    effectiveScope: 'Course',
    appliedScopes: ['Course'],
    programWeek: { name: 'Woche 5', weekNumber: 5 },
    weeks: [{ weekStart: '2026-10-26', programWeekName: 'Woche 5', programWeekNumber: 5 }],
    entries: [
      {
        key: 'Monday|1|Aktivität',
        title: 'Einzelcoaching',
        description: 'Beschreibung',
        entryKind: 'Aktivität',
        type: 'Einzelcoaching',
        isRequired: true,
        dayOfWeek: 'Monday',
        dateValue: '2026-10-26',
        startTime: '10:00:00.000Z',
        endTime: '11:00:00.000Z',
        durationMinutes: 60,
        targetType: 'Course',
        coachName: 'Sabine Beispiel',
        location: 'Zoom',
        meetingLink: 'https://zoom.example.invalid/x',
        order: 1,
        isCustomized: false,
      },
    ],
    code: null,
    message: null,
  });
}

test.describe('portal weekly schedule', () => {
  test('renders the weekly schedule page for a signed-in user', async ({ page }) => {
    await signIn(page);

    await page.route(WEEKLY_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: weeklyScheduleResponse(),
      });
    });

    await page.goto('/wochenplan');

    await expect(page.getByRole('heading', { name: 'Mein Wochenplan' })).toBeVisible();
    await expect(page.getByText('Einzelcoaching')).toBeVisible();
    await expect(page.getByText('Sabine Beispiel')).toBeVisible();
  });

  test('shows the empty state when there are no entries', async ({ page }) => {
    await signIn(page);

    await page.route(WEEKLY_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          weekStart: '2026-10-26',
          weekEnd: '2026-11-01',
          effectiveScope: 'Course',
          appliedScopes: ['Course'],
          programWeek: { name: 'Woche 5', weekNumber: 5 },
          weeks: [{ weekStart: '2026-10-26', programWeekName: 'Woche 5', programWeekNumber: 5 }],
          entries: [],
          code: null,
          message: null,
        }),
      });
    });

    await page.goto('/wochenplan');

    await expect(page.getByText('Für diese Woche sind keine Einträge vorhanden.')).toBeVisible();
  });

  test('shows an error message on 500', async ({ page }) => {
    await signIn(page);

    await page.route(WEEKLY_PATTERN, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Schedule data unavailable.' }),
      });
    });

    await page.goto('/wochenplan');

    await expect(page.getByText('Schedule data unavailable.')).toBeVisible();
  });

  test('a guest is redirected away from the weekly schedule page', async ({ page }) => {
    await page.goto('/wochenplan');

    await expect(page.getByRole('heading', { name: 'Mein Wochenplan' })).toHaveCount(0);
  });
});
