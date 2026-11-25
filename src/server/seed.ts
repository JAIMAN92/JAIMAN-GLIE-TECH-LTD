import { count } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  classArms,
  examinations,
  examQuestions,
  questions,
  siteSettings,
  subjects,
} from '../db/schema.ts';
import {
  DEFAULT_ABOUT,
  DEFAULT_BRANDING,
  DEFAULT_CONTACT,
  DEFAULT_HOMEPAGE,
  DEFAULT_NAVIGATION,
  DEFAULT_VISION,
} from '../shared/defaults.ts';

let seededPromise: Promise<void> | null = null;

async function runSeed() {
  try {
    const defaultSections: Array<{ key: string; content: unknown }> = [
      { key: 'homepage', content: DEFAULT_HOMEPAGE },
      { key: 'about', content: DEFAULT_ABOUT },
      { key: 'vision', content: DEFAULT_VISION },
      { key: 'branding', content: DEFAULT_BRANDING },
      { key: 'contact', content: DEFAULT_CONTACT },
      { key: 'navigation', content: DEFAULT_NAVIGATION },
    ];

    for (const sec of defaultSections) {
      await db
        .insert(siteSettings)
        .values({
          sectionKey: sec.key,
          content: sec.content,
        })
        .onConflictDoNothing({ target: siteSettings.sectionKey });
    }

    const [{ value: classArmCount }] = await db
      .select({ value: count() })
      .from(classArms);

    if (Number(classArmCount) === 0) {
      const juniorClasses = ['JSS1', 'JSS2', 'JSS3'];
      const juniorArms = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const seniorClasses = ['SS1', 'SS2', 'SS3'];
      const seniorArms = [
        'Class 1',
        'Class 2',
        'Class 3',
        'Class 4',
        'Class 5',
        'Class 6',
        'Art',
      ];

      const defaultClassArms: Array<{
        schoolId: number | null;
        classLevel: string;
        armName: string;
        displayName: string;
        isActive: boolean;
      }> = [];

      for (const cls of juniorClasses) {
        for (const arm of juniorArms) {
          defaultClassArms.push({
            schoolId: null,
            classLevel: cls,
            armName: arm,
            displayName: `${cls} ${arm}`,
            isActive: true,
          });
        }
      }

      for (const cls of seniorClasses) {
        for (const arm of seniorArms) {
          defaultClassArms.push({
            schoolId: null,
            classLevel: cls,
            armName: arm,
            displayName: `${cls} ${arm}`,
            isActive: true,
          });
        }
      }

      await db.insert(classArms).values(defaultClassArms);
    }

    const [{ value: subjectCount }] = await db
      .select({ value: count() })
      .from(subjects);

    if (Number(subjectCount) === 0) {
      const insertedSubjects = await db
        .insert(subjects)
        .values([
          {
            name: 'Mathematics',
            code: 'MTH',
            description: 'General Secondary School Mathematics',
          },
          {
            name: 'English Language',
            code: 'ENG',
            description: 'Use of English and Comprehension',
          },
          {
            name: 'Civic Education',
            code: 'CIV',
            description: 'Nigerian Civic Values and Citizenship',
          },
          {
            name: 'Computer Studies',
            code: 'CSC',
            description: 'Fundamentals of Computing and ICT',
          },
        ])
        .returning();

      const math = insertedSubjects.find((s) => s.code === 'MTH');
      const eng = insertedSubjects.find((s) => s.code === 'ENG');
      const csc = insertedSubjects.find((s) => s.code === 'CSC');

      if (math) {
        const mathQuestions = await db
          .insert(questions)
          .values([
            {
              subjectId: math.id,
              topic: 'Algebra',
              questionText: 'Solve for x in the linear equation: 3x + 7 = 22.',
              optionA: '3',
              optionB: '5',
              optionC: '7',
              optionD: '15',
              correctOption: 'B',
              marks: 2,
            },
            {
              subjectId: math.id,
              topic: 'Number & Numeration',
              questionText: 'Express 0.045 as a percentage.',
              optionA: '0.45%',
              optionB: '4.5%',
              optionC: '45%',
              optionD: '450%',
              correctOption: 'B',
              marks: 2,
            },
            {
              subjectId: math.id,
              topic: 'Geometry',
              questionText:
                'What is the sum of the interior angles of a triangle?',
              optionA: '90 degrees',
              optionB: '180 degrees',
              optionC: '270 degrees',
              optionD: '360 degrees',
              correctOption: 'B',
              marks: 2,
            },
            {
              subjectId: math.id,
              topic: 'Indices',
              questionText: 'Evaluate 2^4 multiplied by 2^2.',
              optionA: '16',
              optionB: '32',
              optionC: '64',
              optionD: '128',
              correctOption: 'C',
              marks: 2,
            },
            {
              subjectId: math.id,
              topic: 'Mensuration',
              questionText:
                'Find the perimeter of a rectangle with length 12 cm and width 5 cm.',
              optionA: '17 cm',
              optionB: '34 cm',
              optionC: '60 cm',
              optionD: '24 cm',
              correctOption: 'B',
              marks: 2,
            },
          ])
          .returning();

        const today = new Date().toISOString().slice(0, 10);
        const [sampleExam] = await db
          .insert(examinations)
          .values({
            title: 'SS1–SS3 Mathematics Readiness Assessment',
            subjectId: math.id,
            schoolId: null,
            classLevel: 'ALL',
            arm: 'ALL',
            durationMinutes: 20,
            examDate: today,
            startTime: '00:00',
            endTime: '23:59',
            instructions:
              'Read each question carefully before selecting an option (A, B, C, or D). Your answers are saved automatically. Do not refresh or close the browser tab until you click Submit Examination.',
            isActive: true,
            resultsPublished: true,
          })
          .returning();

        if (sampleExam && mathQuestions.length > 0) {
          await db.insert(examQuestions).values(
            mathQuestions.map((q, index) => ({
              examId: sampleExam.id,
              questionId: q.id,
              sortOrder: index + 1,
            }))
          );
        }
      }

      if (eng) {
        await db.insert(questions).values([
          {
            subjectId: eng.id,
            topic: 'Lexis and Structure',
            questionText:
              'Choose the word that is nearest in meaning to "diligent":',
            optionA: 'Careless',
            optionB: 'Hardworking',
            optionC: 'Reluctant',
            optionD: 'Brief',
            correctOption: 'B',
            marks: 1,
          },
          {
            subjectId: eng.id,
            topic: 'Grammar',
            questionText:
              'Neither the principal nor the teachers _____ present at the briefing.',
            optionA: 'was',
            optionB: 'were',
            optionC: 'is',
            optionD: 'has been',
            correctOption: 'B',
            marks: 1,
          },
        ]);
      }

      if (csc) {
        await db.insert(questions).values([
          {
            subjectId: csc.id,
            topic: 'Computer Hardware',
            questionText:
              'Which component is considered the primary processing unit of a computer system?',
            optionA: 'RAM',
            optionB: 'CPU',
            optionC: 'Hard Disk Drive',
            optionD: 'Monitor',
            correctOption: 'B',
            marks: 1,
          },
          {
            subjectId: csc.id,
            topic: 'Data Representation',
            questionText: 'How many bits make one byte?',
            optionA: '4 bits',
            optionB: '8 bits',
            optionC: '16 bits',
            optionD: '32 bits',
            correctOption: 'B',
            marks: 1,
          },
        ]);
      }
    }
  } catch (err) {
    // Allow retry on subsequent request if database wasn't ready
    seededPromise = null;
    console.error('Seed initialization warning:', err);
  }
}

export async function ensureSeeded(): Promise<void> {
  if (!seededPromise) {
    seededPromise = runSeed();
  }
  return seededPromise;
}

export async function syncSeedData(): Promise<void> {
  seededPromise = runSeed();
  return seededPromise;
}
