# AGENTS.md

Información del proyecto y reglas de trabajo para agentes que operen en este repositorio.

## Visión general

Aplicación "Libro sorpresa": sistema de perfilado lector que selecciona libros sorpresa de forma
consistente durante un MVP. El lector responde un cuestionario, se construye un perfil y se le
asigna un libro físico (y en el paquete completo, también ebook y audiolibro generado por IA).

## Reglas de trabajo

- **PROHIBIDO matar, detener o reiniciar el proceso de Aspire** (`aspire run`, `aspire-managed`) ni
  sus recursos (containers, procesos de la API/frontend). **Nunca hay permiso automático**: solo el
  usuario puede hacerlo manualmente. El agente **SIEMPRE** debe pedir permiso explícito antes de
  matar o reiniciar cualquier proceso de Aspire (o del sistema), y esperar la confirmación.
- Para **reiniciar o debuguear** recursos de Aspire (API, frontend, postgres), usar **siempre el MCP
  de Aspire** (`restart`, `start`, `stop`, logs, traces) y no manipular procesos del sistema.
- El agente **sí está autorizado** a ejecutar `aspire-apphost/db-setup.mjs` (aplicar migraciones y
  seed) siempre que no implique matar o reiniciar procesos de Aspire; si para aplicar una migración
  hace falta reiniciar el AppHost, **pedir permiso explícito al usuario** antes de hacerlo.
- **PROHIBIDO** agregar scripts al `package.json` para correr migraciones (o ejecutar migraciones
  mediante scripts definidos ahí).
- Aspire lee el `.env` de la raíz **al arrancar el AppHost**; un cambio en `.env` requiere
  reiniciar el AppHost completo para que se aplique.

## Stack y estructura

- **`src/`** — API NestJS (módulos: auth con Supabase JWT, orders/packages, admin, feedback).
- **`prisma/`** — Esquema Prisma, migraciones y `seed.ts` (fuente de datos de paquetes, tags, etc.).
- **`frontend/`** — Angular 21 (signals y control de flujo `@if`/`@for`), Tailwind CSS 3 con colores
  custom (`ink`, `coral`, `marker`, etc.), fuentes Bricolage Grotesque / Instrument Sans / IBM Plex Mono.
- **`aspire-apphost/`** — AppHost de .NET Aspire: postgres administrado, `db-setup.mjs`
  (aplica migraciones y siembra antes de levantar la API), API en `:3000`, frontend en `:4200`.
- **`docker-compose.yml`** — stack alternativo equivalente a Aspire.

## Desarrollo local

Levantar el stack con Aspire (recomendado):

```sh
npm run aspire:start   # o: npm --prefix aspire-apphost run aspire:start
```

Recursos: `postgres` (con DB `libros`), `db-setup`, `api` (:3000), `frontend` (:4200).

### Reglas de migraciones y base de datos

**PROHIBIDO** agregar scripts al `package.json` para correr migraciones (o ejecutar migraciones
mediante scripts definidos ahí).

- Para cambios en **Supabase** (base de datos, migraciones, funciones, etc.), usar **siempre el MCP
  de Supabase**.
- Para **todo lo demás** (Postgres local de Aspire, contenedores, etc.), usar **el contenedor de
  Aspire/Docker**, p. ej. `docker exec` con `psql`.

Ejemplo para consultar/actualizar la base local de Aspire:

```sh
docker exec -e "PGPASSWORD=<password del contenedor>" postgres-<id> psql -U postgres -d libros -c "..."
```

## Datos de paquetes (importante)

El paquete de producto se siembra en `prisma/seed.ts` y se sirve desde `GET /v1/packages`:

- `libro_sorpresa_fisico` → "Libro sorpresa" (solo físico). "Experiencia completa"
  (`libro_sorpresa_completo`) ya no se ofrece.

Las fotografías de la tarjeta viven en `frontend/src/app/screens/experience.ts`
(imagen libre de Pexels). Al cambiar la descripción del paquete hay que actualizar tanto
`seed.ts` como la fila en la base local.

## Pagos con Stripe (importante)

- El flujo usa **Payment Links** (sin código de sesión de checkout). El botón "Ir al pago seguro"
  redirige directo al link en `frontend/src/app/screens/experience.ts` (`PAYMENT_LINK`),
  agregando `prefilled_email` y `client_reference_id=<packageKey>-<userId>`.
- **Detectar modo test vs producción:** la URL de un payment link en modo prueba contiene
  `/test_` (ej. `https://buy.stripe.com/test_28E14...`); sin `/test_` es producción.
  - Test: `https://buy.stripe.com/test_28E14ndpyfG1eixeTjenS00`
  - Producción: `https://buy.stripe.com/28E14ndpyfG1eixeTjenS00` (el de "experiencia completa"
    ya no se usa).
- El webhook lo reenvía localmente `stripe listen --forward-to http://localhost:3000/v1/webhooks/stripe`
  (modo **test** por defecto). El `STRIPE_WEBHOOK_SECRET` del `.env` es el `whsec_...` que imprime
  `stripe listen`; los eventos en modo test se prueban con la tarjeta `4242 4242 4242 4242`.
- Para eventos de producción haría falta `stripe listen --live` y un webhook live, con su
  correspondiente secreto en `.env`.

## Pedidos y recompra (importante)

- **Regla de compra**: el usuario **no puede comprar de nuevo** en `/experiencia` mientras tenga una
  orden activa (fulfillment no cancelado) **sin feedback**. Se libera cuando su orden tiene al menos
  un `ReadingFeedback` (`feedbackCount > 0`) o el ciclo está `closed_without_feedback`.
  El feedback del home ("¿Empezaste el libro?" → `POST /v1/me/reading-feedback`) se liga a la orden
  activa en `src/feedback/feedback.service.ts`.
- **Estados de envío (fulfillment)**: `curation_pending` → `assigned` → `packed` → `shipped` →
  `delivered`. La línea de progreso del usuario muestra 5 pasos y **no** muestra "recibido".
  En el admin (Curación) hay **rollback logístico**: `POST /v1/admin/assignments/:id/unpack`
  (`packed`→`assigned`), `/unship` (`shipped`→`packed`, revoca invitaciones pendientes y resetea el
  ciclo), `/undo-in-delivery` (`in_delivery`→`shipped`) y `/undo-delivered` (`delivered`→`in_delivery`).
  `reopen-learning` reabre ciclos `closed_without_feedback`/`final_received` (revoca la invitación
  vigente y genera una nueva). Todas las acciones de curación piden confirmación con `DialogService`.
- **`GET /v1/orders`** (usuario): pedidos con fulfillment, dirección, assignment activo y
  `_count.feedbacks`.
- **`GET /v1/admin/orders`** (admin): lista con usuario, paquete, montos, pago, dirección,
  fulfillment y `activeAssignment.id` (para acciones pack/ship/delivered vía
  `POST /v1/admin/assignments/:id/...`).
- **`/mi-paquete`** (frontend): estado del pedido + línea de progreso + instrucciones del QR cuando
  está entregado. El enlace de feedback es solo el QR impreso (el token se ve en la pantalla de
  curación al enviar/ver la invitación).
- **Invitaciones de feedback**: el token es determinístico (`HMAC-SHA256(invitationId)` con
  `INVITATION_SIGNING_SECRET`), así el URL se puede re-derivar para reimprimir el QR. Solo se guarda
  el hash (`sha256`) del token en `feedback_invitations`. `POST /v1/admin/assignments/:id/reissue-invitation`
  ("Ver invitación" en el admin) **no invalida**: si existe una invitación `pending` no vencida
  devuelve ese mismo URL; si no (p. ej. `provisional_received`, la previa ya se consumió) crea una nueva.
  `INVITATION_SIGNING_SECRET` debe estar en `.env`/AppHost; sin él se usa un secreto aleatorio por
  proceso y el re-fetch no sobrevive un restart.

## Verificaciones

- Backend: `npm run lint` (`tsc --noEmit`) y `npm test` (`vitest run`).
- Frontend: `npx tsc -p tsconfig.app.json --noEmit` dentro de `frontend/`.
- **Antes de hacer build o reiniciar recursos, revisar SIEMPRE los logs del contenedor de Aspire**
  (`aspire_list_console_logs`, `aspire_list_structured_logs`, `aspire_list_traces`) para validar que
  el estado actual está bien y detectar errores en caliente en lugar de asumirlos.

## Tests de integración y base de datos (crítico)

- Los tests de integración (`test/*.integration.test.ts`) hacen `deleteMany` en `cleanDatabase()`
  para aislar cada test. **NUNCA** deben apuntar a la base de desarrollo (`libros`): borran los datos
  de usuarios, cuestionarios, pedidos y libros.
- `TEST_DATABASE_URL` debe apuntar SIEMPRE a `libros_test` (la BD de pruebas en el mismo contenedor
  de postgres, ya migrada y sembrada). Si el nombre de la BD no contiene `test`, los tests fallan
  de inmediato con un error claro (ver `test/helpers/test-database.ts`).
- Para correrlos (cada archivo por separado, porque comparten la BD y se pisan si corren en paralelo):
  ```sh
  $env:TEST_DATABASE_URL='postgresql://postgres:...@localhost:52612/libros_test'; npx vitest run test/manual-classification.integration.test.ts
  ```
- Si `libros_test` se queda atrás en migraciones, actualizarla (sin tocar la de desarrollo):
  `$env:DATABASE_URL='postgresql://...@localhost:52612/libros_test'; npx prisma migrate deploy; npx prisma db seed`.
