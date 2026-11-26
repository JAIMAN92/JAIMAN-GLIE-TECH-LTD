import { useState } from 'react';
import { HelpCircle, Sigma } from 'lucide-react';

export type QuestionFieldKey =
  | 'questionText'
  | 'optionA'
  | 'optionB'
  | 'optionC'
  | 'optionD';

const FIELD_LABELS: Record<QuestionFieldKey, string> = {
  questionText: 'Question Text',
  optionA: 'Option A',
  optionB: 'Option B',
  optionC: 'Option C',
  optionD: 'Option D',
};

type FormulaCategory = 'maths' | 'calculus' | 'chemistry' | 'symbols';

interface FormulaPreset {
  label: string;
  preview: string;
  snippet: string;
  title: string;
}

const FORMULA_CATEGORIES: Array<{
  key: FormulaCategory;
  label: string;
  items: FormulaPreset[];
}> = [
  {
    key: 'maths',
    label: 'Mathematics',
    items: [
      {
        label: 'Fraction',
        preview: 'a/b',
        snippet: '$\\frac{a}{b}$',
        title: 'Insert fraction',
      },
      {
        label: 'Power',
        preview: 'x²',
        snippet: '$x^{2}$',
        title: 'Insert exponent / power',
      },
      {
        label: 'Sqrt',
        preview: '√x',
        snippet: '$\\sqrt{x}$',
        title: 'Insert square root',
      },
      {
        label: 'Nth Root',
        preview: 'ⁿ√x',
        snippet: '$\\sqrt[n]{x}$',
        title: 'Insert nth root',
      },
      {
        label: 'Quadratic',
        preview: '(-b±√)/2a',
        snippet: '$$x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}$$',
        title: 'Insert quadratic formula block',
      },
      {
        label: 'Log',
        preview: 'log₁₀(x)',
        snippet: '$\\log_{10}(x)$',
        title: 'Insert logarithm',
      },
      {
        label: 'Angle',
        preview: '∠ABC = 90°',
        snippet: '$\\angle ABC = 90^{\\circ}$',
        title: 'Insert geometric angle',
      },
      {
        label: 'Inequality',
        preview: 'x ≤ y',
        snippet: '$x \\leq y$',
        title: 'Insert less than or equal to',
      },
      {
        label: 'Vector',
        preview: 'v⃗',
        snippet: '$\\vec{v}$',
        title: 'Insert vector notation',
      },
    ],
  },
  {
    key: 'calculus',
    label: 'Calculus & Matrices',
    items: [
      {
        label: 'Integral',
        preview: '∫ f(x)dx',
        snippet: '$\\int_{a}^{b} f(x)\\,dx$',
        title: 'Insert definite integral',
      },
      {
        label: 'Derivative',
        preview: 'dy/dx',
        snippet: '$\\frac{dy}{dx}$',
        title: 'Insert derivative',
      },
      {
        label: 'Summation',
        preview: 'Σ xᵢ',
        snippet: '$\\sum_{i=1}^{n} x_{i}$',
        title: 'Insert summation',
      },
      {
        label: 'Limit',
        preview: 'lim x→0',
        snippet: '$\\lim_{x \\to 0} f(x)$',
        title: 'Insert limit',
      },
      {
        label: '2×2 Matrix',
        preview: '[a b; c d]',
        snippet: '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$',
        title: 'Insert 2x2 matrix block',
      },
      {
        label: 'Combination',
        preview: 'nCr',
        snippet: '$\\binom{n}{r}$',
        title: 'Insert binomial / combination',
      },
      {
        label: 'Infinity',
        preview: '∞',
        snippet: '$\\infty$',
        title: 'Insert infinity symbol',
      },
    ],
  },
  {
    key: 'chemistry',
    label: 'Chemistry & Physics',
    items: [
      {
        label: 'Formula',
        preview: 'H₂SO₄',
        snippet: '$\\text{H}_{2}\\text{SO}_{4}$',
        title: 'Insert chemical formula with subscripts',
      },
      {
        label: 'Ion',
        preview: 'Fe³⁺',
        snippet: '$\\text{Fe}^{3+}$',
        title: 'Insert ion charge superscript',
      },
      {
        label: 'Reaction',
        preview: '→ heat',
        snippet: '$\\xrightarrow{\\text{heat}}$',
        title: 'Insert labeled reaction arrow',
      },
      {
        label: 'Equilibrium',
        preview: '⇌',
        snippet: '$\\rightleftharpoons$',
        title: 'Insert reversible reaction arrow',
      },
      {
        label: 'Isotope',
        preview: '¹⁴₆C',
        snippet: '$^{14}_{6}\\text{C}$',
        title: 'Insert atomic/mass number notation',
      },
      {
        label: 'Enthalpy',
        preview: 'ΔH',
        snippet: '$\\Delta H$',
        title: 'Insert delta enthalpy/change',
      },
      {
        label: 'Ohm',
        preview: 'Ω',
        snippet: '$\\Omega$',
        title: 'Insert Ohm symbol',
      },
      {
        label: 'Micro',
        preview: 'μF',
        snippet: '$\\mu\\text{F}$',
        title: 'Insert microfarad / micro unit',
      },
      {
        label: 'Wavelength',
        preview: 'λ',
        snippet: '$\\lambda$',
        title: 'Insert wavelength lambda',
      },
    ],
  },
  {
    key: 'symbols',
    label: 'Greek & Operators',
    items: [
      { label: 'Pi', preview: 'π', snippet: '$\\pi$', title: 'Pi' },
      { label: 'Theta', preview: 'θ', snippet: '$\\theta$', title: 'Theta' },
      { label: 'Alpha', preview: 'α', snippet: '$\\alpha$', title: 'Alpha' },
      { label: 'Beta', preview: 'β', snippet: '$\\beta$', title: 'Beta' },
      { label: 'Plus/Minus', preview: '±', snippet: '$\\pm$', title: 'Plus or minus' },
      { label: 'Multiply', preview: '×', snippet: '$\\times$', title: 'Multiplication cross' },
      { label: 'Divide', preview: '÷', snippet: '$\\div$', title: 'Division sign' },
      { label: 'Approx', preview: '≈', snippet: '$\\approx$', title: 'Approximately equal' },
      { label: 'Not Equal', preview: '≠', snippet: '$\\neq$', title: 'Not equal' },
      { label: 'Degree', preview: '°C', snippet: '$^{\\circ}\\text{C}$', title: 'Degrees Celsius' },
    ],
  },
];

export function LatexFormulaToolbar({
  activeField,
  onInsertSnippet,
  onWrapSelection,
}: {
  activeField: QuestionFieldKey;
  onInsertSnippet: (snippet: string) => void;
  onWrapSelection: () => void;
}) {
  const [category, setCategory] = useState<FormulaCategory>('maths');
  const [showGuide, setShowGuide] = useState(false);

  const currentPresets =
    FORMULA_CATEGORIES.find((c) => c.key === category)?.items || [];

  return (
    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#123B72]">
            <Sigma className="w-4 h-4 text-[#E83E8C]" />
            STEM LaTeX Formula Palette
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">
            Inserting into{' '}
            <strong className="text-[#1769AA]">
              {FIELD_LABELS[activeField]}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onWrapSelection}
            className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-[11px] font-semibold text-[#123B72] hover:border-[#1769AA] hover:text-[#1769AA]"
            title="Wrap highlighted text or cursor in $ ... $"
          >
            Wrap in $...$
          </button>
          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769AA] hover:underline"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showGuide ? 'Hide Syntax Guide' : 'Syntax Guide'}
          </button>
        </div>
      </div>

      {/* Category Switcher */}
      <div className="flex flex-wrap gap-1.5">
        {FORMULA_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setCategory(cat.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              category === cat.key
                ? 'bg-[#123B72] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Formula Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {currentPresets.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.title}
            onClick={() => onInsertSnippet(item.snippet)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#1769AA] hover:bg-[#1769AA]/5 text-left transition-colors"
          >
            <span className="text-xs font-semibold text-[#123B72] mr-1.5">
              {item.preview}
            </span>
            <span className="text-[11px] text-slate-500">{item.label}</span>
          </button>
        ))}
      </div>

      {showGuide && (
        <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-[#123B72]">
            How to write equations in Questions and Options A–D:
          </p>
          <p>
            Use single dollar signs for inline math:{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#123B72]">
              {'$x^2 + \\frac{1}{2}x = 5$'}
            </code>
          </p>
          <p>
            Use double dollar signs for centered block equations:{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#123B72]">
              {'$$\\int_0^2 (3x^2 + 1)\\,dx$$'}
            </code>
          </p>
          <p>
            For currency amounts like $500, leave it as normal text or escape
            with{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#123B72]">
              {'\\$500'}
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
