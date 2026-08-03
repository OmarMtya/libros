import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROMPT_FILE = 'book-classification-prompt.md';
const DEFAULT_MAX_INPUT_CHARS = 240_000;

export function loadClassificationPromptFile(): string {
  const candidates = [
    path.resolve(process.cwd(), PROMPT_FILE),
    path.resolve(__dirname, '..', '..', '..', PROMPT_FILE),
    path.resolve(__dirname, '..', '..', PROMPT_FILE),
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      // prueba la siguiente ruta
    }
  }
  throw new Error(`No se encontró el archivo ${PROMPT_FILE}.`);
}

export function buildClassificationSystemPrompt(contentTypeKey: string, applicableFeatureKeys: string[]): string {
  const base = loadClassificationPromptFile();
  return [
    base,
    '',
    '## Aplicación para este borrador',
    `El contentTypeKey del borrador es: \`${contentTypeKey}\`.`,
    'Las features requeridas y no aplicables se deducen de la sección 6 usando ese contentTypeKey.',
    '',
    '## Instrucción de cobertura completa (obligatoria)',
    `Debes incluir en \`features\` TODAS las siguientes features (todas son aplicables para \`${contentTypeKey}\`, ya sean requeridas u opcionales):`,
    applicableFeatureKeys.map((key) => `- \`${key}\``).join('\n'),
    'No omitas ninguna de la lista. Para cada una asigna su \`value\` y \`confidence\` basándote en la evidencia del texto del libro.',
    'Si la evidencia es limitada, asigna igualmente el valor más razonable según las anclas de la sección 4 y usa una \`confidence\` baja.',
    '',
    '## Formato estricto de salida',
    'Devuelve únicamente un objeto JSON válido con las claves `features` y `tags`.',
    'No uses Markdown. No agregues explicaciones ni notas. No uses arrays.',
    'No incluyas `featureKey`/`tagKey` dentro de cada objeto. No uses claves que no existan en el contrato.',
    'Todos los valores numéricos deben estar entre 0 y 1.',
  ].join('\n');
}

export type ClassificationSourceText = {
  editionContext: string;
  markdown: string;
  contentTypeKey: string;
  externalContext?: string;
  pageCount?: number;
  sampledPages?: number[];
};

export function buildClassificationUserMessage({
  editionContext,
  markdown,
  contentTypeKey,
  externalContext,
  pageCount,
  sampledPages,
}: ClassificationSourceText): string {
  const effective = truncateMarkdown(markdown);
  const lines = ['### Edición', editionContext, `Content type: ${contentTypeKey}`, ''];
  if (externalContext) {
    lines.push('### Contexto externo (fuentes públicas)', externalContext, '');
  }
  lines.push('### Cobertura del texto', coverageLabel(effective, markdown, pageCount, sampledPages), '');
  lines.push(
    '### Texto proporcionado',
    effective,
    '',
    'Analiza el libro usando el contrato, las anclas, la taxonomía y las instrucciones del system prompt.',
    'El texto está dividido en bloques marcados INICIO, SECCIÓN MEDIA y FINAL como ejemplos de la escritura del libro: evalúa con ellos las features técnicas de prosa, estilo y densidad.',
    'El contexto externo sirve solo para trama, personajes, temas y tono.',
    'Produce el JSON de clasificación.',
  );
  return lines.join('\n');
}

function coverageLabel(effective: string, original: string, pageCount?: number, sampledPages?: number[]): string {
  if (pageCount && sampledPages && sampledPages.length > 0 && sampledPages.length < pageCount) {
    return `Muestra de ${sampledPages.length} páginas de un total de ${pageCount} (inicio, sección media y final, como ejemplos de la escritura).`;
  }
  if (effective !== original) return 'Truncada (muestra: inicio + sección central + final).';
  return 'Completa.';
}

export function truncateMarkdown(markdown: string, maxChars: number = DEFAULT_MAX_INPUT_CHARS): string {
  if (markdown.length <= maxChars) return markdown;
  const third = Math.floor(maxChars / 3);
  const start = markdown.slice(0, third);
  const middleStart = Math.floor(markdown.length / 2) - Math.floor(third / 2);
  const middle = markdown.slice(middleStart, middleStart + third);
  const end = markdown.slice(markdown.length - third);
  return `${start}\n\n<!-- ...sección central omitida para caber en el contexto... -->\n\n${middle}\n\n<!-- ...sección final... -->\n\n${end}`;
}
