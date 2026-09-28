import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/auth-state.json' });

test.describe('Core Flows', () => {
  test('Login → Participant-Liste → Detail', async ({ page }) => {
    await page.goto('/');

    // Participant-Liste sichtbar
    await expect(page.getByText('Participants')).toBeVisible();

    // Ersten Teilnehmer auswählen
    const firstParticipant = page.locator('[data-testid="participant-card"], [role="button"]').first();
    await firstParticipant.click();

    // Detail-Seite mit Tabs
    await expect(page.getByRole('tab', { name: /Übersicht/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Verlauf/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Lernpfad/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Abwesenheiten/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Termine/i })).toBeVisible();
  });

  test('Termin-Lifecycle: anlegen → bestätigen → stornieren', async ({ page }) => {
    await page.goto('/participants/a059b00000gdNKkAAM?tab=termine');

    // Termin-Tab
    await expect(page.getByRole('tab', { name: /Termine/i })).toBeVisible();

    // Termin anlegen
    await page.getByRole('button', { name: /Termin anlegen/i }).click();
    await page.getByLabel(/Teilnehmer/i).fill('a059b00000gdNKkAAM');
    await page.getByLabel(/Coach/i).click();
    await page.getByRole('option', { name: /Sam Dillenburg/i }).click();
    await page.getByLabel(/Von/i).fill('09:00');
    await page.getByLabel(/Bis/i).fill('10:00');
    await page.getByRole('button', { name: /Speichern/i }).click();

    // Termin sichtbar
    await expect(page.getByText(/TERM-\d+/)).toBeVisible();

    // Bestätigen
    await page.getByRole('button', { name: /Bestätigen/i }).first().click();
    await expect(page.getByText(/Bestätigt/i)).toBeVisible();

    // Stornieren
    await page.getByRole('button', { name: /Absagen/i }).first().click();
    await page.getByLabel(/Grund/i).fill('Test-Absage');
    await page.getByRole('button', { name: /Bestätigen/i }).click();
    await expect(page.getByText(/Abgesagt/i)).toBeVisible();
  });

  test('Verfügbarkeit: Slot anlegen → löschen', async ({ page }) => {
    await page.goto('/participants/a059b00000gdNKkAAM?tab=termine');

    // Verfügbarkeit-Tab
    await page.getByRole('tab', { name: /Verfügbarkeit/i }).click();

    // Slot anlegen
    await page.getByRole('button', { name: /Slot hinzufügen/i }).click();
    await page.getByLabel(/Tag/i).click();
    await page.getByRole('option', { name: /Montag/i }).click();
    await page.getByLabel(/Von/i).fill('10:00');
    await page.getByLabel(/Bis/i).fill('11:00');
    await page.getByRole('button', { name: /Anlegen/i }).click();

    await expect(page.getByText(/Montag.*10:00.*11:00/i)).toBeVisible();

    // Löschen
    await page.getByRole('button', { name: /Löschen/i }).first().click();
    await page.getByRole('button', { name: /Fortfahren/i }).click();
    await expect(page.getByText(/Keine Verfügbarkeiten/)).toBeVisible();
  });

  test('Abwesenheit: anlegen → genehmigen', async ({ page }) => {
    await page.goto('/participants/a059b00000gdNKkAAM?tab=abwesenheiten');

    // Abwesenheiten-Tab
    await expect(page.getByRole('tab', { name: /Abwesenheiten/i })).toBeVisible();

    // Abwesenheit anlegen
    await page.getByRole('button', { name: /Abwesenheit/i }).first().click();
    await page.getByLabel(/Grund/i).fill('Krank');
    await page.getByLabel(/Von/i).fill('2026-10-01');
    await page.getByLabel(/Bis/i).fill('2026-10-03');
    await page.getByRole('button', { name: /Speichern/i }).click();

    // Abwesenheit sichtbar
    await expect(page.getByText(/Krank/i)).toBeVisible();

    // Genehmigen
    await page.getByRole('button', { name: /Genehmigen/i }).first().click();
    await expect(page.getByText(/Genehmigt/i)).toBeVisible();
  });
});
