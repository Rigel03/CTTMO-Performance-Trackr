import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to Excel (.xlsx) with styled headers.
 */
export function exportToExcel(data, filename = 'ipcr_export') {
  if (!data || data.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  // Style header row (yellow background)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell_addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cell_addr]) continue;
    ws[cell_addr].s = {
      fill: { fgColor: { rgb: 'FFD700' } },
      font: { bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' },
    };
  }

  // Auto-width
  const maxWidths = {};
  data.forEach(row => {
    Object.entries(row).forEach(([key, val]) => {
      const len = Math.max(String(key).length, String(val || '').length);
      maxWidths[key] = Math.max(maxWidths[key] || 0, len);
    });
  });
  ws['!cols'] = Object.values(maxWidths).map(w => ({ wch: Math.min(w + 2, 50) }));

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export data to PDF with CTTMO header and styled table.
 */
export function exportToPDF(data, title = 'IPCR Report', filename = 'ipcr_report') {
  if (!data || data.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('City Transport and Traffic Management Office', 148, 12, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Transport Planning and Management Division', 148, 18, { align: 'center' });
  doc.setFontSize(14);
  doc.text('PerfMon: Unified Performance Monitoring System', 148, 26, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 148, 33, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-PH')}`, 14, 33);

  // Table
  const columns = Object.keys(data[0]);
  const rows = data.map(row => columns.map(c => row[c] ?? ''));

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 38,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [255, 215, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 50 } },
  });

  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
