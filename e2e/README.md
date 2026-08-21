# Tests e2e de producción — milibrosorpresa.com

Proyecto **Playwright** independiente que valida el flujo completo de producción contra
`https://milibrosorpresa.com`:

1. **Registro** con `hola@milibrosorpresa.com`
2. **Login**
3. **Cuestionario** (las 16 preguntas)
4. **Entrar a su perfil** (`/app/perfil/:slug`)
5. **Mi experiencia** (`/app/experiencia`)
6. **Click en el botón de Stripe checkout** (valida el redirect a `buy.stripe.com`)

El correo `hola@milibrosorpresa.com` **siempre se reutiliza**: al terminar la última prueba se
**elimina la cuenta y TODA su data** (auth + tablas públicas), sin importar si algún test falló
(está en el `globalTeardown` de Playwright, que corre siempre — el "catch").

## ¿Por qué no hay endpoint de borrado?

La pantalla de "Eliminación de cuenta" es solo texto legal; no existe un endpoint que borre la cuenta.
Por eso la limpieza se hace directo contra la base (misma conexión `DATABASE_URL` de producción,
un Supabase Postgres donde conviven `auth.users` y las tablas públicas de Prisma).

## Setup

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.e2e.example .env   # llenar los valores (ver abajo)
npm test
```

## Qué necesito de ti (secrets)

Crea `e2e/.env` (o configúralos como secrets en el CI) con:

| Variable | Descripción |
|---|---|
| `FRONTEND_URL` | `https://milibrosorpresa.com` |
| `API_URL` | `https://api.milibrosorpresa.com` |
| `E2E_EMAIL` | `hola@milibrosorpresa.com` (fijo) |
| `E2E_PASSWORD` | Contraseña fija del usuario de prueba (p. ej. generada una vez) |
| `E2E_FULL_NAME` | Nombre visible (opcional) |
| `DATABASE_URL` | **La conexión de producción a Supabase Postgres con `sslmode=require`** — la misma del `.env` del VPS. Se usa para confirmar el email tras el registro y para el borrado final. Debe ser un rol con permisos sobre el esquema `auth` (el `postgres.<ref>` del pooler lo tiene). |

> ⚠️ El `DATABASE_URL` da acceso de escritura a producción. Guárdalo solo en el CI como secret y en
> `e2e/.env` (ignorado por git). Nunca lo subas.

## Scripts

```bash
npm test            # corre los tests (setup limpia data previa; teardown borra la cuenta)
npm run cleanup     # borra cuenta + toda la data de E2E_EMAIL (independiente de los tests)
npm run cleanup:confirm   # solo confirma el email (sin borrar) — útil para debug
```

## CI diario

El workflow `.github/workflows/e2e.yml` corre **1 vez por día** (cron) y se puede disparar a mano
(`workflow_dispatch`). Requiere estos secrets en el repositorio:

- `E2E_FRONTEND_URL`, `E2E_API_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_FULL_NAME`
- `E2E_DATABASE_URL`

## Notas de mantenimiento

- El cuestionario depende de la búsqueda de libros en OpenLibrary; si cambia la UI del cuestionario
  o del login, ajustar `src/helpers/questionnaire.ts` y `src/helpers/auth.ts`.
- Si algún día el teardown falla (p. ej. DB caída), el `globalSetup` limpia la cuenta residual al día
  siguiente antes de registrar de nuevo.
- Los tests corren en serie (`workers: 1`) porque comparten una sola cuenta.
