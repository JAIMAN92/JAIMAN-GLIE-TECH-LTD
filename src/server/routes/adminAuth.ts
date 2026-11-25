import crypto from 'crypto';
import { Router } from 'express';
import { and, count, desc, eq, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { adminSessions, admins } from '../../db/schema.ts';
import {
  type AdminRequest,
  checkLoginLockout,
  clearLoginFailures,
  ensureAdminRoleColumns,
  logAdminActivity,
  normalizeAdminRole,
  recordFailedLogin,
  requireAdmin,
} from '../authMiddleware.ts';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  verifyPassword,
} from '../crypto.ts';

const router = Router();

function getClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}) {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return (first || req.socket.remoteAddress || 'unknown').trim().slice(0, 64);
}

async function createAdminSession(
  adminId: number,
  authMethod: 'password',
  req: {
    headers: Record<string, string | string[] | undefined>;
    socket: { remoteAddress?: string };
  }
) {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 240);

  await db.insert(adminSessions).values({
    adminId,
    tokenHash,
    authMethod,
    ipAddress: getClientIp(req),
    userAgent: ua,
    expiresAt,
  });

  return rawToken;
}

router.get('/auth-status', async (_req, res) => {
  try {
    await ensureAdminRoleColumns();
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(admins);
    const hasEnvInitialPassword = Boolean(
      process.env.ADMIN_INITIAL_PASSWORD &&
        process.env.ADMIN_INITIAL_PASSWORD.trim().length > 0
    );
    res.json({
      needsBootstrap: Number(adminCount) === 0 && !hasEnvInitialPassword,
      hasEnvInitialPassword,
    });
  } catch (error) {
    console.error('Auth status check failed:', error);
    res.status(500).json({ error: 'Failed to check administrator status.' });
  }
});

router.post('/bootstrap', async (req, res) => {
  try {
    await ensureAdminRoleColumns();
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(admins);
    const hasEnvInitialPassword = Boolean(
      process.env.ADMIN_INITIAL_PASSWORD &&
        process.env.ADMIN_INITIAL_PASSWORD.trim().length > 0
    );

    if (Number(adminCount) > 0 || hasEnvInitialPassword) {
      return res.status(403).json({
        error: 'Administrator setup is already locked. Please sign in normally.',
      });
    }

    const { username, email, fullName, password } = req.body ?? {};
    if (
      typeof username !== 'string' ||
      username.trim().length < 3 ||
      typeof email !== 'string' ||
      !isValidEmail(email) ||
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        error:
          'Provide a valid username (min 3 chars), full name, email address, and password (min 8 characters).',
      });
    }

    const [created] = await db
      .insert(admins)
      .values({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role: 'super_admin',
        isActive: true,
        passwordHash: hashPassword(password),
        mustChangePassword: false,
      })
      .returning();

    const token = await createAdminSession(created.id, 'password', req);
    await logAdminActivity({
      adminId: created.id,
      adminLabel: created.username,
      action: 'INITIAL_ADMIN_SETUP',
      targetType: 'admin',
      targetDetails: `Initial administrator account claimed for ${created.email}`,
    });

    res.status(201).json({
      token,
      admin: {
        id: created.id,
        username: created.username,
        email: created.email,
        fullName: created.fullName,
        role: normalizeAdminRole(created.role),
        mustChangePassword: created.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Admin bootstrap failed:', error);
    res.status(500).json({ error: 'Unable to complete administrator setup.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    await ensureAdminRoleColumns();
    const { identifier, password } = req.body ?? {};
    if (
      typeof identifier !== 'string' ||
      !identifier.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res
        .status(400)
        .json({ error: 'Username/email and password are required.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const rateKey = `admin:${getClientIp(req)}:${cleanId}`;
    const lockout = await checkLoginLockout(rateKey);
    if (lockout.locked) {
      return res.status(429).json({
        error: `Too many failed login attempts. Try again in ${lockout.retryMinutes} minute(s).`,
      });
    }

    const existingAdmins = await db.select().from(admins);
    const envInitial = process.env.ADMIN_INITIAL_PASSWORD?.trim() ?? '';

    if (existingAdmins.length === 0) {
      if (!envInitial) {
        return res.status(400).json({
          error:
            'No administrator account exists yet. Complete initial administrator setup first.',
        });
      }

      const providedDigest = crypto
        .createHash('sha256')
        .update(password)
        .digest();
      const expectedDigest = crypto
        .createHash('sha256')
        .update(envInitial)
        .digest();

      if (!crypto.timingSafeEqual(providedDigest, expectedDigest)) {
        await recordFailedLogin(rateKey);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const [seededAdmin] = await db
        .insert(admins)
        .values({
          username: cleanId.includes('@') ? 'admin' : cleanId,
          email: cleanId.includes('@')
            ? cleanId
            : 'admin@jaimangoldenlite.local',
          fullName: 'System Administrator',
          role: 'super_admin',
          isActive: true,
          passwordHash: hashPassword(password),
          mustChangePassword: true,
        })
        .returning();

      await clearLoginFailures(rateKey);
      const token = await createAdminSession(seededAdmin.id, 'password', req);
      await logAdminActivity({
        adminId: seededAdmin.id,
        adminLabel: seededAdmin.username,
        action: 'LOGIN',
        targetType: 'session',
        targetDetails: 'First login using initial administrator credential',
      });

      return res.json({
        token,
        admin: {
          id: seededAdmin.id,
          username: seededAdmin.username,
          email: seededAdmin.email,
          fullName: seededAdmin.fullName,
          role: normalizeAdminRole(seededAdmin.role),
          mustChangePassword: seededAdmin.mustChangePassword,
        },
      });
    }

    const [matched] = await db
      .select()
      .from(admins)
      .where(or(eq(admins.username, cleanId), eq(admins.email, cleanId)))
      .limit(1);

    let envMatches = false;
    if (
      envInitial &&
      matched &&
      matched.username === 'admin' &&
      normalizeAdminRole(matched.role) === 'super_admin'
    ) {
      const providedDigest = crypto
        .createHash('sha256')
        .update(password)
        .digest();
      const expectedDigest = crypto
        .createHash('sha256')
        .update(envInitial)
        .digest();
      envMatches = crypto.timingSafeEqual(providedDigest, expectedDigest);
    }

    if (!matched || (!verifyPassword(password, matched.passwordHash) && !envMatches)) {
      await recordFailedLogin(rateKey);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (!matched.isActive) {
      return res.status(403).json({
        error:
          'This administrator account has been deactivated. Contact a primary administrator.',
      });
    }

    await clearLoginFailures(rateKey);
    const token = await createAdminSession(matched.id, 'password', req);
    await logAdminActivity({
      adminId: matched.id,
      adminLabel: matched.username,
      action: 'LOGIN',
      targetType: 'session',
      targetDetails: `Administrator signed in from ${getClientIp(req)}`,
    });

    res.json({
      token,
      admin: {
        id: matched.id,
        username: matched.username,
        email: matched.email,
        fullName: matched.fullName,
        role: normalizeAdminRole(matched.role),
        mustChangePassword: matched.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Sign-in failed. Please try again.' });
  }
});

router.get('/me', requireAdmin, async (req: AdminRequest, res) => {
  res.json({ admin: req.admin });
});

router.post('/change-password', requireAdmin, async (req: AdminRequest, res) => {
  try {
    const admin = req.admin!;
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters long.',
      });
    }

    const [dbAdmin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, admin.id))
      .limit(1);

    if (!dbAdmin) {
      return res.status(404).json({ error: 'Administrator record not found.' });
    }

    if (!dbAdmin.mustChangePassword) {
      if (
        typeof currentPassword !== 'string' ||
        !verifyPassword(currentPassword, dbAdmin.passwordHash)
      ) {
        return res
          .status(400)
          .json({ error: 'Current password is incorrect.' });
      }
    } else if (
      typeof currentPassword === 'string' &&
      currentPassword === newPassword
    ) {
      return res.status(400).json({
        error: 'Your new password must differ from the initial password.',
      });
    }

    if (verifyPassword(newPassword, dbAdmin.passwordHash)) {
      return res.status(400).json({
        error: 'New password cannot be the same as your existing password.',
      });
    }

    const [updated] = await db
      .update(admins)
      .set({
        passwordHash: hashPassword(newPassword),
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(admins.id, admin.id))
      .returning();

    await logAdminActivity({
      adminId: admin.id,
      adminLabel: admin.username,
      action: 'PASSWORD_CHANGED',
      targetType: 'admin',
      targetDetails: 'Administrator password updated successfully',
    });

    res.json({
      admin: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        fullName: updated.fullName,
        role: normalizeAdminRole(updated.role),
        mustChangePassword: updated.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Unable to update password.' });
  }
});

router.post('/logout', requireAdmin, async (req: AdminRequest, res) => {
  try {
    await db
      .update(adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(adminSessions.id, req.admin!.sessionId));

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'LOGOUT',
      targetType: 'session',
      targetDetails: 'Administrator signed out',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to log out cleanly.' });
  }
});

router.get('/sessions', requireAdmin, async (req: AdminRequest, res) => {
  try {
    const rows = await db
      .select({
        id: adminSessions.id,
        authMethod: adminSessions.authMethod,
        ipAddress: adminSessions.ipAddress,
        userAgent: adminSessions.userAgent,
        expiresAt: adminSessions.expiresAt,
        revokedAt: adminSessions.revokedAt,
        createdAt: adminSessions.createdAt,
      })
      .from(adminSessions)
      .where(eq(adminSessions.adminId, req.admin!.id))
      .orderBy(desc(adminSessions.createdAt))
      .limit(20);

    res.json({
      currentSessionId: req.admin!.sessionId,
      sessions: rows,
    });
  } catch (error) {
    console.error('Fetch sessions error:', error);
    res.status(500).json({ error: 'Unable to load active sessions.' });
  }
});

router.delete('/sessions/:id', requireAdmin, async (req: AdminRequest, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }

    await db
      .update(adminSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(adminSessions.id, sessionId),
          eq(adminSessions.adminId, req.admin!.id)
        )
      );

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'SESSION_REVOKED',
      targetType: 'session',
      targetDetails: `Revoked session #${sessionId}`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Unable to revoke session.' });
  }
});

export default router;
