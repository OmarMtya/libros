import { test, expect } from '@playwright/test';
import { registerUser, loginUser } from '../src/helpers/auth';
import { completeQuestionnaire } from '../src/helpers/questionnaire';
import { findAuthUserId } from '../src/db';
import { config } from '../src/config';

test.describe.configure({ mode: 'serial' });

test('flujo completo de producción (registro → login → cuestionario → perfil → mi-experiencia → Stripe)', async ({ page }) => {
  await test.step('registro', async () => {
    await registerUser(page);
    if (config.hasDb) {
      const id = await findAuthUserId(config.email);
      expect(id, 'el usuario debe existir tras el registro').toBeTruthy();
    }
  });

  await test.step('login', async () => {
    await loginUser(page);
    expect(page.url()).toContain('/app');
  });

  await test.step('cuestionario', async () => {
    await completeQuestionnaire(page);
    // Al terminar el cuestionario se navega a /app/experiencia.
    await page.waitForURL(/\/app\/(experiencia|perfil)/, { timeout: 40_000 });
  });

  await test.step('entrar a su perfil', async () => {
    await page.getByRole('link', { name: 'Mi perfil' }).first().click();
    await page.waitForURL(/\/app\/perfil\//, { timeout: 30_000 });
    expect(page.url()).toMatch(/\/app\/perfil\//);
  });

  await test.step('entrar a mi-experiencia', async () => {
    await page.getByRole('link', { name: 'Mi experiencia' }).first().click();
    await page.waitForURL(/\/app\/experiencia/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: /ir al pago seguro/i })).toBeVisible();
  });

  await test.step('click en el botón de Stripe checkout', async () => {
    await page.getByRole('button', { name: /ir al pago seguro/i }).click();
    await page.waitForURL(/buy\.stripe\.com/, { timeout: 40_000 });
    const url = page.url();
    expect(url).toContain('prefilled_email=');
    expect(url).toContain('client_reference_id=libro_sorpresa_fisico-');
  });
});
