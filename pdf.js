/**
 * pdf.js — NoteGrid
 * Rendering engine: draws the worksheet onto a canvas (for live preview)
 * and generates a jsPDF document with the same layout.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function parseFraction(str) {
  str = String(str).trim();
  if (str.includes('/')) {
    const [a, b] = str.split('/').map(Number);
    return (a && b) ? a / b : 1;
  }
  return parseFloat(str) || 1;
}

function formatLabel(value, mode) {
  if (mode === 'none') return null;
  if (mode === 'decimal') return value.toFixed(2).replace(/\.?0+$/, '');

  // fraction mode — keep denominator from step if possible, else simplify
  const frac = toNiceFraction(value);
  return frac;
}

function toNiceFraction(value) {
  if (Number.isInteger(value)) return String(value);
  const dens = [2, 3, 4, 5, 6, 8, 10, 12];
  for (const d of dens) {
    const n = Math.round(value * d);
    if (Math.abs(n / d - value) < 0.0001) {
      const whole = Math.floor(n / d);
      const rem = n % d;
      if (rem === 0) return String(whole);
      if (whole === 0) return `${rem}/${d}`;
      return `${whole} ${Math.abs(rem)}/${d}`;
    }
  }
  return value.toFixed(2).replace(/\.?0+$/, '');
}

// ── Core draw function ────────────────────────────────────────────────────────
// Works on an abstract "context" adapter so the same logic renders
// to both Canvas2D (preview) and jsPDF (export).

function buildLayout(cfg) {
  // Resolve active sections and their pixel heights
  const active = cfg.sections.filter(s => s.enabled);
  const total = active.reduce((sum, s) => sum + s.pct, 0) || 100;
  let y = 0;
  return active.map(s => {
    const h = (s.pct / total) * cfg.pageH;
    const seg = { id: s.id, y, h };
    y += h;
    return seg;
  });
}

// ── Canvas 2D renderer (live preview) ────────────────────────────────────────

function renderToCanvas(canvas, cfg) {
  const W = cfg.pageW;
  const H = cfg.pageH;

  // Scale to fit container nicely
  const wrap = canvas.parentElement;
  const maxW = wrap ? wrap.clientWidth - 40 : W;
  const maxH = wrap ? wrap.clientHeight - 40 : H;
  const scale = Math.min(1, maxW / W, maxH / H);

  canvas.width  = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  canvas.style.width  = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  drawSheet(ctx, W, H, cfg);
}

function drawSheet(ctx, W, H, cfg) {
  const layout = buildLayout(cfg);

  for (const seg of layout) {
    if (seg.id === 'task')   drawTaskSection(ctx, 0, seg.y, W, seg.h, cfg);
    if (seg.id === 'grid')   drawGridSection(ctx, 0, seg.y, W, seg.h, cfg);
    if (seg.id === 'work')   drawWorkSection(ctx, 0, seg.y, W, seg.h, cfg);
  }

  // Outer border
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(0, 0, W, H);
}

// Task (polecenie) section
function drawTaskSection(ctx, x, y, w, h, cfg) {
  const bg = cfg.colors.taskBg;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Thin bottom border
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();

  // Text
  if (cfg.taskText) {
    ctx.fillStyle = cfg.colors.taskText;
    ctx.font = `${cfg.taskFontSize}px 'IBM Plex Sans', sans-serif`;
    const pad = 16;
    const lineH = cfg.taskFontSize * 1.5;
    const words = cfg.taskText.split(' ');
    let line = '', lineY = y + pad + cfg.taskFontSize;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > w - pad * 2 && line) {
        ctx.fillText(line, x + pad, lineY);
        line = word; lineY += lineH;
        if (lineY > y + h - 4) break;
      } else line = test;
    }
    if (line) ctx.fillText(line, x + pad, lineY);
  } else {
    // Placeholder lines
    ctx.fillStyle = cfg.colors.grid;
    const pad = 16; const lh = 22;
    let ly = y + lh + 8;
    while (ly < y + h - 8) {
      ctx.fillRect(x + pad, ly, w - pad * 2, 0.8);
      ly += lh;
    }
  }

  // Label badge
  ctx.fillStyle = cfg.colors.grid;
  ctx.font = `500 9px 'IBM Plex Mono', monospace`;
  ctx.fillText('POLECENIE', x + 10, y + 10);
}

// Grid (układ współrzędnych) section
function drawGridSection(ctx, x, y, w, h, cfg) {
  ctx.fillStyle = cfg.colors.gridBg;
  ctx.fillRect(x, y, w, h);

  const step = parseFraction(cfg.step);
  const xMin = cfg.xMin, xMax = cfg.xMax;
  const yMin = cfg.yMin, yMax = cfg.yMax;

  const rangeX = xMax - xMin;
  const rangeY = yMax - yMin;

  const pad = 36; // space for labels
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const scaleX = innerW / rangeX;
  const scaleY = innerH / rangeY;

  const originX = x + pad + (-xMin) * scaleX;
  const originY = y + pad + (yMax) * scaleY;

  // Grid lines
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = cfg.gridLineW;

  // Vertical grid
  let gx = Math.ceil(xMin / step) * step;
  while (gx <= xMax + 0.001) {
    const px = x + pad + (gx - xMin) * scaleX;
    ctx.beginPath(); ctx.moveTo(px, y + pad); ctx.lineTo(px, y + pad + innerH); ctx.stroke();
    gx = Math.round((gx + step) * 10000) / 10000;
  }

  // Horizontal grid
  let gy = Math.ceil(yMin / step) * step;
  while (gy <= yMax + 0.001) {
    const py = y + pad + (yMax - gy) * scaleY;
    ctx.beginPath(); ctx.moveTo(x + pad, py); ctx.lineTo(x + pad + innerW, py); ctx.stroke();
    gy = Math.round((gy + step) * 10000) / 10000;
  }

  // Axes
  ctx.strokeStyle = cfg.colors.axes;
  ctx.lineWidth = cfg.boldAxes ? cfg.axisLineW : cfg.gridLineW * 1.5;

  // X axis
  if (originY >= y + pad && originY <= y + pad + innerH) {
    ctx.beginPath(); ctx.moveTo(x + pad, originY); ctx.lineTo(x + pad + innerW, originY); ctx.stroke();
  }
  // Y axis
  if (originX >= x + pad && originX <= x + pad + innerW) {
    ctx.beginPath(); ctx.moveTo(originX, y + pad); ctx.lineTo(originX, y + pad + innerH); ctx.stroke();
  }

  // Arrows
  if (cfg.showArrows) {
    const arr = 7;
    ctx.strokeStyle = cfg.colors.axes;
    ctx.lineWidth = cfg.axisLineW;
    // X arrow (right)
    const axEnd = x + pad + innerW;
    if (originY >= y + pad && originY <= y + pad + innerH) {
      ctx.beginPath(); ctx.moveTo(axEnd, originY); ctx.lineTo(axEnd - arr, originY - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(axEnd, originY); ctx.lineTo(axEnd - arr, originY + 4); ctx.stroke();
    }
    // Y arrow (top)
    const ayEnd = y + pad;
    if (originX >= x + pad && originX <= x + pad + innerW) {
      ctx.beginPath(); ctx.moveTo(originX, ayEnd); ctx.lineTo(originX - 4, ayEnd + arr); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(originX, ayEnd); ctx.lineTo(originX + 4, ayEnd + arr); ctx.stroke();
    }
  }

  // Axis letters
  if (cfg.showAxisLabels) {
    ctx.fillStyle = cfg.colors.axes;
    ctx.font = `600 ${cfg.labelFontSize + 2}px 'IBM Plex Sans', sans-serif`;
    if (originY >= y + pad && originY <= y + pad + innerH)
      ctx.fillText('x', x + pad + innerW + 6, originY + 4);
    if (originX >= x + pad && originX <= x + pad + innerW)
      ctx.fillText('y', originX + 5, y + pad - 6);
  }

  // Tick labels
  if (cfg.labelType !== 'none') {
    ctx.fillStyle = cfg.colors.axes;
    ctx.font = `${cfg.labelFontSize}px 'IBM Plex Mono', monospace`;
    ctx.textAlign = 'center';

    // X axis ticks
    let lx = Math.ceil(xMin / step) * step;
    while (lx <= xMax + 0.001) {
      if (Math.abs(lx) > 0.0001) {
        const px = x + pad + (lx - xMin) * scaleX;
        const label = formatLabel(lx, cfg.labelType);
        if (label) {
          ctx.fillText(label, px, originY + cfg.labelFontSize + 4);
          ctx.strokeStyle = cfg.colors.axes; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(px, originY - 3); ctx.lineTo(px, originY + 3); ctx.stroke();
        }
      }
      lx = Math.round((lx + step) * 10000) / 10000;
    }

    // Y axis ticks
    ctx.textAlign = 'right';
    let ly = Math.ceil(yMin / step) * step;
    while (ly <= yMax + 0.001) {
      if (Math.abs(ly) > 0.0001) {
        const py = y + pad + (yMax - ly) * scaleY;
        const label = formatLabel(ly, cfg.labelType);
        if (label) {
          ctx.fillText(label, originX - 5, py + 3);
          ctx.strokeStyle = cfg.colors.axes; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(originX - 3, py); ctx.lineTo(originX + 3, py); ctx.stroke();
        }
      }
      ly = Math.round((ly + step) * 10000) / 10000;
    }
    ctx.textAlign = 'left';
  }

  // Border
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + pad, y + pad, innerW, innerH);
}

// Work (obliczenia) section — clean blank space
function drawWorkSection(ctx, x, y, w, h, cfg) {
  ctx.fillStyle = cfg.colors.workBg;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();

  // Label
  ctx.fillStyle = cfg.colors.grid;
  ctx.font = `500 9px 'IBM Plex Mono', monospace`;
  ctx.fillText('OBLICZENIA', x + 10, y + 10);
}

// ── jsPDF export ──────────────────────────────────────────────────────────────

function generatePDF(cfg) {
  const { jsPDF } = window.jspdf;
  const W = cfg.pageW, H = cfg.pageH;

  const doc = new jsPDF({
    orientation: W >= H ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [W, H],
  });

  const layout = buildLayout(cfg);

  for (const seg of layout) {
    if (seg.id === 'task') pdfTaskSection(doc, 0, seg.y, W, seg.h, cfg);
    if (seg.id === 'grid') pdfGridSection(doc, 0, seg.y, W, seg.h, cfg);
    if (seg.id === 'work') pdfWorkSection(doc, 0, seg.y, W, seg.h, cfg);
  }

  // Outer border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(0, 0, W, H, 'S');

  return doc;
}

function pdfTaskSection(doc, x, y, w, h, cfg) {
  const bg = hexToRgb(cfg.colors.taskBg);
  doc.setFillColor(...bg);
  doc.rect(x, y, w, h, 'F');

  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(0.8);
  doc.line(x, y + h, x + w, y + h);

  // Badge
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(cfg.colors.grid));
  doc.text('POLECENIE', x + 10, y + 9);

  // Task text
  if (cfg.taskText) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(cfg.taskFontSize);
    doc.setTextColor(...hexToRgb(cfg.colors.taskText));
    const pad = 16;
    const lines = doc.splitTextToSize(cfg.taskText, w - pad * 2);
    doc.text(lines, x + pad, y + pad + cfg.taskFontSize, { maxHeight: h - pad * 2 });
  } else {
    // placeholder lines
    doc.setDrawColor(...hexToRgb(cfg.colors.grid));
    doc.setLineWidth(0.5);
    const pad = 16, lh = 22;
    let ly = y + lh + 8;
    while (ly < y + h - 8) {
      doc.line(x + pad, ly, x + w - pad, ly);
      ly += lh;
    }
  }
}

function pdfGridSection(doc, x, y, w, h, cfg) {
  const bg = hexToRgb(cfg.colors.gridBg);
  doc.setFillColor(...bg);
  doc.rect(x, y, w, h, 'F');

  const step = parseFraction(cfg.step);
  const xMin = cfg.xMin, xMax = cfg.xMax;
  const yMin = cfg.yMin, yMax = cfg.yMax;
  const rangeX = xMax - xMin;
  const rangeY = yMax - yMin;

  const pad = 36;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const scaleX = innerW / rangeX;
  const scaleY = innerH / rangeY;
  const originX = x + pad + (-xMin) * scaleX;
  const originY = y + pad + (yMax) * scaleY;

  // Grid
  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(cfg.gridLineW);

  let gx = Math.ceil(xMin / step) * step;
  while (gx <= xMax + 0.001) {
    const px = x + pad + (gx - xMin) * scaleX;
    doc.line(px, y + pad, px, y + pad + innerH);
    gx = Math.round((gx + step) * 10000) / 10000;
  }
  let gy = Math.ceil(yMin / step) * step;
  while (gy <= yMax + 0.001) {
    const py = y + pad + (yMax - gy) * scaleY;
    doc.line(x + pad, py, x + pad + innerW, py);
    gy = Math.round((gy + step) * 10000) / 10000;
  }

  // Axes
  doc.setDrawColor(...hexToRgb(cfg.colors.axes));
  doc.setLineWidth(cfg.boldAxes ? cfg.axisLineW : cfg.gridLineW * 1.8);

  if (originY >= y + pad && originY <= y + pad + innerH)
    doc.line(x + pad, originY, x + pad + innerW, originY);
  if (originX >= x + pad && originX <= x + pad + innerW)
    doc.line(originX, y + pad, originX, y + pad + innerH);

  // Arrows
  if (cfg.showArrows) {
    const arr = 7;
    doc.setLineWidth(cfg.axisLineW);
    const axEnd = x + pad + innerW;
    if (originY >= y + pad && originY <= y + pad + innerH) {
      doc.line(axEnd, originY, axEnd - arr, originY - 4);
      doc.line(axEnd, originY, axEnd - arr, originY + 4);
    }
    const ayEnd = y + pad;
    if (originX >= x + pad && originX <= x + pad + innerW) {
      doc.line(originX, ayEnd, originX - 4, ayEnd + arr);
      doc.line(originX, ayEnd, originX + 4, ayEnd + arr);
    }
  }

  // Axis labels
  if (cfg.showAxisLabels) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(cfg.labelFontSize + 2);
    doc.setTextColor(...hexToRgb(cfg.colors.axes));
    if (originY >= y + pad && originY <= y + pad + innerH)
      doc.text('x', x + pad + innerW + 5, originY + 4);
    if (originX >= x + pad && originX <= x + pad + innerW)
      doc.text('y', originX + 4, y + pad - 5);
  }

  // Tick labels
  if (cfg.labelType !== 'none') {
    doc.setFont('Courier', 'normal');
    doc.setFontSize(cfg.labelFontSize);
    doc.setTextColor(...hexToRgb(cfg.colors.axes));

    let lx = Math.ceil(xMin / step) * step;
    while (lx <= xMax + 0.001) {
      if (Math.abs(lx) > 0.0001) {
        const px = x + pad + (lx - xMin) * scaleX;
        const label = formatLabel(lx, cfg.labelType);
        if (label && originY >= y + pad && originY <= y + pad + innerH) {
          doc.text(label, px, originY + cfg.labelFontSize + 3, { align: 'center' });
          doc.setDrawColor(...hexToRgb(cfg.colors.axes));
          doc.setLineWidth(0.6);
          doc.line(px, originY - 3, px, originY + 3);
        }
      }
      lx = Math.round((lx + step) * 10000) / 10000;
    }

    let ly = Math.ceil(yMin / step) * step;
    while (ly <= yMax + 0.001) {
      if (Math.abs(ly) > 0.0001) {
        const py = y + pad + (yMax - ly) * scaleY;
        const label = formatLabel(ly, cfg.labelType);
        if (label && originX >= x + pad && originX <= x + pad + innerW) {
          doc.text(label, originX - 4, py + 3, { align: 'right' });
          doc.setDrawColor(...hexToRgb(cfg.colors.axes));
          doc.setLineWidth(0.6);
          doc.line(originX - 3, py, originX + 3, py);
        }
      }
      ly = Math.round((ly + step) * 10000) / 10000;
    }
  }

  // Inner border
  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(0.5);
  doc.rect(x + pad, y + pad, innerW, innerH, 'S');

  // Badge
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('UKŁAD WSPÓŁRZĘDNYCH', x + pad + 4, y + pad + 8);
}

function pdfWorkSection(doc, x, y, w, h, cfg) {
  const bg = hexToRgb(cfg.colors.workBg);
  doc.setFillColor(...bg);
  doc.rect(x, y, w, h, 'F');

  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(0.8);
  doc.line(x, y, x + w, y);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(cfg.colors.grid));
  doc.text('OBLICZENIA', x + 10, y + 9);
}

window.NoteGridPDF = { renderToCanvas, generatePDF };