import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function getDatabaseUrl(): string {
  const raw =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    '';
  return raw.replace(/^["']|["']$/g, '').trim();
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl() || process.env.SQL_HOST?.trim());
}

export const createPool = () => {
  if (!global._postgresPool) {
    const databaseUrl = getDatabaseUrl();

    global._postgresPool = databaseUrl
      ? new Pool({
          connectionString: databaseUrl,
          ssl: { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 15000,
        })
      : new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: 10,
          connectionTimeoutMillis: 15000,
        });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
