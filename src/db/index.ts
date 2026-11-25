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
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    '';
  return raw.replace(/^["']|["']$/g, '').trim();
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl() || process.env.SQL_HOST?.trim());
}

function normalizePostgresConnectionString(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.searchParams.has('sslmode')) {
      parsed.searchParams.delete('sslmode');
    }
    // Supabase Session Pooler (*.pooler.supabase.com:5432) caps total clients at 15.
    // Automatically use Supabase Supavisor Transaction Pooler (port 6543) to avoid EMAXCONNSESSION.
    if (
      parsed.hostname.endsWith('.pooler.supabase.com') &&
      (!parsed.port || parsed.port === '5432')
    ) {
      parsed.port = '6543';
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
);

export const createPool = () => {
  if (!global._postgresPool) {
    const databaseUrl = getDatabaseUrl();
    const maxConnections = isServerless ? 2 : 3;
    const idleTimeoutMillis = isServerless ? 1500 : 5000;

    global._postgresPool = databaseUrl
      ? new Pool({
          connectionString: normalizePostgresConnectionString(databaseUrl),
          ssl: { rejectUnauthorized: false },
          max: maxConnections,
          idleTimeoutMillis,
          allowExitOnIdle: true,
          connectionTimeoutMillis: 15000,
        })
      : new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: maxConnections,
          idleTimeoutMillis,
          allowExitOnIdle: true,
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

function isTransientDbError(err: unknown): boolean {
  const errObj = err as { code?: string; message?: string; cause?: unknown };
  const causeObj = (errObj?.cause ?? {}) as { code?: string; message?: string };
  const code = String(errObj?.code || causeObj?.code || '');
  const message = `${errObj?.message || ''} ${causeObj?.message || ''}`.toLowerCase();

  return (
    code === '53300' ||
    code === 'XX000' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    message.includes('emaxconnsession') ||
    message.includes('max clients reached') ||
    message.includes('too many clients') ||
    message.includes('connection terminated unexpectedly')
  );
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries = 2
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      if (attempt >= retries || !isTransientDbError(err)) {
        throw err;
      }
      const delayMs = attempt === 0 ? 200 : 500;
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
