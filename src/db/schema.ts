import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Administrator accounts
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('super_admin'), // 'super_admin' | 'data_entry'
  isActive: boolean('is_active').notNull().default(true),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Active and historical admin sessions
export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .references(() => admins.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  authMethod: text('auth_method').notNull().default('password'),
  ipAddress: text('ip_address').notNull().default('unknown'),
  userAgent: text('user_agent').notNull().default('unknown'),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Login attempt rate limiting
export const loginAttempts = pgTable('login_attempts', {
  id: serial('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  failedCount: integer('failed_count').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
});

// Administrative activity logs
export const adminActivityLogs = pgTable('admin_activity_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
  adminLabel: text('admin_label').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetDetails: text('target_details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// CMS & Website Settings stored as structured JSON sections
export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  sectionKey: text('section_key').notNull().unique(),
  content: jsonb('content').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Website announcements
export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  targetPage: text('target_page').notNull().default('all'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Registered Nigerian secondary schools
export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  state: text('state').notNull(),
  lga: text('lga').notNull().default(''),
  contactPerson: text('contact_person').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  accessCode: text('access_code').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// School Classes and Arms (e.g., JSS1 A, SS2 Science)
export const classArms = pgTable('class_arms', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id, {
    onDelete: 'cascade',
  }),
  classLevel: text('class_level').notNull(),
  armName: text('arm_name').notNull(),
  displayName: text('display_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Registered secondary school students
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  examNumber: text('exam_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  classLevel: text('class_level').notNull(),
  arm: text('arm').notNull().default(''),
  passcodeHash: text('passcode_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Student CBT sessions
export const studentSessions = pgTable('student_sessions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id')
    .references(() => students.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Examination subjects
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Multiple-choice question bank
export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  topic: text('topic').notNull().default('General'),
  questionText: text('question_text').notNull(),
  imageUrl: text('image_url').notNull().default(''),
  optionA: text('option_a').notNull(),
  optionB: text('option_b').notNull(),
  optionC: text('option_c').notNull(),
  optionD: text('option_d').notNull(),
  correctOption: text('correct_option').notNull(), // 'A' | 'B' | 'C' | 'D'
  marks: integer('marks').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Examinations
export const examinations = pgTable('examinations', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  schoolId: integer('school_id').references(() => schools.id, {
    onDelete: 'set null',
  }),
  classLevel: text('class_level').notNull().default('ALL'),
  arm: text('arm').notNull().default('ALL'),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  examDate: text('exam_date').notNull(),
  startTime: text('start_time').notNull().default('08:00'),
  endTime: text('end_time').notNull().default('18:00'),
  instructions: text('instructions').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  resultsPublished: boolean('results_published').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Join table: Questions attached to an examination
export const examQuestions = pgTable(
  'exam_questions',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id')
      .references(() => examinations.id, { onDelete: 'cascade' })
      .notNull(),
    questionId: integer('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    sortOrder: integer('sort_order').notNull().default(1),
  },
  (table) => [
    uniqueIndex('exam_questions_exam_question_idx').on(
      table.examId,
      table.questionId
    ),
  ]
);

// Specific assignments (optional targeting by school, classLevel, or individual student)
export const examAssignments = pgTable('exam_assignments', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => examinations.id, { onDelete: 'cascade' })
    .notNull(),
  schoolId: integer('school_id').references(() => schools.id, {
    onDelete: 'cascade',
  }),
  classLevel: text('class_level'),
  arm: text('arm'),
  studentId: integer('student_id').references(() => students.id, {
    onDelete: 'cascade',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Student examination attempts & calculated results
export const examAttempts = pgTable(
  'exam_attempts',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id')
      .references(() => examinations.id, { onDelete: 'cascade' })
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull().default('in_progress'), // 'in_progress' | 'submitted'
    startedAt: timestamp('started_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    submittedAt: timestamp('submitted_at'),
    score: integer('score').notNull().default(0),
    totalMarks: integer('total_marks').notNull().default(0),
    correctCount: integer('correct_count').notNull().default(0),
    totalQuestions: integer('total_questions').notNull().default(0),
    percentage: integer('percentage').notNull().default(0),
    securityViolations: integer('security_violations').notNull().default(0),
    submissionReason: text('submission_reason').notNull().default('manual'),
  },
  (table) => [
    uniqueIndex('exam_attempts_exam_student_idx').on(
      table.examId,
      table.studentId
    ),
  ]
);

// Individual saved answers per attempt
export const studentAnswers = pgTable(
  'student_answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .references(() => examAttempts.id, { onDelete: 'cascade' })
      .notNull(),
    questionId: integer('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    selectedOption: text('selected_option'), // 'A' | 'B' | 'C' | 'D' | null
    isCorrect: boolean('is_correct').notNull().default(false),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('student_answers_attempt_question_idx').on(
      table.attemptId,
      table.questionId
    ),
  ]
);

// Contact enquiries submitted from /contact
export const contactEnquiries = pgTable('contact_enquiries', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  organizationName: text('organization_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  status: text('status').notNull().default('new'), // 'new' | 'read' | 'responded'
  adminNotes: text('admin_notes').notNull().default(''),
  ipAddress: text('ip_address').notNull().default('unknown'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  students: many(students),
  examinations: many(examinations),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  attempts: many(examAttempts),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  questions: many(questions),
  examinations: many(examinations),
}));

export const examinationsRelations = relations(examinations, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [examinations.subjectId],
    references: [subjects.id],
  }),
  school: one(schools, {
    fields: [examinations.schoolId],
    references: [schools.id],
  }),
  examQuestions: many(examQuestions),
  attempts: many(examAttempts),
}));
