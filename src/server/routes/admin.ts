import { Router } from 'express';
import { and, asc, count, desc, eq, inArray, like, sql } from 'drizzle-orm';
import { db, getDatabaseUrl, isDatabaseConfigured } from '../../db/index.ts';
import {
  adminActivityLogs,
  adminSessions,
  admins,
  announcements,
  classArms,
  contactEnquiries,
  examAssignments,
  examAttempts,
  examQuestions,
  examinations,
  questions,
  schools,
  siteSettings,
  students,
  subjects,
} from '../../db/schema.ts';
import {
  type AdminRequest,
  ensureAllSchemaColumns,
  ensureExamColumns,
  ensureQuestionColumns,
  ensureSchoolColumns,
  invalidateStudentSessionsForSchool,
  invalidateStudentSessionsForStudent,
  logAdminActivity,
  normalizeAdminRole,
  requireAdmin,
  requireSuperAdmin,
  sanitizeImageUrl,
  sanitizeQuestionImageUrl,
} from '../authMiddleware.ts';
import { invalidateCbtExamCache } from '../cbtCache.ts';
import {
  escapeCsvCell,
  hashPassword,
  isValidEmail,
  parseCsvRows,
} from '../crypto.ts';
import { syncSeedData } from '../seed.ts';
import { getSupabaseAdmin } from '../supabase.ts';

const router = Router();
router.use(requireAdmin);

// 1. DASHBOARD OVERVIEW
router.get('/overview', requireSuperAdmin, async (_req: AdminRequest, res) => {
  try {
    await ensureAllSchemaColumns();
    const [
      [{ value: totalSchools }],
      [{ value: totalStudents }],
      [{ value: totalExaminations }],
      [{ value: activeExaminations }],
      [{ value: completedAttempts }],
      [{ value: unreadEnquiries }],
      [{ value: totalQuestions }],
    ] = await Promise.all([
      db.select({ value: count() }).from(schools),
      db.select({ value: count() }).from(students),
      db.select({ value: count() }).from(examinations),
      db
        .select({ value: count() })
        .from(examinations)
        .where(eq(examinations.isActive, true)),
      db
        .select({ value: count() })
        .from(examAttempts)
        .where(eq(examAttempts.status, 'submitted')),
      db
        .select({ value: count() })
        .from(contactEnquiries)
        .where(eq(contactEnquiries.isRead, false)),
      db.select({ value: count() }).from(questions),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const allExams = await db
      .select({
        isActive: examinations.isActive,
        examDate: examinations.examDate,
      })
      .from(examinations);
    const completedExamsCount = allExams.filter(
      (e) => !e.isActive || e.examDate < todayStr
    ).length;

    const subjectStats = await db
      .select({
        subjectName: subjects.name,
        attempts: count(examAttempts.id),
        avgPercentage: sql<number>`coalesce(round(avg(${examAttempts.percentage})), 0)`,
      })
      .from(subjects)
      .leftJoin(examinations, eq(examinations.subjectId, subjects.id))
      .leftJoin(
        examAttempts,
        and(
          eq(examAttempts.examId, examinations.id),
          eq(examAttempts.status, 'submitted')
        )
      )
      .groupBy(subjects.id, subjects.name);

    const schoolStats = await db
      .select({
        schoolName: schools.name,
        studentCount: count(students.id),
      })
      .from(schools)
      .leftJoin(students, eq(students.schoolId, schools.id))
      .groupBy(schools.id, schools.name)
      .limit(8);

    const recentLogs = await db
      .select()
      .from(adminActivityLogs)
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(8);

    res.json({
      stats: {
        totalSchools: Number(totalSchools),
        totalStudents: Number(totalStudents),
        totalExaminations: Number(totalExaminations),
        activeExaminations: Number(activeExaminations),
        completedExaminations: completedExamsCount,
        totalSubmittedResults: Number(completedAttempts),
        unreadEnquiries: Number(unreadEnquiries),
        totalQuestions: Number(totalQuestions),
      },
      charts: {
        subjectPerformance: subjectStats.map((s) => ({
          subject: s.subjectName,
          submissions: Number(s.attempts),
          avgScore: Number(s.avgPercentage),
        })),
        studentsBySchool: schoolStats.map((s) => ({
          school: s.schoolName,
          students: Number(s.studentCount),
        })),
      },
      recentLogs,
    });
  } catch (error) {
    console.error('Overview fetch error:', error);
    res.status(500).json({ error: 'Failed to load dashboard overview.' });
  }
});

// 2. WEBSITE MANAGEMENT & 9. WEBSITE SETTINGS
router.put('/site-settings/:sectionKey', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const { sectionKey } = req.params;
    const allowed = [
      'homepage',
      'about',
      'vision',
      'branding',
      'contact',
      'navigation',
    ];
    if (!allowed.includes(sectionKey)) {
      return res.status(400).json({ error: 'Invalid site section key.' });
    }

    const content = req.body?.content;
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Invalid content payload.' });
    }

    await db
      .insert(siteSettings)
      .values({
        sectionKey,
        content,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteSettings.sectionKey,
        set: {
          content,
          updatedAt: new Date(),
        },
      });

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'UPDATE_SITE_CONTENT',
      targetType: 'site_settings',
      targetDetails: `Updated ${sectionKey} content/settings`,
    });

    res.json({ success: true, sectionKey, content });
  } catch (error) {
    console.error('Update site settings error:', error);
    res.status(500).json({ error: 'Unable to save website changes.' });
  }
});

router.get('/announcements', requireSuperAdmin, async (_req: AdminRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));
    res.json({ announcements: rows });
  } catch (error) {
    console.error('Announcements fetch error:', error);
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

router.post('/announcements', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const { title, message, targetPage, isActive } = req.body ?? {};
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof message !== 'string' ||
      !message.trim()
    ) {
      return res
        .status(400)
        .json({ error: 'Announcement title and message are required.' });
    }

    const [created] = await db
      .insert(announcements)
      .values({
        title: title.trim(),
        message: message.trim(),
        targetPage: ['all', 'home', 'cbt'].includes(targetPage)
          ? targetPage
          : 'all',
        isActive: isActive !== false,
      })
      .returning();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'CREATE_ANNOUNCEMENT',
      targetType: 'announcement',
      targetDetails: created.title,
    });

    res.status(201).json({ announcement: created });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Unable to create announcement.' });
  }
});

router.put('/announcements/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, message, targetPage, isActive } = req.body ?? {};
    const [updated] = await db
      .update(announcements)
      .set({
        ...(typeof title === 'string' ? { title: title.trim() } : {}),
        ...(typeof message === 'string' ? { message: message.trim() } : {}),
        ...(typeof targetPage === 'string' ? { targetPage } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      })
      .where(eq(announcements.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }
    res.json({ announcement: updated });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Unable to update announcement.' });
  }
});

router.delete('/announcements/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(announcements).where(eq(announcements.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Unable to delete announcement.' });
  }
});

// 3. SCHOOL MANAGEMENT
router.get('/schools', async (req: AdminRequest, res) => {
  try {
    await ensureSchoolColumns();
    const rows = await db
      .select({
        id: schools.id,
        name: schools.name,
        code: schools.code,
        state: schools.state,
        lga: schools.lga,
        contactPerson: schools.contactPerson,
        contactEmail: schools.contactEmail,
        contactPhone: schools.contactPhone,
        accessCode: schools.accessCode,
        logoUrl: schools.logoUrl,
        isActive: schools.isActive,
        createdAt: schools.createdAt,
        studentCount: count(students.id),
      })
      .from(schools)
      .leftJoin(students, eq(students.schoolId, schools.id))
      .groupBy(schools.id)
      .orderBy(desc(schools.createdAt));

    const isSuper = req.admin?.role === 'super_admin';
    res.json({
      schools: rows.map((r) => ({
        ...r,
        logoUrl: r.logoUrl || '',
        accessCode: isSuper ? r.accessCode : '',
        studentCount: Number(r.studentCount),
      })),
    });
  } catch (error) {
    console.error('Fetch schools error:', error);
    res.status(500).json({ error: 'Failed to load schools.' });
  }
});

router.post('/schools', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    await ensureSchoolColumns();
    const {
      name,
      code,
      state,
      lga,
      contactPerson,
      contactEmail,
      contactPhone,
      accessCode,
      logoUrl,
    } = req.body ?? {};

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof code !== 'string' ||
      !code.trim() ||
      typeof state !== 'string' ||
      !state.trim() ||
      typeof contactPerson !== 'string' ||
      !contactPerson.trim() ||
      typeof contactEmail !== 'string' ||
      !isValidEmail(contactEmail) ||
      typeof contactPhone !== 'string' ||
      !contactPhone.trim()
    ) {
      return res.status(400).json({
        error:
          'School name, code, state, contact person, valid email, and phone number are required.',
      });
    }

    const sanitizedLogo = sanitizeImageUrl(logoUrl);
    if (sanitizedLogo === null) {
      return res.status(400).json({
        error:
          'School or agency logo must be a valid image upload or an http(s) / relative image URL under 1.2 MB.',
      });
    }

    const generatedAccess =
      typeof accessCode === 'string' && accessCode.trim()
        ? accessCode.trim()
        : `JGT-${code.trim().toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [created] = await db
      .insert(schools)
      .values({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        state: state.trim(),
        lga: typeof lga === 'string' ? lga.trim() : '',
        contactPerson: contactPerson.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim(),
        accessCode: generatedAccess,
        logoUrl: sanitizedLogo,
        isActive: true,
      })
      .returning();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'CREATE_SCHOOL',
      targetType: 'school',
      targetDetails: `${created.name} (${created.code})`,
    });

    res.status(201).json({ school: created });
  } catch (error: unknown) {
    console.error('Create school error:', error);
    res.status(400).json({
      error: 'Unable to create school. Ensure the school code is unique.',
    });
  }
});

router.put('/schools/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    await ensureSchoolColumns();
    const id = Number(req.params.id);
    const {
      name,
      code,
      state,
      lga,
      contactPerson,
      contactEmail,
      contactPhone,
      accessCode,
      logoUrl,
      isActive,
    } = req.body ?? {};

    let sanitizedLogo: string | undefined;
    if (logoUrl !== undefined) {
      const cleaned = sanitizeImageUrl(logoUrl);
      if (cleaned === null) {
        return res.status(400).json({
          error:
            'School or agency logo must be a valid image upload or an http(s) / relative image URL under 1.2 MB.',
        });
      }
      sanitizedLogo = cleaned;
    }

    const [updated] = await db
      .update(schools)
      .set({
        ...(typeof name === 'string' ? { name: name.trim() } : {}),
        ...(typeof code === 'string' ? { code: code.trim().toUpperCase() } : {}),
        ...(typeof state === 'string' ? { state: state.trim() } : {}),
        ...(typeof lga === 'string' ? { lga: lga.trim() } : {}),
        ...(typeof contactPerson === 'string'
          ? { contactPerson: contactPerson.trim() }
          : {}),
        ...(typeof contactEmail === 'string' && isValidEmail(contactEmail)
          ? { contactEmail: contactEmail.trim().toLowerCase() }
          : {}),
        ...(typeof contactPhone === 'string'
          ? { contactPhone: contactPhone.trim() }
          : {}),
        ...(typeof accessCode === 'string' && accessCode.trim()
          ? { accessCode: accessCode.trim() }
          : {}),
        ...(sanitizedLogo !== undefined ? { logoUrl: sanitizedLogo } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      })
      .where(eq(schools.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'School not found.' });
    }

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'UPDATE_SCHOOL',
      targetType: 'school',
      targetDetails: `${updated.name} (${updated.code})`,
    });

    invalidateStudentSessionsForSchool(id);
    res.json({ school: updated });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ error: 'Unable to update school.' });
  }
});

router.patch('/schools/:id/toggle', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, id))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const [updated] = await db
      .update(schools)
      .set({ isActive: !existing.isActive })
      .where(eq(schools.id, id))
      .returning();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: updated.isActive ? 'ACTIVATE_SCHOOL' : 'DEACTIVATE_SCHOOL',
      targetType: 'school',
      targetDetails: updated.name,
    });

    invalidateStudentSessionsForSchool(id);
    res.json({ school: updated });
  } catch (error) {
    console.error('Toggle school error:', error);
    res.status(500).json({ error: 'Unable to change school status.' });
  }
});

router.get('/schools/:id/records', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const schoolId = Number(req.params.id);
    const records = await db
      .select({
        attemptId: examAttempts.id,
        studentName: students.fullName,
        examNumber: students.examNumber,
        classLevel: students.classLevel,
        arm: students.arm,
        examTitle: examinations.title,
        subjectName: subjects.name,
        score: examAttempts.score,
        totalMarks: examAttempts.totalMarks,
        percentage: examAttempts.percentage,
        status: examAttempts.status,
        submittedAt: examAttempts.submittedAt,
      })
      .from(examAttempts)
      .innerJoin(students, eq(examAttempts.studentId, students.id))
      .innerJoin(examinations, eq(examAttempts.examId, examinations.id))
      .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
      .where(eq(students.schoolId, schoolId))
      .orderBy(desc(examAttempts.startedAt));

    res.json({ records });
  } catch (error) {
    console.error('School records error:', error);
    res.status(500).json({ error: 'Failed to load school exam records.' });
  }
});

router.delete('/schools/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(schools).where(eq(schools.id, id));
    invalidateStudentSessionsForSchool(id);
    invalidateCbtExamCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete school error:', error);
    res.status(500).json({ error: 'Unable to delete school.' });
  }
});

// 3B. CLASSES & ARMS MANAGEMENT
router.get('/class-arms', async (req: AdminRequest, res) => {
  try {
    const schoolIdFilter = req.query.schoolId
      ? Number(req.query.schoolId)
      : null;

    const allClassArms = await db
      .select()
      .from(classArms)
      .where(schoolIdFilter ? eq(classArms.schoolId, schoolIdFilter) : undefined)
      .orderBy(asc(classArms.classLevel), asc(classArms.armName));

    await ensureSchoolColumns();
    const allSchools = await db.select().from(schools);
    const schoolMap = new Map(allSchools.map((s) => [s.id, s]));

    const allStudents = await db
      .select({
        schoolId: students.schoolId,
        classLevel: students.classLevel,
        arm: students.arm,
      })
      .from(students);

    const enriched = allClassArms.map((ca) => {
      const targetClass = ca.classLevel.trim().toUpperCase();
      const targetArm = ca.armName.trim().toUpperCase();
      const studentCount = allStudents.filter((st) => {
        const classMatch = st.classLevel.trim().toUpperCase() === targetClass;
        const armMatch = st.arm.trim().toUpperCase() === targetArm;
        const schoolMatch = ca.schoolId === null || st.schoolId === ca.schoolId;
        return classMatch && armMatch && schoolMatch;
      }).length;

      const matchedSchool = ca.schoolId ? schoolMap.get(ca.schoolId) : undefined;

      return {
        ...ca,
        schoolName: ca.schoolId
          ? matchedSchool?.name || 'Specific School'
          : 'All Registered Schools (Global)',
        schoolLogoUrl: matchedSchool?.logoUrl || '',
        studentCount,
      };
    });

    res.json({ classArms: enriched });
  } catch (error) {
    console.error('Fetch class-arms error:', error);
    res.status(500).json({ error: 'Failed to load classes and arms.' });
  }
});

router.post('/class-arms', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const { schoolId, classLevel, armName, isActive } = req.body ?? {};
    if (
      typeof classLevel !== 'string' ||
      !classLevel.trim() ||
      typeof armName !== 'string' ||
      !armName.trim()
    ) {
      return res
        .status(400)
        .json({ error: 'Class Level and Arm Name are required.' });
    }

    const cleanClass = classLevel.trim().toUpperCase();
    const cleanArm = armName.trim();
    const parsedSchoolId = schoolId ? Number(schoolId) : null;

    const existingRows = await db.select().from(classArms);
    const duplicate = existingRows.find(
      (r) =>
        (r.schoolId ?? null) === parsedSchoolId &&
        r.classLevel.trim().toUpperCase() === cleanClass &&
        r.armName.trim().toUpperCase() === cleanArm.toUpperCase()
    );

    if (duplicate) {
      return res.status(409).json({
        error: `Class & Arm "${cleanClass} ${cleanArm}" already exists for this scope.`,
      });
    }

    const [created] = await db
      .insert(classArms)
      .values({
        schoolId: parsedSchoolId,
        classLevel: cleanClass,
        armName: cleanArm,
        displayName: `${cleanClass} ${cleanArm}`,
        isActive: isActive !== false,
      })
      .returning();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'CREATE_CLASS_ARM',
      targetType: 'class_arm',
      targetDetails: created.displayName,
    });

    res.status(201).json({ classArm: created });
  } catch (error) {
    console.error('Create class-arm error:', error);
    res.status(500).json({ error: 'Unable to create class and arm.' });
  }
});

router.post('/class-arms/bulk', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const { schoolId, classLevels, armNames } = req.body ?? {};
    if (
      !Array.isArray(classLevels) ||
      classLevels.length === 0 ||
      !Array.isArray(armNames) ||
      armNames.length === 0
    ) {
      return res.status(400).json({
        error: 'Select at least one Class Level and provide at least one Arm.',
      });
    }

    const parsedSchoolId = schoolId ? Number(schoolId) : null;
    const cleanClasses = classLevels
      .map((c: unknown) => String(c).trim().toUpperCase())
      .filter(Boolean);
    const cleanArms = armNames
      .map((a: unknown) => String(a).trim())
      .filter(Boolean);

    if (cleanClasses.length === 0 || cleanArms.length === 0) {
      return res.status(400).json({
        error: 'Valid class levels and arm names are required.',
      });
    }

    const existingRows = await db.select().from(classArms);
    const existingKeys = new Set(
      existingRows.map(
        (r) =>
          `${r.schoolId ?? 'global'}::${r.classLevel.trim().toUpperCase()}::${r.armName.trim().toUpperCase()}`
      )
    );

    const toInsert: Array<{
      schoolId: number | null;
      classLevel: string;
      armName: string;
      displayName: string;
      isActive: boolean;
    }> = [];

    for (const cls of cleanClasses) {
      for (const arm of cleanArms) {
        const key = `${parsedSchoolId ?? 'global'}::${cls}::${arm.toUpperCase()}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          toInsert.push({
            schoolId: parsedSchoolId,
            classLevel: cls,
            armName: arm,
            displayName: `${cls} ${arm}`,
            isActive: true,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      await db.insert(classArms).values(toInsert);
      await logAdminActivity({
        adminId: req.admin!.id,
        adminLabel: req.admin!.username,
        action: 'BULK_CREATE_CLASS_ARMS',
        targetType: 'class_arm',
        targetDetails: `Generated ${toInsert.length} class & arm record(s)`,
      });
    }

    res.status(201).json({
      createdCount: toInsert.length,
      skippedCount: cleanClasses.length * cleanArms.length - toInsert.length,
    });
  } catch (error) {
    console.error('Bulk create class-arms error:', error);
    res.status(500).json({ error: 'Unable to generate classes and arms.' });
  }
});

router.put('/class-arms/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { schoolId, classLevel, armName, isActive } = req.body ?? {};
    const [existing] = await db
      .select()
      .from(classArms)
      .where(eq(classArms.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Class & Arm record not found.' });
    }

    const nextClass =
      typeof classLevel === 'string' && classLevel.trim()
        ? classLevel.trim().toUpperCase()
        : existing.classLevel;
    const nextArm =
      typeof armName === 'string' && armName.trim()
        ? armName.trim()
        : existing.armName;
    const nextSchoolId =
      schoolId !== undefined ? (schoolId ? Number(schoolId) : null) : existing.schoolId;

    const [updated] = await db
      .update(classArms)
      .set({
        schoolId: nextSchoolId,
        classLevel: nextClass,
        armName: nextArm,
        displayName: `${nextClass} ${nextArm}`,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      })
      .where(eq(classArms.id, id))
      .returning();

    res.json({ classArm: updated });
  } catch (error) {
    console.error('Update class-arm error:', error);
    res.status(500).json({ error: 'Unable to update class and arm.' });
  }
});

router.patch('/class-arms/:id/toggle', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(classArms)
      .where(eq(classArms.id, id))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Class & Arm record not found.' });
    }

    const [updated] = await db
      .update(classArms)
      .set({ isActive: !existing.isActive })
      .where(eq(classArms.id, id))
      .returning();

    res.json({ classArm: updated });
  } catch (error) {
    console.error('Toggle class-arm error:', error);
    res.status(500).json({ error: 'Unable to toggle class and arm status.' });
  }
});

router.delete('/class-arms/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(classArms).where(eq(classArms.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete class-arm error:', error);
    res.status(500).json({ error: 'Unable to delete class and arm.' });
  }
});

// 4. STUDENT MANAGEMENT
router.get('/students', async (req: AdminRequest, res) => {
  try {
    const schoolIdFilter = req.query.schoolId
      ? Number(req.query.schoolId)
      : null;
    const classLevelFilter =
      typeof req.query.classLevel === 'string' && req.query.classLevel.trim()
        ? req.query.classLevel.trim().toUpperCase()
        : null;
    const armFilter =
      typeof req.query.arm === 'string' && req.query.arm.trim()
        ? req.query.arm.trim().toUpperCase()
        : null;

    const conditions = [];
    if (schoolIdFilter) conditions.push(eq(students.schoolId, schoolIdFilter));
    if (classLevelFilter) conditions.push(eq(students.classLevel, classLevelFilter));

    await ensureSchoolColumns();
    const rows = await db
      .select({
        id: students.id,
        schoolId: students.schoolId,
        schoolName: schools.name,
        schoolCode: schools.code,
        schoolLogoUrl: schools.logoUrl,
        examNumber: students.examNumber,
        fullName: students.fullName,
        classLevel: students.classLevel,
        arm: students.arm,
        isActive: students.isActive,
        createdAt: students.createdAt,
      })
      .from(students)
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(students.createdAt));

    const filteredRows = armFilter
      ? rows.filter((r) => r.arm.trim().toUpperCase() === armFilter)
      : rows;

    res.json({ students: filteredRows });
  } catch (error) {
    console.error('Fetch students error:', error);
    res.status(500).json({ error: 'Failed to load students.' });
  }
});

function buildExamNumberPrefix(schoolCode?: string | null): string {
  const cleanCode = (schoolCode || 'JGT')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const code = cleanCode || 'JGT';
  const year = new Date().getFullYear();
  return `${code}-${year}-`;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getNextExamNumberSequence(prefix: string): Promise<number> {
  const existing = await db
    .select({ examNumber: students.examNumber })
    .from(students)
    .where(like(students.examNumber, `${prefix}%`));

  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, 'i');
  let maxSeq = 0;
  for (const row of existing) {
    const match = row.examNumber.trim().match(pattern);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  return maxSeq + 1;
}

function formatExamNumber(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

router.post('/students', async (req: AdminRequest, res) => {
  try {
    const { schoolId, examNumber, fullName, classLevel, arm, passcode } =
      req.body ?? {};
    if (
      !Number.isInteger(Number(schoolId)) ||
      typeof fullName !== 'string' ||
      !fullName.trim() ||
      typeof classLevel !== 'string' ||
      !classLevel.trim() ||
      typeof passcode !== 'string' ||
      passcode.trim().length < 4
    ) {
      return res.status(400).json({
        error:
          'School, Full Name, Class Level, and Passcode (min 4 characters) are required.',
      });
    }

    const numericSchoolId = Number(schoolId);
    const [school] = await db
      .select({ id: schools.id, code: schools.code })
      .from(schools)
      .where(eq(schools.id, numericSchoolId))
      .limit(1);

    if (!school) {
      return res.status(404).json({ error: 'Selected school was not found.' });
    }

    const cleanArm = typeof arm === 'string' ? arm.trim() : '';
    const manualExamNumber =
      typeof examNumber === 'string' ? examNumber.trim().toUpperCase() : '';

    let created: typeof students.$inferSelect | undefined;

    if (manualExamNumber) {
      [created] = await db
        .insert(students)
        .values({
          schoolId: numericSchoolId,
          examNumber: manualExamNumber,
          fullName: fullName.trim(),
          classLevel: classLevel.trim().toUpperCase(),
          arm: cleanArm,
          passcodeHash: hashPassword(passcode.trim()),
          isActive: true,
        })
        .returning();
    } else {
      const prefix = buildExamNumberPrefix(school.code);
      let nextSeq = await getNextExamNumberSequence(prefix);
      const passcodeHash = hashPassword(passcode.trim());

      for (let attempt = 0; attempt < 6; attempt++) {
        const candidateExamNumber = formatExamNumber(prefix, nextSeq + attempt);
        try {
          [created] = await db
            .insert(students)
            .values({
              schoolId: numericSchoolId,
              examNumber: candidateExamNumber,
              fullName: fullName.trim(),
              classLevel: classLevel.trim().toUpperCase(),
              arm: cleanArm,
              passcodeHash,
              isActive: true,
            })
            .returning();
          break;
        } catch (insertErr: unknown) {
          const pgErr = insertErr as { code?: string; cause?: { code?: string } };
          const code = pgErr?.code || pgErr?.cause?.code;
          if (code === '23505' && attempt < 5) {
            continue;
          }
          throw insertErr;
        }
      }
    }

    if (!created) {
      return res.status(500).json({
        error: 'Unable to generate a unique Examination Number. Please try again.',
      });
    }

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'REGISTER_STUDENT',
      targetType: 'student',
      targetDetails: `${created.fullName} (${created.examNumber})`,
    });

    res.status(201).json({
      student: {
        id: created.id,
        schoolId: created.schoolId,
        examNumber: created.examNumber,
        fullName: created.fullName,
        classLevel: created.classLevel,
        arm: created.arm,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    console.error('Register student error:', error);
    res.status(400).json({
      error:
        'Unable to register student. Ensure the Examination Number is unique.',
    });
  }
});

router.post('/students/import', async (req: AdminRequest, res) => {
  try {
    const { schoolId, csvText } = req.body ?? {};
    if (
      !Number.isInteger(Number(schoolId)) ||
      typeof csvText !== 'string' ||
      !csvText.trim()
    ) {
      return res
        .status(400)
        .json({ error: 'Target school and CSV data are required.' });
    }

    const numericSchoolId = Number(schoolId);
    const [school] = await db
      .select({ id: schools.id, code: schools.code })
      .from(schools)
      .where(eq(schools.id, numericSchoolId))
      .limit(1);

    if (!school) {
      return res.status(404).json({ error: 'Selected school was not found.' });
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      return res.status(400).json({
        error:
          'CSV must contain a header row (e.g. fullName,classLevel,arm,passcode) and at least one student row.',
      });
    }

    const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''));
    const examIdx = header.findIndex((h) =>
      ['examnumber', 'exam_number', 'examno'].includes(h)
    );
    const nameIdx = header.findIndex((h) =>
      ['fullname', 'full_name', 'name'].includes(h)
    );
    const classIdx = header.findIndex((h) =>
      ['classlevel', 'class_level', 'class'].includes(h)
    );
    const armIdx = header.findIndex((h) =>
      ['arm', 'classarm', 'class_arm', 'section'].includes(h)
    );
    const passIdx = header.findIndex((h) =>
      ['passcode', 'password', 'pin'].includes(h)
    );

    if (nameIdx === -1 || classIdx === -1 || passIdx === -1) {
      return res.status(400).json({
        error:
          'CSV header must include: fullName, classLevel, passcode (arm and examNumber are optional — exam numbers are generated automatically if omitted).',
      });
    }

    const prefix = buildExamNumberPrefix(school.code);
    let nextSeq = await getNextExamNumberSequence(prefix);
    const existingRows = await db
      .select({ examNumber: students.examNumber })
      .from(students);
    const usedExamNumbers = new Set(
      existingRows.map((r) => r.examNumber.trim().toUpperCase())
    );

    let imported = 0;
    let autoGeneratedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const providedExamNumber =
        examIdx >= 0 ? (cols[examIdx] ?? '').trim().toUpperCase() : '';
      const fullName = (cols[nameIdx] ?? '').trim();
      const classLevel = (cols[classIdx] ?? '').trim().toUpperCase();
      const arm = armIdx >= 0 ? (cols[armIdx] ?? '').trim() : '';
      const passcode = (cols[passIdx] ?? '').trim();

      if (!fullName || !classLevel || passcode.length < 4) {
        errors.push(`Row ${i + 1}: missing fields or passcode < 4 chars`);
        continue;
      }

      let finalExamNumber = providedExamNumber;
      let wasAutoGenerated = false;
      if (!finalExamNumber) {
        while (usedExamNumbers.has(formatExamNumber(prefix, nextSeq))) {
          nextSeq += 1;
        }
        finalExamNumber = formatExamNumber(prefix, nextSeq);
        nextSeq += 1;
        wasAutoGenerated = true;
      }

      if (usedExamNumbers.has(finalExamNumber)) {
        errors.push(`Row ${i + 1}: duplicate exam number ${finalExamNumber}`);
        continue;
      }

      try {
        await db.insert(students).values({
          schoolId: numericSchoolId,
          examNumber: finalExamNumber,
          fullName,
          classLevel,
          arm,
          passcodeHash: hashPassword(passcode),
          isActive: true,
        });
        usedExamNumbers.add(finalExamNumber);
        imported++;
        if (wasAutoGenerated) autoGeneratedCount++;
      } catch {
        errors.push(`Row ${i + 1}: duplicate or invalid exam number ${finalExamNumber}`);
      }
    }

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'IMPORT_STUDENTS',
      targetType: 'student',
      targetDetails: `Imported ${imported} student record(s) (${autoGeneratedCount} auto-generated exam numbers)`,
    });

    res.json({ imported, autoGeneratedCount, errors });
  } catch (error) {
    console.error('Import students error:', error);
    res.status(500).json({ error: 'Student CSV import failed.' });
  }
});

router.post('/students/bulk', async (req: AdminRequest, res) => {
  try {
    const { schoolId, items } = req.body ?? {};
    const numericSchoolId = Number(schoolId);

    if (
      !Number.isInteger(numericSchoolId) ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error:
          'Target school/organization and at least one student record are required.',
      });
    }

    if (items.length > 1000) {
      return res.status(400).json({
        error: 'Bulk student upload supports up to 1,000 students per batch.',
      });
    }

    const [school] = await db
      .select({ id: schools.id, code: schools.code, name: schools.name })
      .from(schools)
      .where(eq(schools.id, numericSchoolId))
      .limit(1);

    if (!school) {
      return res.status(404).json({ error: 'Selected school was not found.' });
    }

    const prefix = buildExamNumberPrefix(school.code);
    let nextSeq = await getNextExamNumberSequence(prefix);
    const existingRows = await db
      .select({ examNumber: students.examNumber })
      .from(students);
    const usedExamNumbers = new Set(
      existingRows.map((r) => r.examNumber.trim().toUpperCase())
    );

    const rowsToInsert: Array<{
      schoolId: number;
      examNumber: string;
      fullName: string;
      classLevel: string;
      arm: string;
      passcodeHash: string;
      isActive: boolean;
      plainPasscode: string;
      wasAutoGenerated: boolean;
    }> = [];
    const errors: string[] = [];

    items.forEach((rawItem: Record<string, unknown>, idx: number) => {
      const fullName = String(rawItem?.fullName ?? '').trim();
      const classLevel = String(rawItem?.classLevel ?? '')
        .trim()
        .toUpperCase();
      const arm = String(rawItem?.arm ?? '').trim();
      const passcode = String(rawItem?.passcode ?? '').trim();
      const providedExamNumber = String(rawItem?.examNumber ?? '')
        .trim()
        .toUpperCase();

      if (!fullName || !classLevel || passcode.length < 4) {
        errors.push(
          `Student #${idx + 1}: missing name/class or passcode under 4 characters`
        );
        return;
      }

      let finalExamNumber = providedExamNumber;
      let wasAutoGenerated = false;
      if (!finalExamNumber) {
        while (usedExamNumbers.has(formatExamNumber(prefix, nextSeq))) {
          nextSeq += 1;
        }
        finalExamNumber = formatExamNumber(prefix, nextSeq);
        nextSeq += 1;
        wasAutoGenerated = true;
      }

      if (usedExamNumbers.has(finalExamNumber)) {
        errors.push(
          `Student #${idx + 1} (${fullName}): duplicate exam number ${finalExamNumber}`
        );
        return;
      }

      usedExamNumbers.add(finalExamNumber);
      rowsToInsert.push({
        schoolId: numericSchoolId,
        examNumber: finalExamNumber,
        fullName: fullName.slice(0, 160),
        classLevel: classLevel.slice(0, 60),
        arm: arm.slice(0, 60),
        passcodeHash: hashPassword(passcode),
        isActive: true,
        plainPasscode: passcode,
        wasAutoGenerated,
      });
    });

    if (rowsToInsert.length === 0) {
      return res.status(400).json({
        error: 'No valid student records found to register.',
        errors,
      });
    }

    const createdStudents: Array<{
      id: number;
      examNumber: string;
      fullName: string;
      schoolName: string;
      classLevel: string;
      arm: string;
      passcode: string;
    }> = [];
    let autoGeneratedCount = 0;

    for (const row of rowsToInsert) {
      try {
        const [inserted] = await db
          .insert(students)
          .values({
            schoolId: row.schoolId,
            examNumber: row.examNumber,
            fullName: row.fullName,
            classLevel: row.classLevel,
            arm: row.arm,
            passcodeHash: row.passcodeHash,
            isActive: true,
          })
          .returning();

        if (inserted) {
          if (row.wasAutoGenerated) autoGeneratedCount += 1;
          createdStudents.push({
            id: inserted.id,
            examNumber: inserted.examNumber,
            fullName: inserted.fullName,
            schoolName: school.name,
            classLevel: inserted.classLevel,
            arm: inserted.arm,
            passcode: row.plainPasscode,
          });
        }
      } catch {
        errors.push(
          `Could not insert ${row.fullName} (${row.examNumber}): duplicate exam number`
        );
      }
    }

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'BULK_UPLOAD_STUDENTS',
      targetType: 'student',
      targetDetails: `Registered ${createdStudents.length} student(s) in ${school.name} (${autoGeneratedCount} auto-generated exam numbers)`,
    });

    res.status(201).json({
      imported: createdStudents.length,
      autoGeneratedCount,
      createdStudents,
      errors,
    });
  } catch (error) {
    console.error('Bulk upload students error:', error);
    res.status(500).json({ error: 'Bulk student upload failed.' });
  }
});

router.put('/students/:id', async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { schoolId, examNumber, fullName, classLevel, arm, passcode, isActive } =
      req.body ?? {};

    const updateData: Record<string, unknown> = {};
    if (Number.isInteger(Number(schoolId))) updateData.schoolId = Number(schoolId);
    if (typeof examNumber === 'string' && examNumber.trim())
      updateData.examNumber = examNumber.trim().toUpperCase();
    if (typeof fullName === 'string' && fullName.trim())
      updateData.fullName = fullName.trim();
    if (typeof classLevel === 'string' && classLevel.trim())
      updateData.classLevel = classLevel.trim().toUpperCase();
    if (typeof arm === 'string') updateData.arm = arm.trim();
    if (typeof passcode === 'string' && passcode.trim().length >= 4)
      updateData.passcodeHash = hashPassword(passcode.trim());
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const [updated] = await db
      .update(students)
      .set(updateData)
      .where(eq(students.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    invalidateStudentSessionsForStudent(id);
    res.json({
      student: {
        id: updated.id,
        schoolId: updated.schoolId,
        examNumber: updated.examNumber,
        fullName: updated.fullName,
        classLevel: updated.classLevel,
        arm: updated.arm,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Unable to update student.' });
  }
});

router.patch('/students/:id/toggle', async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(students)
      .where(eq(students.id, id))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const [updated] = await db
      .update(students)
      .set({ isActive: !existing.isActive })
      .where(eq(students.id, id))
      .returning();
    invalidateStudentSessionsForStudent(id);
    res.json({
      student: {
        id: updated.id,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error('Toggle student error:', error);
    res.status(500).json({ error: 'Unable to change student status.' });
  }
});

router.delete('/students/:id', async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(students).where(eq(students.id, id));
    invalidateStudentSessionsForStudent(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Unable to delete student.' });
  }
});

// 6. SUBJECTS & QUESTION MANAGEMENT
router.get('/subjects', async (_req: AdminRequest, res) => {
  try {
    const rows = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        description: subjects.description,
        questionCount: count(questions.id),
      })
      .from(subjects)
      .leftJoin(questions, eq(questions.subjectId, subjects.id))
      .groupBy(subjects.id)
      .orderBy(subjects.name);

    res.json({
      subjects: rows.map((r) => ({
        ...r,
        questionCount: Number(r.questionCount),
      })),
    });
  } catch (error) {
    console.error('Fetch subjects error:', error);
    res.status(500).json({ error: 'Failed to load subjects.' });
  }
});

router.post('/subjects', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const { name, code, description } = req.body ?? {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof code !== 'string' ||
      !code.trim()
    ) {
      return res
        .status(400)
        .json({ error: 'Subject name and code are required.' });
    }

    const [created] = await db
      .insert(subjects)
      .values({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: typeof description === 'string' ? description.trim() : '',
      })
      .returning();

    invalidateCbtExamCache();
    res.status(201).json({ subject: created });
  } catch (error) {
    console.error('Create subject error:', error);
    res
      .status(400)
      .json({ error: 'Subject name and code must be unique.' });
  }
});

router.delete('/subjects/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(subjects).where(eq(subjects.id, id));
    invalidateCbtExamCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Unable to delete subject.' });
  }
});

router.get('/questions', async (req: AdminRequest, res) => {
  try {
    await ensureQuestionColumns();
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const rows = await db
      .select({
        id: questions.id,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        topic: questions.topic,
        questionText: questions.questionText,
        imageUrl: questions.imageUrl,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        optionE: questions.optionE,
        correctOption: questions.correctOption,
        marks: questions.marks,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .where(subjectId ? eq(questions.subjectId, subjectId) : undefined)
      .orderBy(desc(questions.createdAt));

    res.json({ questions: rows });
  } catch (error) {
    console.error('Fetch questions error:', error);
    res.status(500).json({ error: 'Failed to load questions.' });
  }
});

router.post('/questions', async (req: AdminRequest, res) => {
  try {
    await ensureQuestionColumns();
    const {
      subjectId,
      topic,
      questionText,
      imageUrl,
      optionA,
      optionB,
      optionC,
      optionD,
      optionE,
      correctOption,
      marks,
    } = req.body ?? {};

    const normalizedCorrect = String(correctOption ?? '').toUpperCase();
    const cleanOptionE = typeof optionE === 'string' ? optionE.trim() : '';

    if (
      !Number.isInteger(Number(subjectId)) ||
      typeof questionText !== 'string' ||
      !questionText.trim() ||
      typeof optionA !== 'string' ||
      !optionA.trim() ||
      typeof optionB !== 'string' ||
      !optionB.trim() ||
      typeof optionC !== 'string' ||
      !optionC.trim() ||
      typeof optionD !== 'string' ||
      !optionD.trim() ||
      !['A', 'B', 'C', 'D', 'E'].includes(normalizedCorrect)
    ) {
      return res.status(400).json({
        error:
          'Subject, question text, options A–D (plus optional Option E), and a valid correct option (A–E) are required.',
      });
    }

    if (normalizedCorrect === 'E' && !cleanOptionE) {
      return res.status(400).json({
        error:
          'Option E text is required when Option E is selected as the correct answer.',
      });
    }

    const cleanImageUrl = sanitizeQuestionImageUrl(imageUrl);
    if (cleanImageUrl === null) {
      return res.status(400).json({
        error:
          'Invalid question diagram image. Upload a PNG/JPG/WebP/GIF/SVG image under 900KB or provide an http(s) URL.',
      });
    }

    const [created] = await db
      .insert(questions)
      .values({
        subjectId: Number(subjectId),
        topic: typeof topic === 'string' && topic.trim() ? topic.trim() : 'General',
        questionText: questionText.trim(),
        imageUrl: cleanImageUrl,
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        optionC: optionC.trim(),
        optionD: optionD.trim(),
        optionE: cleanOptionE,
        correctOption: normalizedCorrect,
        marks: Math.max(1, Number(marks) || 1),
      })
      .returning();

    invalidateCbtExamCache();
    res.status(201).json({ question: created });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Unable to save question.' });
  }
});

router.post('/questions/import', async (req: AdminRequest, res) => {
  try {
    await ensureQuestionColumns();
    const { subjectId, csvText } = req.body ?? {};
    if (
      !Number.isInteger(Number(subjectId)) ||
      typeof csvText !== 'string' ||
      !csvText.trim()
    ) {
      return res
        .status(400)
        .json({ error: 'Target subject and CSV content are required.' });
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      return res.status(400).json({
        error:
          'CSV must contain a header row (topic,questionText,optionA,optionB,optionC,optionD,optionE,correctOption,marks) and at least one question.',
      });
    }

    const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''));
    const idx = {
      topic: header.findIndex((h) => h === 'topic'),
      q: header.findIndex((h) =>
        ['questiontext', 'question_text', 'question'].includes(h)
      ),
      imageUrl: header.findIndex((h) =>
        ['imageurl', 'image_url', 'image', 'diagram', 'diagramurl'].includes(h)
      ),
      a: header.findIndex((h) => ['optiona', 'option_a', 'a'].includes(h)),
      b: header.findIndex((h) => ['optionb', 'option_b', 'b'].includes(h)),
      c: header.findIndex((h) => ['optionc', 'option_c', 'c'].includes(h)),
      d: header.findIndex((h) => ['optiond', 'option_d', 'd'].includes(h)),
      e: header.findIndex((h) => ['optione', 'option_e', 'e'].includes(h)),
      ans: header.findIndex((h) =>
        ['correctoption', 'correct_option', 'answer', 'correct'].includes(h)
      ),
      marks: header.findIndex((h) => ['marks', 'mark', 'score'].includes(h)),
    };

    if (
      idx.q === -1 ||
      idx.a === -1 ||
      idx.b === -1 ||
      idx.c === -1 ||
      idx.d === -1 ||
      idx.ans === -1
    ) {
      return res.status(400).json({
        error:
          'CSV header must include questionText, optionA, optionB, optionC, optionD (plus optional optionE), correctOption.',
      });
    }

    let imported = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const questionText = (cols[idx.q] ?? '').trim();
      const optionA = (cols[idx.a] ?? '').trim();
      const optionB = (cols[idx.b] ?? '').trim();
      const optionC = (cols[idx.c] ?? '').trim();
      const optionD = (cols[idx.d] ?? '').trim();
      const optionE = idx.e >= 0 ? (cols[idx.e] ?? '').trim() : '';
      const correctOption = (cols[idx.ans] ?? '').trim().toUpperCase();
      const topic = idx.topic >= 0 ? (cols[idx.topic] ?? '').trim() || 'General' : 'General';
      const marks = idx.marks >= 0 ? Math.max(1, Number(cols[idx.marks]) || 1) : 1;
      const rawImageUrl = idx.imageUrl >= 0 ? (cols[idx.imageUrl] ?? '').trim() : '';
      const cleanImageUrl = sanitizeQuestionImageUrl(rawImageUrl) ?? '';

      if (
        !questionText ||
        !optionA ||
        !optionB ||
        !optionC ||
        !optionD ||
        !['A', 'B', 'C', 'D', 'E'].includes(correctOption) ||
        (correctOption === 'E' && !optionE)
      ) {
        errors.push(`Row ${i + 1}: invalid question fields or answer key`);
        continue;
      }

      await db.insert(questions).values({
        subjectId: Number(subjectId),
        topic,
        questionText,
        imageUrl: cleanImageUrl,
        optionA,
        optionB,
        optionC,
        optionD,
        optionE,
        correctOption,
        marks,
      });
      imported++;
    }

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'IMPORT_QUESTIONS',
      targetType: 'question',
      targetDetails: `Imported ${imported} question(s)`,
    });

    invalidateCbtExamCache();
    res.json({ imported, errors });
  } catch (error) {
    console.error('Import questions error:', error);
    res.status(500).json({ error: 'Question CSV import failed.' });
  }
});

router.post('/questions/bulk', async (req: AdminRequest, res) => {
  try {
    await ensureQuestionColumns();
    const { subjectId, examId, items } = req.body ?? {};
    const targetSubjectId = Number(subjectId);

    if (!Number.isInteger(targetSubjectId) || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Target subject and at least one parsed question item are required.',
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        error: 'Bulk upload supports up to 500 questions per batch.',
      });
    }

    const [subjectRow] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, targetSubjectId))
      .limit(1);

    if (!subjectRow) {
      return res.status(404).json({ error: 'Selected subject not found.' });
    }

    let targetExamId: number | null = null;
    if (examId !== undefined && examId !== null && String(examId).trim() !== '') {
      const parsedExamId = Number(examId);
      if (!Number.isInteger(parsedExamId)) {
        return res.status(400).json({ error: 'Invalid target examination ID.' });
      }
      const [examRow] = await db
        .select()
        .from(examinations)
        .where(eq(examinations.id, parsedExamId))
        .limit(1);
      if (!examRow) {
        return res.status(404).json({ error: 'Selected examination not found.' });
      }
      if (examRow.subjectId !== targetSubjectId) {
        return res.status(400).json({
          error: 'Selected examination belongs to a different subject.',
        });
      }
      targetExamId = parsedExamId;
    }

    const validRows: Array<{
      subjectId: number;
      topic: string;
      questionText: string;
      imageUrl: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      optionE: string;
      correctOption: string;
      marks: number;
    }> = [];
    const errors: string[] = [];

    items.forEach((rawItem: Record<string, unknown>, index: number) => {
      const questionText = String(rawItem?.questionText ?? '').trim();
      const optionA = String(rawItem?.optionA ?? '').trim();
      const optionB = String(rawItem?.optionB ?? '').trim();
      const optionC = String(rawItem?.optionC ?? '').trim();
      const optionD = String(rawItem?.optionD ?? '').trim();
      const optionE = String(rawItem?.optionE ?? '').trim();
      const correctOption = String(rawItem?.correctOption ?? '')
        .trim()
        .toUpperCase();
      const topic = String(rawItem?.topic ?? '').trim() || 'General';
      const marks = Math.max(1, Math.min(100, Number(rawItem?.marks) || 1));
      const cleanImageUrl = sanitizeQuestionImageUrl(rawItem?.imageUrl);

      if (
        !questionText ||
        !optionA ||
        !optionB ||
        !optionC ||
        !optionD ||
        !['A', 'B', 'C', 'D', 'E'].includes(correctOption) ||
        (correctOption === 'E' && !optionE)
      ) {
        errors.push(`Item #${index + 1}: missing required options or invalid answer key`);
        return;
      }

      if (cleanImageUrl === null) {
        errors.push(`Item #${index + 1}: invalid or oversized diagram image`);
        return;
      }

      validRows.push({
        subjectId: targetSubjectId,
        topic: topic.slice(0, 120),
        questionText: questionText.slice(0, 4000),
        imageUrl: cleanImageUrl,
        optionA: optionA.slice(0, 1000),
        optionB: optionB.slice(0, 1000),
        optionC: optionC.slice(0, 1000),
        optionD: optionD.slice(0, 1000),
        optionE: optionE.slice(0, 1000),
        correctOption,
        marks,
      });
    });

    if (validRows.length === 0) {
      return res.status(400).json({
        error: 'No valid questions found in upload batch.',
        errors,
      });
    }

    const inserted = await db.insert(questions).values(validRows).returning();

    let attachedCount = 0;
    if (targetExamId && inserted.length > 0) {
      const existingLinks = await db
        .select({ sortOrder: examQuestions.sortOrder })
        .from(examQuestions)
        .where(eq(examQuestions.examId, targetExamId));
      const baseOrder = existingLinks.reduce(
        (max, row) => Math.max(max, row.sortOrder),
        0
      );

      await db.insert(examQuestions).values(
        inserted.map((q, idx) => ({
          examId: targetExamId!,
          questionId: q.id,
          sortOrder: baseOrder + idx + 1,
        }))
      );
      attachedCount = inserted.length;
    }

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'BULK_UPLOAD_QUESTIONS',
      targetType: 'question',
      targetDetails: `Uploaded ${inserted.length} question(s) into ${subjectRow.name}${
        attachedCount > 0 ? ` and attached to exam #${targetExamId}` : ''
      }`,
    });

    invalidateCbtExamCache(targetExamId ?? undefined);
    res.status(201).json({
      imported: inserted.length,
      attachedCount,
      errors,
    });
  } catch (error) {
    console.error('Bulk upload questions error:', error);
    res.status(500).json({ error: 'Bulk questions upload failed.' });
  }
});

router.put('/questions/:id', async (req: AdminRequest, res) => {
  try {
    await ensureQuestionColumns();
    const id = Number(req.params.id);
    const {
      subjectId,
      topic,
      questionText,
      imageUrl,
      optionA,
      optionB,
      optionC,
      optionD,
      optionE,
      correctOption,
      marks,
    } = req.body ?? {};

    let validatedImageUpdate: { imageUrl: string } | Record<string, never> = {};
    if (imageUrl !== undefined) {
      const cleanImageUrl = sanitizeQuestionImageUrl(imageUrl);
      if (cleanImageUrl === null) {
        return res.status(400).json({
          error:
            'Invalid question diagram image. Upload a PNG/JPG/WebP/GIF/SVG image under 900KB or provide an http(s) URL.',
        });
      }
      validatedImageUpdate = { imageUrl: cleanImageUrl };
    }

    const normalizedCorrect =
      typeof correctOption === 'string' &&
      ['A', 'B', 'C', 'D', 'E'].includes(correctOption.toUpperCase())
        ? correctOption.toUpperCase()
        : null;

    if (normalizedCorrect === 'E') {
      if (typeof optionE === 'string' && !optionE.trim()) {
        return res.status(400).json({
          error:
            'Option E text is required when Option E is selected as the correct answer.',
        });
      }
      if (optionE === undefined) {
        const [existingRow] = await db
          .select({ optionE: questions.optionE })
          .from(questions)
          .where(eq(questions.id, id))
          .limit(1);
        if (existingRow && !existingRow.optionE.trim()) {
          return res.status(400).json({
            error:
              'Option E text is required when Option E is selected as the correct answer.',
          });
        }
      }
    }

    const [updated] = await db
      .update(questions)
      .set({
        ...(Number.isInteger(Number(subjectId))
          ? { subjectId: Number(subjectId) }
          : {}),
        ...(typeof topic === 'string' ? { topic: topic.trim() || 'General' } : {}),
        ...(typeof questionText === 'string'
          ? { questionText: questionText.trim() }
          : {}),
        ...validatedImageUpdate,
        ...(typeof optionA === 'string' ? { optionA: optionA.trim() } : {}),
        ...(typeof optionB === 'string' ? { optionB: optionB.trim() } : {}),
        ...(typeof optionC === 'string' ? { optionC: optionC.trim() } : {}),
        ...(typeof optionD === 'string' ? { optionD: optionD.trim() } : {}),
        ...(typeof optionE === 'string' ? { optionE: optionE.trim() } : {}),
        ...(normalizedCorrect ? { correctOption: normalizedCorrect } : {}),
        ...(marks !== undefined ? { marks: Math.max(1, Number(marks) || 1) } : {}),
      })
      .where(eq(questions.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Question not found.' });
    }
    invalidateCbtExamCache();
    res.json({ question: updated });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Unable to update question.' });
  }
});

router.delete('/questions/:id', async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(questions).where(eq(questions.id, id));
    invalidateCbtExamCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Unable to delete question.' });
  }
});

// 5. EXAMINATION MANAGEMENT
router.get('/examinations', async (_req: AdminRequest, res) => {
  try {
    await ensureExamColumns();
    const exams = await db
      .select({
        id: examinations.id,
        title: examinations.title,
        subjectId: examinations.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        schoolId: examinations.schoolId,
        classLevel: examinations.classLevel,
        arm: examinations.arm,
        durationMinutes: examinations.durationMinutes,
        examDate: examinations.examDate,
        startTime: examinations.startTime,
        endTime: examinations.endTime,
        instructions: examinations.instructions,
        isActive: examinations.isActive,
        resultsPublished: examinations.resultsPublished,
        shuffleQuestions: examinations.shuffleQuestions,
        createdAt: examinations.createdAt,
      })
      .from(examinations)
      .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
      .orderBy(desc(examinations.createdAt));

    const examIds = exams.map((e) => e.id);
    const eqRows =
      examIds.length > 0
        ? await db
            .select()
            .from(examQuestions)
            .where(inArray(examQuestions.examId, examIds))
        : [];
    const attemptRows =
      examIds.length > 0
        ? await db
            .select()
            .from(examAttempts)
            .where(inArray(examAttempts.examId, examIds))
        : [];
    const assignRows =
      examIds.length > 0
        ? await db
            .select()
            .from(examAssignments)
            .where(inArray(examAssignments.examId, examIds))
        : [];

    await ensureSchoolColumns();
    const allSchools = await db.select().from(schools);
    const schoolMap = new Map(allSchools.map((s) => [s.id, s]));

    res.json({
      examinations: exams.map((e) => {
        const matchedSchool = e.schoolId ? schoolMap.get(e.schoolId) : undefined;
        return {
          ...e,
          schoolName: e.schoolId
            ? matchedSchool?.name || 'Specific School'
            : 'All Registered Schools',
          schoolLogoUrl: matchedSchool?.logoUrl || '',
          questionIds: eqRows
            .filter((q) => q.examId === e.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((q) => q.questionId),
          submissionCount: attemptRows.filter(
            (a) => a.examId === e.id && a.status === 'submitted'
          ).length,
          inProgressCount: attemptRows.filter(
            (a) => a.examId === e.id && a.status === 'in_progress'
          ).length,
          assignments: assignRows.filter((a) => a.examId === e.id),
        };
      }),
    });
  } catch (error) {
    console.error('Fetch examinations error:', error);
    res.status(500).json({ error: 'Failed to load examinations.' });
  }
});

router.post('/examinations', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    await ensureExamColumns();
    const {
      title,
      subjectId,
      schoolId,
      classLevel,
      arm,
      durationMinutes,
      examDate,
      startTime,
      endTime,
      instructions,
      questionIds,
      isActive,
      resultsPublished,
      shuffleQuestions,
    } = req.body ?? {};

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      !Number.isInteger(Number(subjectId)) ||
      typeof examDate !== 'string' ||
      !examDate.trim() ||
      typeof instructions !== 'string' ||
      !instructions.trim()
    ) {
      return res.status(400).json({
        error:
          'Examination title, subject, date, and instructions are required.',
      });
    }

    const [created] = await db
      .insert(examinations)
      .values({
        title: title.trim(),
        subjectId: Number(subjectId),
        schoolId: schoolId ? Number(schoolId) : null,
        classLevel:
          typeof classLevel === 'string' && classLevel.trim()
            ? classLevel.trim().toUpperCase()
            : 'ALL',
        arm:
          typeof arm === 'string' && arm.trim()
            ? arm.trim()
            : 'ALL',
        durationMinutes: Math.max(5, Number(durationMinutes) || 30),
        examDate: examDate.trim(),
        startTime:
          typeof startTime === 'string' && startTime.trim()
            ? startTime.trim()
            : '08:00',
        endTime:
          typeof endTime === 'string' && endTime.trim()
            ? endTime.trim()
            : '18:00',
        instructions: instructions.trim(),
        isActive: isActive !== false,
        resultsPublished: resultsPublished !== false,
        shuffleQuestions: Boolean(shuffleQuestions),
      })
      .returning();

    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const validIds = questionIds
        .map(Number)
        .filter((n) => Number.isInteger(n));
      if (validIds.length > 0) {
        await db.insert(examQuestions).values(
          validIds.map((qId, idx) => ({
            examId: created.id,
            questionId: qId,
            sortOrder: idx + 1,
          }))
        );
      }
    }

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'CREATE_EXAMINATION',
      targetType: 'examination',
      targetDetails: created.title,
    });

    invalidateCbtExamCache(created.id);
    res.status(201).json({ examination: created });
  } catch (error) {
    console.error('Create examination error:', error);
    res.status(500).json({ error: 'Unable to create examination.' });
  }
});

router.put('/examinations/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    await ensureExamColumns();
    const id = Number(req.params.id);
    const {
      title,
      subjectId,
      schoolId,
      classLevel,
      arm,
      durationMinutes,
      examDate,
      startTime,
      endTime,
      instructions,
      isActive,
      resultsPublished,
      shuffleQuestions,
      questionIds,
    } = req.body ?? {};

    const [updated] = await db
      .update(examinations)
      .set({
        ...(typeof title === 'string' ? { title: title.trim() } : {}),
        ...(Number.isInteger(Number(subjectId))
          ? { subjectId: Number(subjectId) }
          : {}),
        ...(schoolId !== undefined
          ? { schoolId: schoolId ? Number(schoolId) : null }
          : {}),
        ...(typeof classLevel === 'string'
          ? { classLevel: classLevel.trim().toUpperCase() || 'ALL' }
          : {}),
        ...(typeof arm === 'string'
          ? { arm: arm.trim() || 'ALL' }
          : {}),
        ...(durationMinutes !== undefined
          ? { durationMinutes: Math.max(5, Number(durationMinutes) || 30) }
          : {}),
        ...(typeof examDate === 'string' ? { examDate: examDate.trim() } : {}),
        ...(typeof startTime === 'string' ? { startTime: startTime.trim() } : {}),
        ...(typeof endTime === 'string' ? { endTime: endTime.trim() } : {}),
        ...(typeof instructions === 'string'
          ? { instructions: instructions.trim() }
          : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(typeof resultsPublished === 'boolean' ? { resultsPublished } : {}),
        ...(typeof shuffleQuestions === 'boolean' ? { shuffleQuestions } : {}),
      })
      .where(eq(examinations.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Examination not found.' });
    }

    if (Array.isArray(questionIds)) {
      await db.delete(examQuestions).where(eq(examQuestions.examId, id));
      const validIds = questionIds
        .map(Number)
        .filter((n) => Number.isInteger(n));
      if (validIds.length > 0) {
        await db.insert(examQuestions).values(
          validIds.map((qId, idx) => ({
            examId: id,
            questionId: qId,
            sortOrder: idx + 1,
          }))
        );
      }
    }

    invalidateCbtExamCache(id);
    res.json({ examination: updated });
  } catch (error) {
    console.error('Update examination error:', error);
    res.status(500).json({ error: 'Unable to update examination.' });
  }
});

router.patch('/examinations/:id/toggle', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(examinations)
      .where(eq(examinations.id, id))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Examination not found.' });
    }
    const [updated] = await db
      .update(examinations)
      .set({ isActive: !existing.isActive })
      .where(eq(examinations.id, id))
      .returning();
    invalidateCbtExamCache(id);
    res.json({ examination: updated });
  } catch (error) {
    console.error('Toggle examination error:', error);
    res.status(500).json({ error: 'Unable to update examination status.' });
  }
});

router.patch('/examinations/:id/shuffle', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    await ensureExamColumns();
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(examinations)
      .where(eq(examinations.id, id))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Examination not found.' });
    }
    const nextValue =
      typeof req.body?.shuffleQuestions === 'boolean'
        ? req.body.shuffleQuestions
        : !existing.shuffleQuestions;

    const [updated] = await db
      .update(examinations)
      .set({ shuffleQuestions: nextValue })
      .where(eq(examinations.id, id))
      .returning();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: nextValue ? 'ENABLE_EXAM_SHUFFLE' : 'DISABLE_EXAM_SHUFFLE',
      targetType: 'examination',
      targetDetails: updated.title,
    });

    invalidateCbtExamCache(id);
    res.json({ examination: updated });
  } catch (error) {
    console.error('Toggle exam shuffle error:', error);
    res.status(500).json({ error: 'Unable to update question shuffle setting.' });
  }
});

router.post('/examinations/:id/shuffle-order', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const examId = Number(req.params.id);
    const [existingExam] = await db
      .select()
      .from(examinations)
      .where(eq(examinations.id, examId))
      .limit(1);
    if (!existingExam) {
      return res.status(404).json({ error: 'Examination not found.' });
    }

    const attached = await db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.sortOrder), asc(examQuestions.id));

    if (attached.length < 2) {
      return res.status(400).json({
        error: 'Attach at least 2 questions before shuffling their master order.',
      });
    }

    const shuffled = [...attached];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    await db.delete(examQuestions).where(eq(examQuestions.examId, examId));
    await db.insert(examQuestions).values(
      shuffled.map((item, idx) => ({
        examId,
        questionId: item.questionId,
        sortOrder: idx + 1,
      }))
    );

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'SHUFFLE_EXAM_ORDER',
      targetType: 'examination',
      targetDetails: `${existingExam.title} (${shuffled.length} questions reordered)`,
    });

    invalidateCbtExamCache(examId);
    res.json({
      questionIds: shuffled.map((q) => q.questionId),
      count: shuffled.length,
    });
  } catch (error) {
    console.error('Shuffle exam order error:', error);
    res.status(500).json({ error: 'Unable to shuffle master question order.' });
  }
});

router.put('/examinations/:id/assignments', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const examId = Number(req.params.id);
    const { assignments } = req.body ?? {};
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: 'Assignments array is required.' });
    }

    await db.delete(examAssignments).where(eq(examAssignments.examId, examId));

    if (assignments.length > 0) {
      await db.insert(examAssignments).values(
        assignments.map((a: { schoolId?: number | null; classLevel?: string | null; arm?: string | null; studentId?: number | null }) => ({
          examId,
          schoolId: a.schoolId ? Number(a.schoolId) : null,
          classLevel: a.classLevel ? String(a.classLevel).toUpperCase() : null,
          arm: a.arm ? String(a.arm).trim() : null,
          studentId: a.studentId ? Number(a.studentId) : null,
        }))
      );
    }

    invalidateCbtExamCache(examId);
    res.json({ success: true });
  } catch (error) {
    console.error('Assign exam error:', error);
    res.status(500).json({ error: 'Unable to update assignments.' });
  }
});

router.get('/examinations/:id/submissions', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const examId = Number(req.params.id);
    await ensureSchoolColumns();
    const rows = await db
      .select({
        attemptId: examAttempts.id,
        studentName: students.fullName,
        examNumber: students.examNumber,
        classLevel: students.classLevel,
        arm: students.arm,
        schoolName: schools.name,
        schoolLogoUrl: schools.logoUrl,
        status: examAttempts.status,
        startedAt: examAttempts.startedAt,
        submittedAt: examAttempts.submittedAt,
        score: examAttempts.score,
        totalMarks: examAttempts.totalMarks,
        percentage: examAttempts.percentage,
        securityViolations: examAttempts.securityViolations,
        submissionReason: examAttempts.submissionReason,
      })
      .from(examAttempts)
      .innerJoin(students, eq(examAttempts.studentId, students.id))
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(eq(examAttempts.examId, examId))
      .orderBy(desc(examAttempts.startedAt));

    res.json({ submissions: rows });
  } catch (error) {
    console.error('Exam submissions error:', error);
    res.status(500).json({ error: 'Failed to load exam submissions.' });
  }
});

router.delete('/examinations/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(examinations).where(eq(examinations.id, id));
    invalidateCbtExamCache(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ error: 'Unable to delete examination.' });
  }
});

// 7. RESULTS MANAGEMENT
router.get('/results', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const schoolId = req.query.schoolId ? Number(req.query.schoolId) : null;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const examId = req.query.examId ? Number(req.query.examId) : null;
    const classLevel =
      typeof req.query.classLevel === 'string' && req.query.classLevel.trim()
        ? req.query.classLevel.trim().toUpperCase()
        : null;
    const arm =
      typeof req.query.arm === 'string' && req.query.arm.trim()
        ? req.query.arm.trim().toUpperCase()
        : null;

    const conditions = [eq(examAttempts.status, 'submitted')];
    if (schoolId) conditions.push(eq(students.schoolId, schoolId));
    if (subjectId) conditions.push(eq(examinations.subjectId, subjectId));
    if (examId) conditions.push(eq(examinations.id, examId));
    if (classLevel) conditions.push(eq(students.classLevel, classLevel));

    await ensureSchoolColumns();
    const rows = await db
      .select({
        attemptId: examAttempts.id,
        examId: examinations.id,
        examTitle: examinations.title,
        resultsPublished: examinations.resultsPublished,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        schoolId: schools.id,
        schoolName: schools.name,
        schoolLogoUrl: schools.logoUrl,
        studentId: students.id,
        examNumber: students.examNumber,
        studentName: students.fullName,
        classLevel: students.classLevel,
        arm: students.arm,
        score: examAttempts.score,
        totalMarks: examAttempts.totalMarks,
        correctCount: examAttempts.correctCount,
        totalQuestions: examAttempts.totalQuestions,
        percentage: examAttempts.percentage,
        securityViolations: examAttempts.securityViolations,
        submissionReason: examAttempts.submissionReason,
        submittedAt: examAttempts.submittedAt,
      })
      .from(examAttempts)
      .innerJoin(examinations, eq(examAttempts.examId, examinations.id))
      .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
      .innerJoin(students, eq(examAttempts.studentId, students.id))
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(and(...conditions))
      .orderBy(desc(examAttempts.submittedAt));

    const filteredRows = arm
      ? rows.filter((r) => r.arm.trim().toUpperCase() === arm)
      : rows;

    res.json({ results: filteredRows });
  } catch (error) {
    console.error('Results fetch error:', error);
    res.status(500).json({ error: 'Failed to load examination results.' });
  }
});

router.patch(
  '/examinations/:id/publish-results',
  requireSuperAdmin,
  async (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { published } = req.body ?? {};
      const [updated] = await db
        .update(examinations)
        .set({ resultsPublished: Boolean(published) })
        .where(eq(examinations.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Examination not found.' });
      }

      await logAdminActivity({
        adminId: req.admin!.id,
        adminLabel: req.admin!.username,
        action: updated.resultsPublished
          ? 'PUBLISH_RESULTS'
          : 'WITHHOLD_RESULTS',
        targetType: 'examination',
        targetDetails: updated.title,
      });

      invalidateCbtExamCache(id);
      res.json({ examination: updated });
    } catch (error) {
      console.error('Publish results toggle error:', error);
      res.status(500).json({ error: 'Unable to update result publication.' });
    }
  }
);

router.get('/results/export', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const examId = req.query.examId ? Number(req.query.examId) : null;
    const schoolId = req.query.schoolId ? Number(req.query.schoolId) : null;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const classLevel =
      typeof req.query.classLevel === 'string' && req.query.classLevel.trim()
        ? req.query.classLevel.trim().toUpperCase()
        : null;
    const arm =
      typeof req.query.arm === 'string' && req.query.arm.trim()
        ? req.query.arm.trim().toUpperCase()
        : null;

    const conditions = [eq(examAttempts.status, 'submitted')];
    if (examId) conditions.push(eq(examinations.id, examId));
    if (schoolId) conditions.push(eq(students.schoolId, schoolId));
    if (subjectId) conditions.push(eq(examinations.subjectId, subjectId));
    if (classLevel) conditions.push(eq(students.classLevel, classLevel));

    const rows = await db
      .select({
        examNumber: students.examNumber,
        studentName: students.fullName,
        schoolName: schools.name,
        classLevel: students.classLevel,
        arm: students.arm,
        examTitle: examinations.title,
        subjectName: subjects.name,
        score: examAttempts.score,
        totalMarks: examAttempts.totalMarks,
        correctCount: examAttempts.correctCount,
        totalQuestions: examAttempts.totalQuestions,
        percentage: examAttempts.percentage,
        securityViolations: examAttempts.securityViolations,
        submissionReason: examAttempts.submissionReason,
        submittedAt: examAttempts.submittedAt,
      })
      .from(examAttempts)
      .innerJoin(examinations, eq(examAttempts.examId, examinations.id))
      .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
      .innerJoin(students, eq(examAttempts.studentId, students.id))
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(and(...conditions))
      .orderBy(desc(examAttempts.submittedAt));

    const filteredRows = arm
      ? rows.filter((r) => r.arm.trim().toUpperCase() === arm)
      : rows;

    const headers = [
      'Exam Number',
      'Student Name',
      'School',
      'Class',
      'Arm',
      'Examination',
      'Subject',
      'Score',
      'Total Marks',
      'Correct Answers',
      'Total Questions',
      'Percentage (%)',
      'Security Warnings',
      'Submission Mode',
      'Submitted At',
    ];

    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...filteredRows.map((r) =>
        [
          r.examNumber,
          r.studentName,
          r.schoolName,
          r.classLevel,
          r.arm,
          r.examTitle,
          r.subjectName,
          r.score,
          r.totalMarks,
          r.correctCount,
          r.totalQuestions,
          r.percentage,
          r.securityViolations,
          r.submissionReason,
          r.submittedAt?.toISOString() ?? '',
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];

    const dateTag = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="jaiman_cbt_results_${dateTag}.csv"`
    );
    res.send(`\uFEFF${csvLines.join('\n')}`);
  } catch (error) {
    console.error('Export results error:', error);
    res.status(500).json({ error: 'Unable to export results.' });
  }
});

router.delete('/results/:attemptId', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const attemptId = Number(req.params.attemptId);
    await db.delete(examAttempts).where(eq(examAttempts.id, attemptId));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete attempt error:', error);
    res.status(500).json({ error: 'Unable to reset examination attempt.' });
  }
});

// 8. CONTACT ENQUIRIES
router.get('/enquiries', requireSuperAdmin, async (_req: AdminRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(contactEnquiries)
      .orderBy(desc(contactEnquiries.createdAt));
    res.json({ enquiries: rows });
  } catch (error) {
    console.error('Fetch enquiries error:', error);
    res.status(500).json({ error: 'Failed to load contact enquiries.' });
  }
});

router.patch('/enquiries/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { isRead, status, adminNotes } = req.body ?? {};
    const [updated] = await db
      .update(contactEnquiries)
      .set({
        ...(typeof isRead === 'boolean' ? { isRead } : {}),
        ...(typeof status === 'string' &&
        ['new', 'read', 'responded'].includes(status)
          ? { status }
          : {}),
        ...(typeof adminNotes === 'string' ? { adminNotes } : {}),
      })
      .where(eq(contactEnquiries.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }
    res.json({ enquiry: updated });
  } catch (error) {
    console.error('Update enquiry error:', error);
    res.status(500).json({ error: 'Unable to update enquiry.' });
  }
});

router.delete('/enquiries/:id', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(contactEnquiries).where(eq(contactEnquiries.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete enquiry error:', error);
    res.status(500).json({ error: 'Unable to delete enquiry.' });
  }
});

// 9. ADMIN ACCOUNTS MANAGEMENT (Super Admin Only)
router.get('/admins', requireSuperAdmin, async (_req: AdminRequest, res) => {
  try {
    const rows = await db
      .select({
        id: admins.id,
        username: admins.username,
        email: admins.email,
        fullName: admins.fullName,
        role: admins.role,
        isActive: admins.isActive,
        mustChangePassword: admins.mustChangePassword,
        createdAt: admins.createdAt,
      })
      .from(admins)
      .orderBy(asc(admins.id));

    res.json({
      admins: rows.map((row) => ({
        ...row,
        role: normalizeAdminRole(row.role),
      })),
    });
  } catch (error) {
    console.error('Fetch admins error:', error);
    res.status(500).json({ error: 'Failed to load administrator accounts.' });
  }
});

router.post('/admins', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    const { fullName, username, email, password, role, mustChangePassword } =
      req.body ?? {};

    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof username !== 'string' ||
      username.trim().length < 3 ||
      typeof email !== 'string' ||
      !isValidEmail(email) ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        error:
          'Provide full name (min 2 chars), username (min 3 chars), valid email, and password (min 8 characters).',
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
      return res.status(400).json({
        error:
          'Username may only contain letters, numbers, dots, underscores, or hyphens.',
      });
    }

    const assignedRole =
      role === 'super_admin' ? 'super_admin' : 'data_entry';

    const [created] = await db
      .insert(admins)
      .values({
        fullName: fullName.trim(),
        username: cleanUsername,
        email: email.trim().toLowerCase(),
        role: assignedRole,
        isActive: true,
        passwordHash: hashPassword(password),
        mustChangePassword: Boolean(mustChangePassword),
      })
      .returning();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'CREATE_ADMIN_ACCOUNT',
      targetType: 'admin',
      targetDetails: `Registered ${created.username} (${assignedRole === 'data_entry' ? 'Students & Questions Only' : 'Full Administrator'})`,
    });

    res.status(201).json({
      admin: {
        id: created.id,
        username: created.username,
        email: created.email,
        fullName: created.fullName,
        role: normalizeAdminRole(created.role),
        isActive: created.isActive,
        mustChangePassword: created.mustChangePassword,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    console.error('Register sub-admin error:', error);
    res.status(400).json({
      error: 'Unable to register administrator. Username may already be in use.',
    });
  }
});

router.patch(
  '/admins/:id/toggle',
  requireSuperAdmin,
  async (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid administrator ID.' });
      }
      if (id === req.admin!.id) {
        return res
          .status(400)
          .json({ error: 'You cannot deactivate your own active account.' });
      }

      const [existing] = await db
        .select()
        .from(admins)
        .where(eq(admins.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'Administrator account not found.' });
      }

      const nextActive = !existing.isActive;
      const [updated] = await db
        .update(admins)
        .set({ isActive: nextActive, updatedAt: new Date() })
        .where(eq(admins.id, id))
        .returning();

      if (!nextActive) {
        await db
          .update(adminSessions)
          .set({ revokedAt: new Date() })
          .where(eq(adminSessions.adminId, id));
      }

      await logAdminActivity({
        adminId: req.admin!.id,
        adminLabel: req.admin!.username,
        action: nextActive ? 'ACTIVATE_ADMIN' : 'DEACTIVATE_ADMIN',
        targetType: 'admin',
        targetDetails: `${updated.username}`,
      });

      res.json({
        admin: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
          fullName: updated.fullName,
          role: normalizeAdminRole(updated.role),
          isActive: updated.isActive,
          mustChangePassword: updated.mustChangePassword,
          createdAt: updated.createdAt,
        },
      });
    } catch (error) {
      console.error('Toggle admin status error:', error);
      res.status(500).json({ error: 'Unable to update administrator status.' });
    }
  }
);

router.patch(
  '/admins/:id/role',
  requireSuperAdmin,
  async (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { role } = req.body ?? {};
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid administrator ID.' });
      }
      if (id === req.admin!.id) {
        return res
          .status(400)
          .json({ error: 'You cannot change your own administrator role.' });
      }
      if (role !== 'super_admin' && role !== 'data_entry') {
        return res.status(400).json({ error: 'Invalid administrator role.' });
      }

      const [updated] = await db
        .update(admins)
        .set({ role, updatedAt: new Date() })
        .where(eq(admins.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Administrator account not found.' });
      }

      await logAdminActivity({
        adminId: req.admin!.id,
        adminLabel: req.admin!.username,
        action: 'UPDATE_ADMIN_ROLE',
        targetType: 'admin',
        targetDetails: `${updated.username} role set to ${role}`,
      });

      res.json({
        admin: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
          fullName: updated.fullName,
          role: normalizeAdminRole(updated.role),
          isActive: updated.isActive,
          mustChangePassword: updated.mustChangePassword,
          createdAt: updated.createdAt,
        },
      });
    } catch (error) {
      console.error('Update admin role error:', error);
      res.status(500).json({ error: 'Unable to update administrator role.' });
    }
  }
);

router.delete(
  '/admins/:id',
  requireSuperAdmin,
  async (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid administrator ID.' });
      }
      if (id === req.admin!.id) {
        return res
          .status(400)
          .json({ error: 'You cannot delete your own active account.' });
      }

      const [deleted] = await db
        .delete(admins)
        .where(eq(admins.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Administrator account not found.' });
      }

      await logAdminActivity({
        adminId: req.admin!.id,
        adminLabel: req.admin!.username,
        action: 'DELETE_ADMIN_ACCOUNT',
        targetType: 'admin',
        targetDetails: `Removed administrator ${deleted.username}`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete admin error:', error);
      res.status(500).json({ error: 'Unable to remove administrator account.' });
    }
  }
);

// 10. ADMIN PROFILE & ACTIVITY LOGS
router.put('/profile', async (req: AdminRequest, res) => {
  try {
    const { fullName, email, username } = req.body ?? {};
    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof email !== 'string' ||
      !isValidEmail(email) ||
      typeof username !== 'string' ||
      username.trim().length < 3
    ) {
      return res.status(400).json({
        error: 'Valid full name, email address, and username are required.',
      });
    }

    const [updated] = await db
      .update(admins)
      .set({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(admins.id, req.admin!.id))
      .returning();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: updated.username,
      action: 'UPDATE_PROFILE',
      targetType: 'admin',
      targetDetails: `Updated administrator profile (${updated.email})`,
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
    console.error('Update admin profile error:', error);
    res.status(400).json({
      error: 'Unable to update profile. Username may already be in use.',
    });
  }
});

router.get('/activity-logs', requireSuperAdmin, async (_req: AdminRequest, res) => {
  try {
    const logs = await db
      .select()
      .from(adminActivityLogs)
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(50);
    res.json({ logs });
  } catch (error) {
    console.error('Fetch activity logs error:', error);
    res.status(500).json({ error: 'Failed to load activity logs.' });
  }
});

// 11. DATABASE & SUPABASE STATUS
router.get('/database-status', requireSuperAdmin, async (_req: AdminRequest, res) => {
  try {
    const dbUrl = getDatabaseUrl();
    const isSupabaseUrl =
      dbUrl.includes('supabase.co') || dbUrl.includes('pooler.supabase.com');

    const activeDriver = dbUrl
      ? isSupabaseUrl
        ? 'supabase_postgres'
        : 'postgres_url'
      : process.env.SQL_HOST?.trim()
        ? 'cloud_sql'
        : 'unconfigured';

    let postgresConnected = false;
    let counts = {
      admins: 0,
      schools: 0,
      classArms: 0,
      students: 0,
      subjects: 0,
      questions: 0,
      examinations: 0,
      enquiries: 0,
    };

    if (isDatabaseConfigured()) {
      try {
        await db.execute(sql`SELECT 1`);
        await ensureAllSchemaColumns();
        postgresConnected = true;
        const [
          [{ value: adminCount }],
          [{ value: schoolCount }],
          [{ value: classArmCount }],
          [{ value: studentCount }],
          [{ value: subjectCount }],
          [{ value: questionCount }],
          [{ value: examCount }],
          [{ value: enquiryCount }],
        ] = await Promise.all([
          db.select({ value: count() }).from(admins),
          db.select({ value: count() }).from(schools),
          db.select({ value: count() }).from(classArms),
          db.select({ value: count() }).from(students),
          db.select({ value: count() }).from(subjects),
          db.select({ value: count() }).from(questions),
          db.select({ value: count() }).from(examinations),
          db.select({ value: count() }).from(contactEnquiries),
        ]);
        counts = {
          admins: Number(adminCount),
          schools: Number(schoolCount),
          classArms: Number(classArmCount),
          students: Number(studentCount),
          subjects: Number(subjectCount),
          questions: Number(questionCount),
          examinations: Number(examCount),
          enquiries: Number(enquiryCount),
        };
      } catch (dbErr) {
        console.error('Database status check failed:', dbErr);
      }
    }

    let supabaseProjectHost: string | null = null;
    const rawSupabaseUrl = process.env.SUPABASE_URL?.trim();
    if (rawSupabaseUrl) {
      try {
        const parsed = new URL(
          /^https?:\/\//i.test(rawSupabaseUrl)
            ? rawSupabaseUrl
            : `https://${rawSupabaseUrl}`
        );
        supabaseProjectHost = parsed.hostname;
      } catch {
        supabaseProjectHost = null;
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    let supabaseRestReachable = false;
    let supabaseTablesReady = false;
    let supabaseError: string | null = null;

    if (supabaseAdmin) {
      try {
        const { error: sbErr } = await supabaseAdmin
          .from('site_settings')
          .select('section_key')
          .limit(1);
        if (!sbErr) {
          supabaseRestReachable = true;
          supabaseTablesReady = true;
        } else {
          supabaseError = sbErr.message;
          // If PostgREST returned a relation/schema error, REST endpoint is reachable even if SQL tables aren't created yet
          if (
            sbErr.message.includes('relation') ||
            sbErr.message.includes('schema cache') ||
            sbErr.code === '42P01' ||
            sbErr.code === 'PGRST205'
          ) {
            supabaseRestReachable = true;
          }
        }
      } catch (err) {
        supabaseError =
          err instanceof Error ? err.message : 'Unable to reach Supabase API.';
      }
    }

    res.json({
      activeDriver,
      postgresConnected,
      supabaseSdkConfigured: Boolean(supabaseAdmin),
      supabaseProjectHost,
      supabaseRestReachable,
      supabaseTablesReady,
      supabaseError,
      counts,
      envChecklist: {
        hasDatabaseUrl: Boolean(dbUrl),
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
        hasSupabaseServiceRoleKey: Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        ),
        hasAdminInitialPassword: Boolean(
          process.env.ADMIN_INITIAL_PASSWORD?.trim()
        ),
        hasEmailSmtp: Boolean(
          process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()
        ),
        hasEmailResend: Boolean(process.env.RESEND_API_KEY?.trim()),
      },
    });
  } catch (error) {
    console.error('Database status route error:', error);
    res.status(500).json({ error: 'Unable to check database status.' });
  }
});

router.post('/database-sync', requireSuperAdmin, async (req: AdminRequest, res) => {
  try {
    if (!isDatabaseConfigured()) {
      return res.status(503).json({
        error:
          'No database connection configured. Add DATABASE_URL in your hosting Environment Variables first.',
      });
    }

    await syncSeedData();

    await logAdminActivity({
      adminId: req.admin!.id,
      adminLabel: req.admin!.username,
      action: 'DATABASE_SYNC',
      targetType: 'system',
      targetDetails: 'Verified database connection and synced default site & CBT data',
    });

    res.json({
      success: true,
      message:
        'Database connection verified and default website settings, classes, arms, and sample CBT records synced.',
    });
  } catch (error) {
    console.error('Database sync error:', error);
    res.status(500).json({ error: 'Database synchronization failed.' });
  }
});

export default router;
