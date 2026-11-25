import { Clock, CheckCircle2, MonitorCheck } from 'lucide-react';

export function CbtInterfaceIllustration() {
  return (
    <div
      className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
      aria-label="Illustration of JAIMAN GOLDENLITE TECH LTD Computer-Based Testing Environment"
    >
      {/* Subtle top geometric brand accent strip */}
      <div className="h-1.5 w-full flex">
        <div className="flex-1 bg-[#123B72]" />
        <div className="w-16 bg-[#E83E8C]" />
        <div className="w-12 bg-[#D4AF37]" />
        <div className="w-14 bg-[#20C4D8]" />
      </div>

      {/* CBT Workspace Window Header */}
      <div className="px-5 py-3.5 bg-[#123B72] text-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <MonitorCheck className="w-4 h-4 text-[#20C4D8] shrink-0" />
          <span className="font-display text-xs sm:text-sm font-semibold truncate">
            JAIMAN CBT Examination Environment
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono-tabular text-xs font-semibold text-[#D4AF37] shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span>45:00</span>
        </div>
      </div>

      {/* CBT Question & Navigator Preview */}
      <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-5 bg-[#F5F8FC]">
        <div className="sm:col-span-8 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-[#1769AA]">
              Question 04 of 40
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-saved
            </span>
          </div>

          <p className="text-sm font-medium text-[#1E293B] leading-relaxed">
            Solve for x in the linear equation: 3x + 7 = 22.
          </p>

          <div className="space-y-2">
            {[
              { key: 'A', label: '3', selected: false },
              { key: 'B', label: '5', selected: true },
              { key: 'C', label: '7', selected: false },
              { key: 'D', label: '15', selected: false },
            ].map((opt) => (
              <div
                key={opt.key}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                  opt.selected
                    ? 'border-[#1769AA] bg-[#1769AA]/5 text-[#123B72] font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center font-mono-tabular text-xs font-bold shrink-0 ${
                    opt.selected
                      ? 'bg-[#1769AA] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {opt.key}
                </span>
                <span>{opt.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Question Palette Vector Graphic */}
        <div className="sm:col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#123B72] tracking-wide">
              Question Palette
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 16 }, (_, idx) => {
                const n = idx + 1;
                const isCurrent = n === 4;
                const isDone = n < 4;
                return (
                  <div
                    key={n}
                    className={`h-7 rounded text-[11px] font-mono-tabular font-semibold flex items-center justify-center ${
                      isCurrent
                        ? 'bg-[#E83E8C] text-white'
                        : isDone
                          ? 'bg-[#123B72] text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-1.5 text-[11px] text-slate-600">
            <div className="flex items-center justify-between">
              <span>Answered</span>
              <span className="font-mono-tabular font-semibold text-[#123B72]">
                03
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Remaining</span>
              <span className="font-mono-tabular font-semibold text-slate-700">
                37
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
