export interface ParsedBulkStudent {
  id: string;
  fullName: string;
  examNumber: string;
  classLevel: string;
  arm: string;
  passcode: string;
}

export interface StudentBulkParseError {
  itemLabel: string;
  reason: string;
}

export interface StudentBulkParseResult {
  students: ParsedBulkStudent[];
  errors: StudentBulkParseError[];
}

export interface StudentBulkDefaults {
  classLevel?: string;
  arm?: string;
  passcode?: string;
}

function parseDelimiterSeparatedRows(
  rawText: string,
  delimiter: ',' | '\t' | ';'
): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const normalized = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function parseStudentCsvOrTsvText(rawText: string): string[][] {
  const firstLine =
    rawText
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0) || '';

  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter: ',' | '\t' | ';' = ',';
  if (tabCount >= 1 && tabCount >= commaCount) {
    delimiter = '\t';
  } else if (semiCount >= 1 && commaCount === 0) {
    delimiter = ';';
  }

  return parseDelimiterSeparatedRows(rawText, delimiter);
}

export function parseStudentSpreadsheetRows(
  rows: Array<Array<string | number | boolean | null | undefined>>,
  defaults?: StudentBulkDefaults
): StudentBulkParseResult {
  const defaultClassLevel = (defaults?.classLevel || 'SS1').trim().toUpperCase();
  const defaultArm = (defaults?.arm ?? '').trim();
  const defaultPasscode = (defaults?.passcode ?? '').trim();

  const stringRows = rows
    .map((r) => r.map((cell) => String(cell ?? '').trim()))
    .filter((r) => r.some((cell) => cell !== ''));

  if (stringRows.length < 2) {
    return {
      students: [],
      errors: [
        {
          itemLabel: 'File / Sheet',
          reason:
            'Include a header row (e.g. fullName, classLevel, arm, passcode) and at least one student row.',
        },
      ],
    };
  }

  const header = stringRows[0].map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const findCol = (aliases: string[]) =>
    header.findIndex((h) => aliases.includes(h));

  const idx = {
    examNumber: findCol([
      'examnumber',
      'examno',
      'regno',
      'registrationnumber',
      'studentid',
      'candidateid',
      'id',
    ]),
    fullName: findCol([
      'fullname',
      'name',
      'studentname',
      'candidatename',
      'participantname',
      'participant',
      'student',
    ]),
    firstName: findCol(['firstname', 'givenname', 'forename']),
    lastName: findCol(['lastname', 'surname', 'familyname']),
    middleName: findCol(['middlename', 'othername', 'othernames']),
    classLevel: findCol([
      'classlevel',
      'class',
      'level',
      'grade',
      'stage',
      'category',
    ]),
    arm: findCol(['arm', 'classarm', 'section', 'group', 'department']),
    passcode: findCol(['passcode', 'password', 'pin', 'accesscode', 'code']),
  };

  const hasNameCol =
    idx.fullName !== -1 || idx.firstName !== -1 || idx.lastName !== -1;

  if (!hasNameCol) {
    return {
      students: [],
      errors: [
        {
          itemLabel: 'Header Row',
          reason:
            'Missing student name column. Include "fullName" (or "firstName" and "lastName"). Optional columns: classLevel, arm, passcode, examNumber.',
        },
      ],
    };
  }

  const students: ParsedBulkStudent[] = [];
  const errors: StudentBulkParseError[] = [];
  const seenExamNumbers = new Set<string>();

  for (let i = 1; i < stringRows.length; i++) {
    const cols = stringRows[i];
    const label = `Row ${i + 1}`;

    let fullName = idx.fullName >= 0 ? (cols[idx.fullName] ?? '').trim() : '';
    if (!fullName) {
      const nameParts = [
        idx.lastName >= 0 ? (cols[idx.lastName] ?? '').trim() : '',
        idx.firstName >= 0 ? (cols[idx.firstName] ?? '').trim() : '',
        idx.middleName >= 0 ? (cols[idx.middleName] ?? '').trim() : '',
      ].filter(Boolean);
      fullName = nameParts.join(' ');
    }

    const examNumber =
      idx.examNumber >= 0
        ? (cols[idx.examNumber] ?? '').trim().toUpperCase()
        : '';
    const classLevel = (
      (idx.classLevel >= 0 ? cols[idx.classLevel] : '') || defaultClassLevel
    )
      .trim()
      .toUpperCase();
    const arm =
      idx.arm >= 0 ? (cols[idx.arm] ?? '').trim() || defaultArm : defaultArm;
    const passcode = (
      (idx.passcode >= 0 ? cols[idx.passcode] : '') || defaultPasscode
    ).trim();

    if (!fullName) {
      errors.push({ itemLabel: label, reason: 'Missing student full name.' });
      continue;
    }
    if (!classLevel) {
      errors.push({
        itemLabel: label,
        reason: `Missing class level for "${fullName}".`,
      });
      continue;
    }
    if (passcode.length < 4) {
      errors.push({
        itemLabel: label,
        reason: `Passcode for "${fullName}" must be at least 4 characters (or set a Default Passcode above).`,
      });
      continue;
    }
    if (examNumber) {
      if (seenExamNumbers.has(examNumber)) {
        errors.push({
          itemLabel: label,
          reason: `Duplicate examination number "${examNumber}" in uploaded list.`,
        });
        continue;
      }
      seenExamNumbers.add(examNumber);
    }

    students.push({
      id: `row-${i}-${Math.random().toString(36).slice(2, 7)}`,
      fullName,
      examNumber,
      classLevel,
      arm,
      passcode,
    });
  }

  return { students, errors };
}

export function parsePlainStudentListText(
  rawText: string,
  defaults?: StudentBulkDefaults
): StudentBulkParseResult {
  const defaultClassLevel = (defaults?.classLevel || 'SS1').trim().toUpperCase();
  const defaultArm = (defaults?.arm ?? '').trim();
  const defaultPasscode = (defaults?.passcode ?? '').trim();

  const normalized = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!normalized) {
    return { students: [], errors: [] };
  }

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // If the pasted text looks like a headered CSV/TSV, delegate automatically
  if (lines.length >= 2) {
    const firstHeader = lines[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      /fullname|studentname|firstname|examnumber|classlevel/.test(firstHeader)
    ) {
      return parseStudentSpreadsheetRows(
        parseStudentCsvOrTsvText(normalized),
        defaults
      );
    }
  }

  const students: ParsedBulkStudent[] = [];
  const errors: StudentBulkParseError[] = [];
  const seenExamNumbers = new Set<string>();

  lines.forEach((rawLine, idx) => {
    const label = `Line ${idx + 1}`;
    // Strip leading numbering like "1. ", "1) ", "- ", "* "
    const cleaned = rawLine
      .replace(/^(?:\d+[.):\-]\s+|[-*•]\s+)/, '')
      .trim();

    if (!cleaned) return;

    // Support either plain name ("Adebayo Musa") or pipe/comma separated ("Adebayo Musa | SS3 | Science | pass1234")
    let parts: string[] = [cleaned];
    if (cleaned.includes('|')) {
      parts = cleaned.split('|').map((p) => p.trim());
    } else if (cleaned.includes('\t')) {
      parts = cleaned.split('\t').map((p) => p.trim());
    } else if (cleaned.includes(',')) {
      parts = cleaned.split(',').map((p) => p.trim());
    }

    const fullName = parts[0] || '';
    const classLevel = (parts[1] || defaultClassLevel).trim().toUpperCase();
    const arm = (parts[2] !== undefined ? parts[2] : defaultArm).trim();
    const passcode = (parts[3] || defaultPasscode).trim();
    const examNumber = (parts[4] || '').trim().toUpperCase();

    if (!fullName) {
      errors.push({ itemLabel: label, reason: 'Empty student name.' });
      return;
    }
    if (!classLevel) {
      errors.push({
        itemLabel: label,
        reason: `Missing class level for "${fullName}".`,
      });
      return;
    }
    if (passcode.length < 4) {
      errors.push({
        itemLabel: label,
        reason: `Passcode for "${fullName}" must be at least 4 characters (set a Default Passcode above).`,
      });
      return;
    }
    if (examNumber) {
      if (seenExamNumbers.has(examNumber)) {
        errors.push({
          itemLabel: label,
          reason: `Duplicate examination number "${examNumber}".`,
        });
        return;
      }
      seenExamNumbers.add(examNumber);
    }

    students.push({
      id: `line-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      fullName,
      examNumber,
      classLevel,
      arm,
      passcode,
    });
  });

  return { students, errors };
}

export function parseJsonStudents(
  rawJson: string,
  defaults?: StudentBulkDefaults
): StudentBulkParseResult {
  const defaultClassLevel = (defaults?.classLevel || 'SS1').trim().toUpperCase();
  const defaultArm = (defaults?.arm ?? '').trim();
  const defaultPasscode = (defaults?.passcode ?? '').trim();

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { students?: unknown[] }).students)
        ? (parsed as { students: unknown[] }).students
        : null;

    if (!list) {
      return {
        students: [],
        errors: [
          {
            itemLabel: 'JSON File',
            reason:
              'JSON must be an array of student objects or { "students": [...] }.',
          },
        ],
      };
    }

    const students: ParsedBulkStudent[] = [];
    const errors: StudentBulkParseError[] = [];
    const seenExamNumbers = new Set<string>();

    list.forEach((entry, idx) => {
      const label = `Item #${idx + 1}`;
      if (!entry || typeof entry !== 'object') {
        errors.push({ itemLabel: label, reason: 'Invalid student object.' });
        return;
      }
      const item = entry as Record<string, unknown>;
      const fullName = String(
        item.fullName ?? item.full_name ?? item.name ?? item.studentName ?? ''
      ).trim();
      const examNumber = String(
        item.examNumber ?? item.exam_number ?? item.examNo ?? ''
      )
        .trim()
        .toUpperCase();
      const classLevel = String(
        item.classLevel ?? item.class_level ?? item.class ?? defaultClassLevel
      )
        .trim()
        .toUpperCase();
      const arm = String(
        item.arm ?? item.classArm ?? item.section ?? defaultArm
      ).trim();
      const passcode = String(
        item.passcode ?? item.password ?? item.pin ?? defaultPasscode
      ).trim();

      if (!fullName) {
        errors.push({ itemLabel: label, reason: 'Missing fullName.' });
        return;
      }
      if (!classLevel) {
        errors.push({ itemLabel: label, reason: 'Missing classLevel.' });
        return;
      }
      if (passcode.length < 4) {
        errors.push({
          itemLabel: label,
          reason: `Passcode for "${fullName}" must be at least 4 characters.`,
        });
        return;
      }
      if (examNumber) {
        if (seenExamNumbers.has(examNumber)) {
          errors.push({
            itemLabel: label,
            reason: `Duplicate examination number "${examNumber}".`,
          });
          return;
        }
        seenExamNumbers.add(examNumber);
      }

      students.push({
        id: `json-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        fullName,
        examNumber,
        classLevel,
        arm,
        passcode,
      });
    });

    return { students, errors };
  } catch {
    return {
      students: [],
      errors: [{ itemLabel: 'JSON File', reason: 'Invalid JSON syntax.' }],
    };
  }
}
