import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  adminActivityLogs,
  adminSessions,
  admins,
  loginAttempts,
  schools,
  studentSessions,
  students,
} from '../db/schema.ts';
import { hashSessionToken } from './crypto.ts';
import type { AdminRole } from '../shared/types.ts';

let adminColumnsReadyPromise: Promise<void> | null = null;

export async function ensureAdminRoleColumns(): Promise<void> {
  if (!adminColumnsReadyPromise) {
    adminColumnsReadyPromise = (async () => {
      try {
        await db.execute(
          sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'super_admin'`
        );
        await db.execute(
          sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`
        );
      } catch (err) {
        adminColumnsReadyPromise = null;
        console.warn('Admin column migration check:', err);
      }
    })();
  }
  return adminColumnsReadyPromise;
}

export function normalizeAdminRole(raw?: string | null): AdminRole {
  return raw === 'data_entry' ? 'data_entry' : 'super_admin';
}

export interface AdminRequest extends Request {
  admin?: {
    id: number;
    username: string;
    email: string;
    fullName: string;
    role: AdminRole;
    isActive: boolean;
    mustChangePassword: boolean;
    sessionId: number;
  };
}

export interface StudentRequest extends Request {
  student?: {
    id: number;
    schoolId: number;
    schoolName: string;
    examNumber: string;
    fullName: string;
    classLevel: string;
    arm: string;
    sessionId: number;
  };
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

export async function checkLoginLockout(
  identifier: string
): Promise<{ locked: boolean; retryMinutes: number }> {
  try {
    const [row] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.identifier, identifier))
      .limit(1);

    if (row?.lockedUntil && row.lockedUntil > new Date()) {
      const msLeft = row.lockedUntil.getTime() - Date.now();
      return {
        locked: true,
        retryMinutes: Math.max(1, Math.ceil(msLeft / 60000)),
      };
    }
    return { locked: false, retryMinutes: 0 };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { locked: false, retryMinutes: 0 };
  }
}

export async function recordFailedLogin(identifier: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.identifier, identifier))
      .limit(1);

    const now = new Date();
    const expiredWindow =
      existing &&
      now.getTime() - existing.lastAttemptAt.getTime() >
        LOCK_DURATION_MINUTES * 60 * 1000;

    const nextCount = expiredWindow ? 1 : (existing?.failedCount ?? 0) + 1;
    const lockedUntil =
      nextCount >= MAX_FAILED_ATTEMPTS
        ? new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000)
        : null;

    await db
      .insert(loginAttempts)
      .values({
        identifier,
        failedCount: nextCount,
        lockedUntil,
        lastAttemptAt: now,
      })
      .onConflictDoUpdate({
        target: loginAttempts.identifier,
        set: {
          failedCount: nextCount,
          lockedUntil,
          lastAttemptAt: now,
        },
      });
  } catch (error) {
    console.error('Failed login recording error:', error);
  }
}

export async function clearLoginFailures(identifier: string): Promise<void> {
  try {
    await db
      .delete(loginAttempts)
      .where(eq(loginAttempts.identifier, identifier));
  } catch (error) {
    console.error('Clear login failures error:', error);
  }
}

export async function logAdminActivity(params: {
  adminId: number | null;
  adminLabel: string;
  action: string;
  targetType: string;
  targetDetails: string;
}): Promise<void> {
  try {
    await db.insert(adminActivityLogs).values({
      adminId: params.adminId,
      adminLabel: params.adminLabel,
      action: params.action,
      targetType: params.targetType,
      targetDetails: params.targetDetails,
    });
  } catch (error) {
    console.error('Activity log write error:', error);
  }
}

export const requireAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Missing administrator token.' });
  }

  const rawToken = authHeader.slice('Bearer '.length).trim();
  if (!rawToken) {
    return res.status(401).json({ error: 'Unauthorized: Empty token.' });
  }

  try {
    await ensureAdminRoleColumns();
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();

    const rows = await db
      .select({
        sessionId: adminSessions.id,
        adminId: admins.id,
        username: admins.username,
        email: admins.email,
        fullName: admins.fullName,
        role: admins.role,
        isActive: admins.isActive,
        mustChangePassword: admins.mustChangePassword,
      })
      .from(adminSessions)
      .innerJoin(admins, eq(adminSessions.adminId, admins.id))
      .where(
        and(
          eq(adminSessions.tokenHash, tokenHash),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, now)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ error: 'Session expired or invalid. Please sign in again.' });
    }

    const sessionUser = rows[0];

    if (!sessionUser.isActive) {
      return res.status(403).json({
        error:
          'This administrator account has been deactivated. Contact a primary administrator.',
      });
    }

    // Allow password change, profile/me, and logout even when mustChangePassword is true
    const allowedWhenForced = [
      '/change-password',
      '/logout',
      '/me',
    ];
    const isAllowed = allowedWhenForced.some((p) => req.path.endsWith(p));

    if (sessionUser.mustChangePassword && !isAllowed) {
      return res.status(403).json({
        error:
          'Password change required before accessing administrative features.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    req.admin = {
      id: sessionUser.adminId,
      username: sessionUser.username,
      email: sessionUser.email,
      fullName: sessionUser.fullName,
      role: normalizeAdminRole(sessionUser.role),
      isActive: sessionUser.isActive,
      mustChangePassword: sessionUser.mustChangePassword,
      sessionId: sessionUser.sessionId,
    };

    return next();
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return res
      .status(500)
      .json({ error: 'Authentication verification failed.' });
  }
};

export const requireSuperAdmin = (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({
      error:
        'Access denied: Your account is restricted to Student Registration and Questions & Answers management only.',
    });
  }
  return next();
};

export const requireStudent = async (
  req: StudentRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Student authentication required.' });
  }

  const rawToken = authHeader.slice('Bearer '.length).trim();
  if (!rawToken) {
    return res.status(401).json({ error: 'Unauthorized: Empty token.' });
  }

  try {
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();

    const rows = await db
      .select({
        sessionId: studentSessions.id,
        studentId: students.id,
        schoolId: students.schoolId,
        schoolName: schools.name,
        examNumber: students.examNumber,
        fullName: students.fullName,
        classLevel: students.classLevel,
        arm: students.arm,
        studentActive: students.isActive,
        schoolActive: schools.isActive,
      })
      .from(studentSessions)
      .innerJoin(students, eq(studentSessions.studentId, students.id))
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(
        and(
          eq(studentSessions.tokenHash, tokenHash),
          isNull(studentSessions.revokedAt),
          gt(studentSessions.expiresAt, now)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ error: 'Examination session expired. Please log in again.' });
    }

    const row = rows[0];
    if (!row.studentActive || !row.schoolActive) {
      return res.status(403).json({
        error:
          'This student or school account is currently deactivated. Contact your school administrator.',
      });
    }

    req.student = {
      id: row.studentId,
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      examNumber: row.examNumber,
      fullName: row.fullName,
      classLevel: row.classLevel,
      arm: row.arm,
      sessionId: row.sessionId,
    };

    return next();
  } catch (error) {
    console.error('Student auth verification error:', error);
    return res
      .status(500)
      .json({ error: 'Student authentication check failed.' });
  }
};
