import pg from 'pg';
import { config } from './config';

export function dbAvailable(): boolean {
  return config.hasDb && Boolean(config.databaseUrl);
}

const pool = config.hasDb && config.databaseUrl
  ? new pg.Pool({
      connectionString: config.databaseUrl!,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
    })
  : null;

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('DATABASE_URL no está configurado. No se puede operar sobre la base.');
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
}

export async function findAuthUserId(email: string): Promise<string | null> {
  return withClient(async (client) => {
    const res = await client.query('select id from auth.users where lower(email) = lower($1) limit 1', [email]);
    return res.rows[0]?.id ?? null;
  });
}

/**
 * Confirma el email del usuario de prueba directamente en auth.
 * Equivale a hacer click en el enlace de confirmación que envía Resend, sin depender del correo.
 */
export async function confirmEmail(authUserId: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `update auth.users
         set email_confirmed_at = coalesce(email_confirmed_at, now()),
             confirmation_sent_at = coalesce(confirmation_sent_at, now()),
             confirmation_token = null,
             updated_at = now()
       where id = $1`,
      [authUserId],
    );
    try {
      await client.query(
        `update auth.identities set updated_at = now() where user_id = $1 and provider = 'email'`,
        [authUserId],
      );
    } catch {
      // columna/semántica distinta según versión de GoTrue; el gate de login es email_confirmed_at.
    }
  });
}

/**
 * Elimina TODA la data del usuario: tablas públicas (orden primero por FK Restrict) y el usuario auth.
 * Reutilizable como script (scripts/cleanup.ts) y como teardown global de Playwright.
 */
export async function cleanupAccount(email: string): Promise<{ removed: boolean; authUserId: string | null }> {
  const authUserId = await findAuthUserId(email);
  if (!authUserId) {
    return { removed: false, authUserId: null };
  }

  await withClient(async (client) => {
    // 1) Órdenes y su dependencia (la relación Order.user es onDelete: Restrict -> borrar primero).
    await client.query(
      `delete from payment_events
        where payment_id in (
          select p.id from payments p
          join orders o on o.id = p.order_id
          where o.user_id = $1
        )`,
      [authUserId],
    );
    await client.query(
      `delete from payments where order_id in (select id from orders where user_id = $1)`,
      [authUserId],
    );
    // fulfillment/orders: curation_assignments y reading_feedback referencian fulfillment con Restrict.
    // Como el e2e NO crea órdenes reales, esto normalmente es no-op; se ordena por seguridad.
    await client.query(
      `delete from feedback_invitations
        where curation_assignment_id in (
          select ca.id from curation_assignments ca
          join fulfillments f on f.id = ca.fulfillment_id
          join orders o on o.id = f.order_id
          where o.user_id = $1
        )`,
      [authUserId],
    );
    await client.query(
      `delete from reading_feedback_aspects
        where feedback_id in (
          select rf.id from reading_feedback rf
          join orders o on o.id = rf.order_id
          where o.user_id = $1
        )`,
      [authUserId],
    );
    await client.query(
      `delete from curation_assignments
        where fulfillment_id in (
          select f.id from fulfillments f
          join orders o on o.id = f.order_id
          where o.user_id = $1
        )`,
      [authUserId],
    );
    await client.query(
      `delete from fulfillments where order_id in (select id from orders where user_id = $1)`,
      [authUserId],
    );
    await client.query(
      `delete from order_shipping_addresses where order_id in (select id from orders where user_id = $1)`,
      [authUserId],
    );
    await client.query(`delete from orders where user_id = $1`, [authUserId]);

    // 2) Usuario público (cascada al resto de tablas con userId: sessions, answers, profiles,
    //    evidence, feedback, recommendations, reader_tag_evidence, etc.)
    //    Primero hay que limpiar los join con onDelete: Restrict que apuntan a filas del usuario:
    //    - profile_version_evidence referencia reader_profile_version y reader_evidence (Restrict)
    //    - la auto-relación de reader_evidence (superseded_by) también es Restrict
    await client.query(
      `delete from profile_version_evidence
        where profile_version_id in (
          select rv.id from reader_profile_versions rv
          join reader_profiles rp on rp.id = rv.profile_id
          where rp.user_id = $1
        ) or evidence_id in (
          select id from reader_evidence where user_id = $1
        )`,
      [authUserId],
    );
    await client.query(
      `delete from reader_evidence where user_id = $1 and superseded_by is not null`,
      [authUserId],
    );
    await client.query(`delete from users where id = $1`, [authUserId]);

    // 3) Usuario de auth + artefactos asociados (identities, sessions, refresh tokens).
    await client.query(`delete from auth.identities where user_id = $1`, [authUserId]);
    await client.query(`delete from auth.mfa_amr_claims where session_id in (select id from auth.sessions where user_id = $1)`, [authUserId]);
    await client.query(`delete from auth.sessions where user_id = $1`, [authUserId]);
    await client.query(`delete from auth.refresh_tokens where user_id = $1`, [authUserId]);
    await client.query(`delete from auth.users where id = $1`, [authUserId]);
  });

  return { removed: true, authUserId };
}
