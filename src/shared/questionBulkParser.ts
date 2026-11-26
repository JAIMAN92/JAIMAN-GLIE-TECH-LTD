export interface ParsedBulkQuestion {
  id: string;
  topic: string;
  questionText: string;
  imageUrl?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

export interface BulkParseError {
  itemLabel: string;
  reason: string;
}

export interface BulkParseResult {
  questions: ParsedBulkQuestion[];
  errors: BulkParseError[];
}

function resolveCorrectLetter(
  rawAnswer: string,
  options: { A: string; B: string; C: string; D: string }
): 'A' | 'B' | 'C' | 'D' | null {
  const cleaned = rawAnswer.trim();
  if (!cleaned) return null;

  // Matches "A", "b", "Option B", "Ans: C", "(D)", "B.", "B)"
  const letterMatch = cleaned.match(
    /^(?:option|opt|answer|ans|key|correct)?\s*[:.\-(]*\s*([A-Da-d])\s*[).\]]*$/i
  );
  if (letterMatch) {
    return letterMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
  }

  // Matches leading "B. Some text" or "B) Some text"
  const prefixedMatch = cleaned.match(/^([A-Da-d])\s*[).:\-]\s+/);
  if (prefixedMatch) {
    return prefixedMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
  }

  // Matches numeric 1..4
  if (['1', '2', '3', '4'].includes(cleaned)) {
    return (['A', 'B', 'C', 'D'] as const)[Number(cleaned) - 1];
  }

  // Matches exact option text (case-insensitive)
  const lower = cleaned.toLowerCase();
  if (options.A.trim().toLowerCase() === lower) return 'A';
  if (options.B.trim().toLowerCase() === lower) return 'B';
  if (options.C.trim().toLowerCase() === lower) return 'C';
  if (options.D.trim().toLowerCase() === lower) return 'D';

  return null;
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

export function parseCsvOrTsvText(rawText: string): string[][] {
  const firstLine =
    rawText
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0) || '';

  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter: ',' | '\t' | ';' = ',';
  if (tabCount >= 4 && tabCount >= commaCount) {
    delimiter = '\t';
  } else if (semiCount >= 4 && commaCount === 0) {
    delimiter = ';';
  }

  return parseDelimiterSeparatedRows(rawText, delimiter);
}

export function parseSpreadsheetRows(
  rows: Array<Array<string | number | boolean | null | undefined>>,
  defaults?: { topic?: string; marks?: number }
): BulkParseResult {
  const defaultTopic = defaults?.topic?.trim() || 'General';
  const defaultMarks = Math.max(1, Number(defaults?.marks) || 1);

  const stringRows = rows
    .map((r) => r.map((cell) => String(cell ?? '').trim()))
    .filter((r) => r.some((cell) => cell !== ''));

  if (stringRows.length < 2) {
    return {
      questions: [],
      errors: [
        {
          itemLabel: 'File / Sheet',
          reason:
            'Include a header row (questionText, optionA, optionB, optionC, optionD, correctOption) and at least one question row.',
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
    topic: findCol(['topic', 'category', 'section', 'unit']),
    q: findCol([
      'questiontext',
      'question',
      'stem',
      'prompt',
      'questions',
      'questionstem',
    ]),
    imageUrl: findCol([
      'imageurl',
      'image',
      'diagram',
      'diagramurl',
      'figure',
      'figureurl',
      'img',
    ]),
    a: findCol(['optiona', 'a', 'opta', 'choicea', 'answera']),
    b: findCol(['optionb', 'b', 'optb', 'choiceb', 'answerb']),
    c: findCol(['optionc', 'c', 'optc', 'choicec', 'answerc']),
    d: findCol(['optiond', 'd', 'optd', 'choiced', 'answerd']),
    ans: findCol([
      'correctoption',
      'correctanswer',
      'correct',
      'answer',
      'ans',
      'answerkey',
      'key',
    ]),
    marks: findCol(['marks', 'mark', 'score', 'points', 'point']),
  };

  if (
    idx.q === -1 ||
    idx.a === -1 ||
    idx.b === -1 ||
    idx.c === -1 ||
    idx.d === -1 ||
    idx.ans === -1
  ) {
    return {
      questions: [],
      errors: [
        {
          itemLabel: 'Header Row',
          reason:
            'Missing required column headers. Include: questionText, optionA, optionB, optionC, optionD, and correctOption (or Answer).',
        },
      ],
    };
  }

  const questions: ParsedBulkQuestion[] = [];
  const errors: BulkParseError[] = [];

  for (let i = 1; i < stringRows.length; i++) {
    const cols = stringRows[i];
    const questionText = (cols[idx.q] ?? '').trim();
    const imageUrl =
      idx.imageUrl >= 0 ? (cols[idx.imageUrl] ?? '').trim() : '';
    const optionA = (cols[idx.a] ?? '').trim();
    const optionB = (cols[idx.b] ?? '').trim();
    const optionC = (cols[idx.c] ?? '').trim();
    const optionD = (cols[idx.d] ?? '').trim();
    const rawAns = (cols[idx.ans] ?? '').trim();
    const topic =
      idx.topic >= 0 ? (cols[idx.topic] ?? '').trim() || defaultTopic : defaultTopic;
    const parsedMarks =
      idx.marks >= 0 ? Math.max(1, Number(cols[idx.marks]) || defaultMarks) : defaultMarks;

    const correctOption = resolveCorrectLetter(rawAns, {
      A: optionA,
      B: optionB,
      C: optionC,
      D: optionD,
    });

    if (!questionText) {
      errors.push({ itemLabel: `Row ${i + 1}`, reason: 'Empty question text.' });
      continue;
    }
    if (!optionA || !optionB || !optionC || !optionD) {
      errors.push({
        itemLabel: `Row ${i + 1}`,
        reason: 'All four options (A, B, C, and D) must be filled.',
      });
      continue;
    }
    if (!correctOption) {
      errors.push({
        itemLabel: `Row ${i + 1}`,
        reason: `Invalid answer key "${rawAns || '(empty)'}". Use A, B, C, D or exact option text.`,
      });
      continue;
    }

    questions.push({
      id: `row-${i}-${Math.random().toString(36).slice(2, 7)}`,
      topic,
      questionText,
      ...(imageUrl ? { imageUrl } : {}),
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      marks: parsedMarks,
    });
  }

  return { questions, errors };
}

export function parseQaTextBlocks(
  rawText: string,
  defaults?: { topic?: string; marks?: number }
): BulkParseResult {
  const defaultTopic = defaults?.topic?.trim() || 'General';
  const defaultMarks = Math.max(1, Number(defaults?.marks) || 1);

  const normalized = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!normalized) {
    return { questions: [], errors: [] };
  }

  const lines = normalized.split('\n');
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  let sawOptionsInCurrent = false;
  let sawAnswerInCurrent = false;

  const isOptionLine = (line: string) =>
    /^(?:\*?\s*)?(?:\(?([A-Da-d])\)|([A-Da-d])[.)\]:-])\s+/.test(line.trim());

  const isAnswerLine = (line: string) =>
    /^(?:correct\s*answer|correct\s*option|answer|ans|key|correct)\s*[:=\-.]?\s*/i.test(
      line.trim()
    );

  const isNewQuestionStart = (line: string) =>
    /^(?:Q(?:uestion)?\s*#?\s*\d+[.):\-]?\s+|\d+\s*[.):\-]\s+)/i.test(
      line.trim()
    );

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentBlock.length > 0 && (sawOptionsInCurrent || sawAnswerInCurrent)) {
        blocks.push(currentBlock);
        currentBlock = [];
        sawOptionsInCurrent = false;
        sawAnswerInCurrent = false;
      }
      continue;
    }

    if (
      isNewQuestionStart(line) &&
      currentBlock.length > 0 &&
      (sawOptionsInCurrent || sawAnswerInCurrent)
    ) {
      blocks.push(currentBlock);
      currentBlock = [];
      sawOptionsInCurrent = false;
      sawAnswerInCurrent = false;
    }

    if (isOptionLine(line)) sawOptionsInCurrent = true;
    if (isAnswerLine(line)) sawAnswerInCurrent = true;
    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const questions: ParsedBulkQuestion[] = [];
  const errors: BulkParseError[] = [];

  blocks.forEach((blockLines, idx) => {
    const label = `Question #${idx + 1}`;
    const qParts: string[] = [];
    const options: { A: string; B: string; C: string; D: string } = {
      A: '',
      B: '',
      C: '',
      D: '',
    };
    let rawAnswer = '';
    let starMarkedCorrect: 'A' | 'B' | 'C' | 'D' | null = null;
    let topic = defaultTopic;
    let marks = defaultMarks;
    let imageUrl = '';
    let inOptionsSection = false;

    for (const line of blockLines) {
      const topicMatch = line.match(/^topic\s*[:=\-]\s*(.+)$/i);
      if (topicMatch) {
        topic = topicMatch[1].trim() || defaultTopic;
        continue;
      }

      const imageMatch = line.match(
        /^(?:image\s*url|image|diagram\s*url|diagram|figure|img)\s*[:=\-]\s*(.+)$/i
      );
      if (imageMatch) {
        imageUrl = imageMatch[1].trim();
        continue;
      }

      const marksMatch = line.match(/^(?:marks?|score|points?)\s*[:=\-]\s*(\d+)/i);
      if (marksMatch) {
        marks = Math.max(1, Number(marksMatch[1]) || defaultMarks);
        continue;
      }

      const ansMatch = line.match(
        /^(?:correct\s*answer|correct\s*option|answer|ans|key|correct)\s*[:=\-.]\s*(.+)$/i
      );
      if (ansMatch) {
        rawAnswer = ansMatch[1].trim();
        continue;
      }

      const optMatch = line.match(
        /^(\*?)\s*(?:\(([A-Da-d])\)|([A-Da-d])[.)\]:-])\s*(.+)$/
      );
      if (optMatch) {
        inOptionsSection = true;
        const hasLeadingStar = Boolean(optMatch[1]);
        const letter = (optMatch[2] || optMatch[3]).toUpperCase() as
          | 'A'
          | 'B'
          | 'C'
          | 'D';
        let optText = optMatch[4].trim();
        if (/\*$|\[correct\]|\(correct\)/i.test(optText) || hasLeadingStar) {
          starMarkedCorrect = letter;
          optText = optText
            .replace(/\*$/, '')
            .replace(/\[correct\]|\(correct\)/gi, '')
            .trim();
        }
        options[letter] = optText;
        continue;
      }

      if (!inOptionsSection) {
        const cleanedStem =
          qParts.length === 0
            ? line.replace(/^(?:Q(?:uestion)?\s*#?\s*\d+[.):\-]?\s*|\d+\s*[.):\-]\s+)/i, '')
            : line;
        if (cleanedStem.trim()) qParts.push(cleanedStem.trim());
      }
    }

    const questionText = qParts.join(' ').trim();
    const correctOption =
      resolveCorrectLetter(rawAnswer, options) || starMarkedCorrect;

    if (!questionText) {
      errors.push({ itemLabel: label, reason: 'Could not detect question stem.' });
      return;
    }
    if (!options.A || !options.B || !options.C || !options.D) {
      const missing = (['A', 'B', 'C', 'D'] as const).filter((k) => !options[k]);
      errors.push({
        itemLabel: label,
        reason: `Missing option(s): ${missing.join(', ')}.`,
      });
      return;
    }
    if (!correctOption) {
      errors.push({
        itemLabel: label,
        reason: 'Missing or unrecognized Answer line (e.g., "Answer: B").',
      });
      return;
    }

    questions.push({
      id: `txt-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      topic,
      questionText,
      ...(imageUrl ? { imageUrl } : {}),
      optionA: options.A,
      optionB: options.B,
      optionC: options.C,
      optionD: options.D,
      correctOption,
      marks,
    });
  });

  return { questions, errors };
}

export function parseJsonQuestions(
  rawJson: string,
  defaults?: { topic?: string; marks?: number }
): BulkParseResult {
  const defaultTopic = defaults?.topic?.trim() || 'General';
  const defaultMarks = Math.max(1, Number(defaults?.marks) || 1);

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { questions?: unknown[] }).questions)
        ? (parsed as { questions: unknown[] }).questions
        : null;

    if (!list) {
      return {
        questions: [],
        errors: [
          {
            itemLabel: 'JSON File',
            reason:
              'JSON must be an array of question objects or { "questions": [...] }.',
          },
        ],
      };
    }

    const questions: ParsedBulkQuestion[] = [];
    const errors: BulkParseError[] = [];

    list.forEach((entry, idx) => {
      const label = `Item #${idx + 1}`;
      if (!entry || typeof entry !== 'object') {
        errors.push({ itemLabel: label, reason: 'Invalid question object.' });
        return;
      }
      const item = entry as Record<string, unknown>;
      const questionText = String(
        item.questionText ?? item.question ?? item.stem ?? ''
      ).trim();

      const optsObj = Array.isArray(item.options)
        ? {
            A: String(item.options[0] ?? '').trim(),
            B: String(item.options[1] ?? '').trim(),
            C: String(item.options[2] ?? '').trim(),
            D: String(item.options[3] ?? '').trim(),
          }
        : {
            A: String(item.optionA ?? item.option_a ?? item.a ?? '').trim(),
            B: String(item.optionB ?? item.option_b ?? item.b ?? '').trim(),
            C: String(item.optionC ?? item.option_c ?? item.c ?? '').trim(),
            D: String(item.optionD ?? item.option_d ?? item.d ?? '').trim(),
          };

      const rawAns = String(
        item.correctOption ?? item.correct_option ?? item.answer ?? item.correct ?? ''
      ).trim();

      const correctOption = resolveCorrectLetter(rawAns, optsObj);
      const topic = String(item.topic ?? '').trim() || defaultTopic;
      const marks = Math.max(1, Number(item.marks) || defaultMarks);
      const imageUrl = String(
        item.imageUrl ?? item.image_url ?? item.diagramUrl ?? item.diagram ?? item.image ?? ''
      ).trim();

      if (!questionText) {
        errors.push({ itemLabel: label, reason: 'Missing questionText.' });
        return;
      }
      if (!optsObj.A || !optsObj.B || !optsObj.C || !optsObj.D) {
        errors.push({ itemLabel: label, reason: 'Missing options A–D.' });
        return;
      }
      if (!correctOption) {
        errors.push({
          itemLabel: label,
          reason: `Invalid correctOption "${rawAns}".`,
        });
        return;
      }

      questions.push({
        id: `json-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        topic,
        questionText,
        ...(imageUrl ? { imageUrl } : {}),
        optionA: optsObj.A,
        optionB: optsObj.B,
        optionC: optsObj.C,
        optionD: optsObj.D,
        correctOption,
        marks,
      });
    });

    return { questions, errors };
  } catch {
    return {
      questions: [],
      errors: [{ itemLabel: 'JSON File', reason: 'Invalid JSON syntax.' }],
    };
  }
}
