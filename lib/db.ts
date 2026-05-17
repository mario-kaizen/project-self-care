import { Pool } from "pg";

let pool: Pool | null = null;
let schemaReady = false;

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  pool = new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS selfcare_state (
      id TEXT PRIMARY KEY DEFAULT 'me',
      user_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO selfcare_state (id) VALUES ('me') ON CONFLICT (id) DO NOTHING;
  `);
  schemaReady = true;
}
