'use strict';
/* global docx */
// Eksport dokumentu do Word (.docx) – generowany lokalnie, bez internetu.
// Format treści sekcji: "## podtytuł", "- punkt", "| tabela | wiersz |", zwykłe akapity, **pogrubienie**.
(function () {
  const FONT = 'Calibri';

  function runs(text, opts = {}) {
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter((x) => x !== '');
    return parts.map((p) => {
      const bold = /^\*\*[^*]+\*\*$/.test(p);
      return new docx.TextRun({ text: bold ? p.slice(2, -2) : p, bold: bold || opts.bold, size: opts.size, font: FONT, italics: opts.italics, color: opts.color });
    });
  }

  function cellsOf(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  }

  function table(rows) {
    const clean = rows.filter((r) => !/^\|?\s*:?-{2,}/.test(r.trim()));
    const data = clean.map(cellsOf);
    const cols = Math.max(...data.map((r) => r.length));
    const border = { style: docx.BorderStyle.SINGLE, size: 4, color: '999999' };
    return new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      rows: data.map((r, ri) => new docx.TableRow({
        tableHeader: ri === 0,
        children: Array.from({ length: cols }, (_, ci) => new docx.TableCell({
          shading: ri === 0 ? { fill: 'EDEFF3', type: docx.ShadingType.CLEAR, color: 'auto' } : undefined,
          borders: { top: border, bottom: border, left: border, right: border },
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [new docx.Paragraph({ children: runs(r[ci] || '', { bold: ri === 0, size: 20 }) })]
        }))
      }))
    });
  }

  function blocks(content) {
    const out = [];
    const lines = String(content || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const t = l.trim();
      if (!t) continue;
      if (t.startsWith('|')) {
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++; }
        i--;
        out.push(table(rows));
        out.push(new docx.Paragraph({ children: [], spacing: { after: 80 } }));
        continue;
      }
      if (/^#{2,4}\s/.test(t)) { out.push(new docx.Paragraph({ children: runs(t.replace(/^#+\s*/, ''), { bold: true }), spacing: { before: 160, after: 60 }, keepNext: true })); continue; }
      if (/^[-•*]\s+/.test(t)) { out.push(new docx.Paragraph({ children: runs(t.replace(/^[-•*]\s+/, '')), bullet: { level: /^\s{2,}/.test(l) ? 1 : 0 }, spacing: { after: 40 } })); continue; }
      out.push(new docx.Paragraph({ children: runs(t), spacing: { after: 100 }, alignment: docx.AlignmentType.JUSTIFIED }));
    }
    return out;
  }

  async function build({ title, school, sections, confidential = true }) {
    const children = [
      new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, spacing: { after: 240 }, children: [new docx.TextRun({ text: title.toUpperCase(), bold: true, size: 28, font: FONT })] })
    ];
    for (const s of sections) {
      if (!s.content || !String(s.content).trim()) continue;
      if (s.title && s.key !== 'tresc') children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: s.title, bold: true, size: 24, font: FONT, color: '1F3A68' })], spacing: { before: 280, after: 100 }, keepNext: true, border: { bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: 'C9D3E3', space: 2 } } }));
      children.push(...blocks(s.content));
    }
    const doc = new docx.Document({
      creator: 'Asystent IPET',
      title,
      styles: { default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { line: 276 } } } } },
      sections: [{
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        headers: { default: new docx.Header({ children: [new docx.Paragraph({ alignment: docx.AlignmentType.RIGHT, children: [new docx.TextRun({ text: school || '', size: 16, color: '7A7A7A', font: FONT })] })] }) },
        footers: {
          default: new docx.Footer({
            children: [new docx.Paragraph({
              alignment: docx.AlignmentType.CENTER,
              children: [
                new docx.TextRun({ text: confidential ? 'Dokument zawiera dane osobowe ucznia – poufne. ' : '', size: 16, color: '7A7A7A', font: FONT }),
                new docx.TextRun({ children: ['Strona ', docx.PageNumber.CURRENT, ' z ', docx.PageNumber.TOTAL_PAGES], size: 16, color: '7A7A7A', font: FONT })
              ]
            })]
          })
        },
        children
      }]
    });
    return docx.Packer.toBase64String(doc);
  }

  window.DocxExport = { build };
})();
