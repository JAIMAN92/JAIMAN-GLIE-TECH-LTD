import express, { type NextFunction, type Request, type Response } from 'express';
import { isDatabaseConfigured } from '../db/index.ts';
import publicRoutes from './routes/public.ts';
import adminAuthRoutes from './routes/adminAuth.ts';
import adminRoutes from './routes/admin.ts';
import cbtRoutes from './routes/cbt.ts';

export function createApiApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json({ limit: '6mb' }));

  // Security headers for API & HTML responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      databaseConfigured: isDatabaseConfigured(),
      envDetected: {
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
        hasPostgresUrl: Boolean(process.env.POSTGRES_URL?.trim()),
        hasSqlHost: Boolean(process.env.SQL_HOST?.trim()),
      },
    });
  });

  // Fail fast with a clear JSON error if hosting environment has no database configured
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') {
      return next();
    }
    if (!isDatabaseConfigured()) {
      return res.status(503).json({
        error:
          'Database connection is not configured. Add DATABASE_URL (your Supabase PostgreSQL connection string) in your deployment Environment Variables and redeploy.',
      });
    }
    next();
  });

  // API Routes
  app.use('/api/public', publicRoutes);
  app.use('/api/admin', adminAuthRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/cbt', cbtRoutes);

  // Ensure unknown /api/* paths always return JSON instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // JSON error handler for API requests
  app.use(
    (err: unknown, req: Request, res: Response, next: NextFunction) => {
      if (!req.path.startsWith('/api')) {
        return next(err);
      }
      console.error('Unhandled API error:', err);
      res.status(500).json({
        error: 'An unexpected server error occurred. Please try again.',
      });
    }
  );

  return app;
}
