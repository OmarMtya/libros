import type { Page } from '@playwright/test';
import { config } from '../config';
import { confirmEmail, findAuthUserId } from '../db';

async function openRegisterMode(page: Page): Promise<void> {
  await page.goto('/app/login');
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
}

async function openLoginMode(page: Page): Promise<void> {
  await page.goto('/app/login');
  const tab = page.getByRole('tab', { name: 'Iniciar sesión' });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
  }
}

/** Registra el usuario de prueba por la UI y confirma su email vía DB (sin depender del correo). */
export async function registerUser(page: Page): Promise<void> {
  await openRegisterMode(page);
  await page.locator('input[name="name"]').fill(config.fullName);
  await page.locator('input[name="email"]').fill(config.email);
  await page.locator('input[name="password"]').fill(config.password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();

  // Con la confirmación de email activa, el registro no abre sesión y muestra el aviso.
  await page
    .getByText(/confirmar tu cuenta|confirmar su cuenta|bandeja de entrada/i)
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {});

  // Confirmar el email. Si hay DATABASE_URL lo hacemos aquí; si no (corrida orquestada
  // vía MCP de Supabase), se confirma externamente entre la fase de registro y la de login.
  try {
    const authUserId = await findAuthUserId(config.email);
    if (authUserId) await confirmEmail(authUserId);
  } catch {
    // sin DATABASE_URL: se confirmará fuera (MCP)
  }
}

/** Inicia sesión por la UI con el usuario de prueba. */
export async function loginUser(page: Page): Promise<void> {
  await openLoginMode(page);
  await page.locator('input[name="email"]').fill(config.email);
  await page.locator('input[name="password"]').fill(config.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/app/, { timeout: 40_000 });
}
