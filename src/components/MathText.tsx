import React, { useMemo } from 'react';
import katex from 'katex';

interface MathSegment {
  type: 'text' | 'inline' | 'display';
  content: string;
}

/**
 * Splits text into plain-text segments and LaTeX math segments.
 * Supports:
 *  - Display math: $$...$$ or \[...\]
 *  - Inline math: $...$ (Pandoc spacing rule so prices like $50 aren't mangled) or \(...\)
 *  - Escaped dollar signs: \$ -> literal $
 */
export function tokenizeMathText(input: string): MathSegment[] {
  if (!input) return [];

  const segments: MathSegment[] = [];
  let buffer = '';
  let i = 0;

  const flushText = () => {
    if (buffer) {
      segments.push({ type: 'text', content: buffer });
      buffer = '';
    }
  };

  while (i < input.length) {
    // Handle escaped dollar sign \$
    if (input[i] === '\\' && input[i + 1] === '$') {
      buffer += '$';
      i += 2;
      continue;
    }

    // Handle display math: $$...$$
    if (input[i] === '$' && input[i + 1] === '$') {
      const end = input.indexOf('$$', i + 2);
      if (end !== -1 && end > i + 2) {
        flushText();
        segments.push({
          type: 'display',
          content: input.slice(i + 2, end).trim(),
        });
        i = end + 2;
        continue;
      }
    }

    // Handle display math: \[...\]
    if (input[i] === '\\' && input[i + 1] === '[') {
      const end = input.indexOf('\\]', i + 2);
      if (end !== -1 && end > i + 2) {
        flushText();
        segments.push({
          type: 'display',
          content: input.slice(i + 2, end).trim(),
        });
        i = end + 2;
        continue;
      }
    }

    // Handle inline math: \(...\)
    if (input[i] === '\\' && input[i + 1] === '(') {
      const end = input.indexOf('\\)', i + 2);
      if (end !== -1 && end > i + 2) {
        flushText();
        segments.push({
          type: 'inline',
          content: input.slice(i + 2, end).trim(),
        });
        i = end + 2;
        continue;
      }
    }

    // Handle inline math: $...$
    if (input[i] === '$') {
      const nextChar = input[i + 1];
      // Opening $ must not be followed by whitespace or newline
      if (nextChar && !/\s/.test(nextChar) && nextChar !== '$') {
        let j = i + 1;
        let foundEnd = -1;
        while (j < input.length) {
          if (input[j] === '\\' && j + 1 < input.length) {
            j += 2;
            continue;
          }
          if (input[j] === '\n') {
            break;
          }
          if (input[j] === '$') {
            const prevChar = input[j - 1];
            const afterClose = input[j + 1];
            // Closing $ must not be preceded by whitespace and not immediately followed by a digit
            if (
              prevChar &&
              !/\s/.test(prevChar) &&
              (!afterClose || !/\d/.test(afterClose))
            ) {
              foundEnd = j;
            }
            break;
          }
          j++;
        }

        if (foundEnd !== -1) {
          const expr = input.slice(i + 1, foundEnd).trim();
          if (expr) {
            flushText();
            segments.push({ type: 'inline', content: expr });
            i = foundEnd + 1;
            continue;
          }
        }
      }
    }

    buffer += input[i];
    i++;
  }

  flushText();
  return segments;
}

export function validateLatexInText(input: string): string[] {
  const segments = tokenizeMathText(input);
  const errors: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'text') continue;
    try {
      katex.renderToString(seg.content, {
        displayMode: seg.type === 'display',
        throwOnError: true,
        strict: false,
        trust: false,
      });
    } catch (err) {
      errors.push(
        err instanceof Error
          ? err.message.replace(/^KaTeX parse error:\s*/i, '')
          : `Invalid LaTeX expression: ${seg.content}`
      );
    }
  }

  return errors;
}

export function MathText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const renderedSegments = useMemo(() => {
    const segments = tokenizeMathText(text);
    return segments.map((seg, idx) => {
      if (seg.type === 'text') {
        return { kind: 'text' as const, key: idx, value: seg.content };
      }

      try {
        const html = katex.renderToString(seg.content, {
          displayMode: seg.type === 'display',
          throwOnError: false,
          strict: false,
          trust: false,
          output: 'htmlAndMathml',
        });
        return {
          kind: seg.type,
          key: idx,
          html,
        };
      } catch {
        return {
          kind: 'text' as const,
          key: idx,
          value: seg.type === 'display' ? `$$${seg.content}$$` : `$${seg.content}$`,
        };
      }
    });
  }, [text]);

  return (
    <span className={className}>
      {renderedSegments.map((item) => {
        if (item.kind === 'text') {
          return <React.Fragment key={item.key}>{item.value}</React.Fragment>;
        }
        if (item.kind === 'display') {
          return (
            <span
              key={item.key}
              className="block my-2 overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
          );
        }
        return (
          <span
            key={item.key}
            className="inline-block align-middle max-w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: item.html }}
          />
        );
      })}
    </span>
  );
}
