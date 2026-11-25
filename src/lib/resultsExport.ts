import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportableResultRow {
  attemptId: number;
  examTitle: string;
  subjectName: string;
  schoolName: string;
  examNumber: string;
  studentName: string;
  classLevel: string;
  arm: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  securityViolations?: number;
  submissionReason?: string;
  submittedAt: string;
}

export interface ResultsExportFilterLabels {
  schoolName?: string;
  classLevel?: string;
  arm?: string;
  subjectName?: string;
  examTitle?: string;
}

export function exportResultsToPdf(
  results: ExportableResultRow[],
  filters: ResultsExportFilterLabels
): string {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // Header Banner
  doc.setFillColor(18, 59, 114); // #123B72 Navy
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFillColor(212, 175, 55); // #D4AF37 Gold accent strip
  doc.rect(0, 24, pageWidth, 1.4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('JAIMAN GOLDENLITE TECH LTD', marginX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(219, 234, 254);
  doc.text('Official CBT Examination Results Report', marginX, 18);

  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  const generatedText = `Generated: ${new Date().toLocaleString()}`;
  doc.text(generatedText, pageWidth - marginX, 15, { align: 'right' });

  // Active Filter Summary
  const activeFilterParts: string[] = [];
  if (filters.schoolName) activeFilterParts.push(`School: ${filters.schoolName}`);
  if (filters.classLevel) activeFilterParts.push(`Class: ${filters.classLevel}`);
  if (filters.arm) activeFilterParts.push(`Arm: ${filters.arm}`);
  if (filters.subjectName) activeFilterParts.push(`Subject: ${filters.subjectName}`);
  if (filters.examTitle) activeFilterParts.push(`Exam: ${filters.examTitle}`);
  const filterLine =
    activeFilterParts.length > 0
      ? `Filters: ${activeFilterParts.join('  |  ')}`
      : 'Filters: All Schools, Classes & Examinations';

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.text(filterLine, marginX, 32);

  // KPI Summary Boxes
  const totalCount = results.length;
  const avgPct =
    totalCount > 0
      ? Math.round(
          results.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0) /
            totalCount
        )
      : 0;
  const highestPct =
    totalCount > 0
      ? Math.max(...results.map((r) => Number(r.percentage) || 0))
      : 0;
  const passCount = results.filter((r) => (Number(r.percentage) || 0) >= 50).length;
  const passRate =
    totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const kpis = [
    { label: 'Total Submissions', value: String(totalCount) },
    { label: 'Average Score', value: `${avgPct}%` },
    { label: 'Highest Score', value: `${highestPct}%` },
    { label: 'Pass Rate (>=50%)', value: `${passCount}/${totalCount} (${passRate}%)` },
  ];

  const boxGap = 4;
  const boxWidth = (pageWidth - marginX * 2 - boxGap * 3) / 4;
  const boxTop = 36;
  const boxHeight = 14;

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * (boxWidth + boxGap);
    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, boxTop, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3.5, boxTop + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(18, 59, 114);
    doc.text(kpi.value, x + 3.5, boxTop + 11.2);
  });

  // Table Body
  const tableRows = results.map((r, index) => [
    String(index + 1),
    r.examNumber,
    r.studentName,
    r.schoolName,
    `${r.classLevel}${r.arm ? ` ${r.arm}` : ''}`,
    r.examTitle,
    r.subjectName,
    `${r.correctCount}/${r.totalQuestions}`,
    `${r.score}/${r.totalMarks}`,
    `${r.percentage}%`,
    r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '-',
  ]);

  autoTable(doc, {
    startY: boxTop + boxHeight + 6,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [
      [
        '#',
        'Exam No.',
        'Student Name',
        'School',
        'Class',
        'Examination',
        'Subject',
        'Correct',
        'Score',
        '%',
        'Submitted',
      ],
    ],
    body: tableRows,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [18, 59, 114],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 36 },
      3: { cellWidth: 36 },
      4: { cellWidth: 20 },
      5: { cellWidth: 42 },
      6: { cellWidth: 26 },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 18, halign: 'right' },
      9: { cellWidth: 13, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 22, halign: 'right' },
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageCurrent = doc.getCurrentPageInfo().pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'JAIMAN GOLDENLITE TECH LTD — CBT Results Export',
        marginX,
        pageHeight - 7
      );
      doc.text(
        `Page ${pageCurrent} of ${pageCount}`,
        pageWidth - marginX,
        pageHeight - 7,
        { align: 'right' }
      );
    },
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  const fileName = `jaiman_cbt_results_${dateTag}.pdf`;
  doc.save(fileName);
  return fileName;
}
