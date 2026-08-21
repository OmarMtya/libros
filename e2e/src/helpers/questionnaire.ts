import type { Page, Locator } from '@playwright/test';

const MAX_QUESTIONS = 20;
const CONTINUE = 'Guardar y continuar';

async function visible(page: Page, locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

/** Clic que nunca cuelga: si el elemento no existe, espera un instante y sigue. */
async function clickIfExists(locator: Locator): Promise<void> {
  if (await locator.count()) {
    await locator.first().click({ timeout: 5_000 }).catch(() => {});
  }
}

async function addBook(page: Page, placeholderSubstr: string, query: string, rating: number, aspectLocator: Locator): Promise<void> {
  const search = page.locator(`input[placeholder*="${placeholderSubstr}"]`);
  await search.fill(query);
  // Esperar a que aparezcan resultados de OpenLibrary y elegir el primero.
  const firstResult = page.locator('ul > li > button').first();
  await firstResult.waitFor({ state: 'visible', timeout: 25_000 });
  await firstResult.click();

  const card = page.locator('[id^="loved-book-"], [id^="disliked-book-"]').first();
  await card.waitFor({ state: 'visible', timeout: 15_000 });

  // Aspecto/motivo opcional (puede no haber match; nunca debe colgar).
  await clickIfExists(aspectLocator);

  // Calificación 1-5 dentro de la tarjeta del libro.
  await clickIfExists(card.getByRole('button', { name: String(rating), exact: true }));
}

async function fillQuestion(page: Page): Promise<void> {
  const body = page.locator('body');

  // Q01/Q02: búsqueda de libros.
  if (await visible(page, body.locator('input[placeholder*="que no te haya gustado"]'))) {
    const card = page.locator('[id^="disliked-book-"]').first();
    // Motivo: primer "pill" (botón redondeado que NO sea la calificación h-10) — robusto a cambios de texto.
    await addBook(page, 'que no te haya gustado', 'el código da vinci', 2,
      card.locator('button.rounded-full:not([class*="h-10"])').first());
    return;
  }
  if (await visible(page, body.locator('input[placeholder^="Busca un título"]'))) {
    const card = page.locator('[id^="loved-book-"]').first();
    // Aspecto: primer "pill" — robusto a cambios de texto.
    await addBook(page, 'Busca un título', 'cien años de soledad', 4,
      card.locator('button.rounded-full:not([class*="h-10"])').first());
    return;
  }

  // Q07: complejidad (Lenguaje + Estructura).
  if (await visible(page, body.getByText('Estructura', { exact: true }))) {
    const three = page.getByRole('button', { name: '3', exact: true });
    await three.nth(0).click();
    await three.nth(1).click();
    return;
  }

  // Q12: páginas + sagas.
  if (await visible(page, body.getByText('Páginas mínimas'))) {
    await page.getByLabel('Páginas mínimas').fill('150');
    await page.getByLabel('Páginas máximas').fill('400');
    await page.getByLabel('Respecto a sagas o series').selectOption('standalone_preferred');
    return;
  }

  // Q13: idioma. "Español" ya viene seleccionado por defecto; activamos "Inglés" (apagado)
  // para garantizar al menos un idioma sin arriesgar desmarcar Español.
  if (await visible(page, body.getByText('Idiomas', { exact: true }))) {
    await clickIfExists(page.getByRole('button', { name: 'Inglés' }));
    return;
  }

  // Q15: comentario opcional -> continuar vacío.
  if (await visible(page, body.locator('textarea'))) {
    return;
  }

  // Q11: etiquetas. Requiere >=1 en "Me gustan" Y >=1 en "Me dan curiosidad".
  const tagInputs = page.locator('input[placeholder="Busca una etiqueta"]');
  if (await tagInputs.count()) {
    const queries = ['novela', 'fantasia', 'ficcion', 'misterio', 'amor', 'ciencia', 'romance', 'suspenso', 'terror', 'historia'];
    for (let i = 0; i < Math.min(2, await tagInputs.count()); i++) {
      const input = tagInputs.nth(i);
      const match = page.locator('ul > li > button').first();
      for (const q of queries) {
        await input.fill(q);
        try {
          await match.waitFor({ state: 'visible', timeout: 4_000 });
          await match.click();
          break;
        } catch {
          // sin resultados con este término; probar el siguiente
        }
      }
    }
    return;
  }

  // Ranking: seleccionar exactamente 3 opciones habilitadas.
  if (await visible(page, body.getByText('Tu orden'))) {
    const options = page.locator('button[aria-pressed]:not([disabled])');
    const count = await options.count();
    for (let i = 0; i < Math.min(3, count); i++) {
      await options.nth(i).click();
    }
    return;
  }

  // Selección simple/múltiple: elegir la primera opción habilitada.
  const select = page.locator('button[aria-pressed]:not([disabled])');
  if (await select.count()) {
    await select.first().click();
    return;
  }

  // Escala genérica (1-5).
  const scale = page.getByRole('button', { name: '3', exact: true });
  if (await scale.count()) {
    await scale.first().click();
    return;
  }
}

export async function completeQuestionnaire(page: Page): Promise<void> {
  await page.goto('/app/cuestionario');

  // Cerrar el diálogo de cookies/privacidad si aparece (puede interceptar clics).
  // OJO: "Rechazar y salir" navega a google.com; hay que usar "Aceptar".
  const cookieDialog = page.getByRole('dialog', { name: /cookies|privacidad/i });
  if (await cookieDialog.isVisible().catch(() => false)) {
    await clickIfExists(cookieDialog.getByRole('button', { name: 'Aceptar' }));
  }

  // Esperar a que el cuestionario termine de cargar (aparezca el botón de continuar o el estado completado).
  await page.getByRole('button', { name: CONTINUE }).waitFor({ state: 'visible', timeout: 40_000 }).catch(() => {});

  for (let i = 0; i < MAX_QUESTIONS; i++) {
    const cont = page.getByRole('button', { name: CONTINUE });
    if (!(await visible(page, cont))) {
      break; // ya completado o navegó fuera
    }

    // Identidad de la pregunta actual (título h1) para detectar el avance.
    const before = await page.locator('h1').first().innerText().catch(() => '');
    await fillQuestion(page);
    await cont.click();

    // Esperar a que la pregunta cambie, a que aparezca "Ya completaste", o que navegue a /app/experiencia.
    try {
      await page.waitForFunction(
        (prev) => {
          const h1 = document.querySelector('h1')?.textContent ?? '';
          return (
            h1 !== prev ||
            document.body.innerText.includes('Ya completaste tu cuestionario') ||
            window.location.pathname.startsWith('/app/experiencia')
          );
        },
        before,
        { timeout: 12_000 },
      );
    } catch {
      throw new Error(`El cuestionario no avanzó tras la pregunta ${i + 1}. Revisa fillQuestion/selectores.`);
    }
  }
}
