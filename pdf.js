/**
 * pdf.js — NoteGrid rendering engine
 * Shared logic for canvas preview and jsPDF export.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const c = parseInt(hex.replace('#', ''), 16);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

function parseFraction(str) {
  str = String(str).trim();
  if (str.includes('/')) {
    const [a, b] = str.split('/').map(Number);
    return (a && b) ? a / b : 1;
  }
  return parseFloat(str) || 1;
}

function niceLabel(value, mode) {
  if (mode === 'none') return null;
  if (mode === 'decimal') {
    const s = value.toFixed(4).replace(/\.?0+$/, '');
    return s === '-0' ? '0' : s;
  }
  // fraction
  if (Number.isInteger(value)) return String(value);
  for (const d of [2, 3, 4, 5, 6, 8, 10, 12]) {
    const n = Math.round(value * d);
    if (Math.abs(n / d - value) < 1e-5) {
      const whole = Math.floor(Math.abs(n) / d);
      const rem   = Math.abs(n) % d;
      const sign  = value < 0 ? '-' : '';
      if (rem === 0) return sign + whole;
      if (whole === 0) return `${sign}${rem}/${d}`;
      return `${sign}${whole} ${rem}/${d}`;
    }
  }
  return value.toFixed(2).replace(/\.?0+$/, '');
}

// ── Layout builder ────────────────────────────────────────────────────────────

function buildLayout(cfg) {
  const active = cfg.sections.filter(s => s.enabled);
  const total  = active.reduce((a, s) => a + s.pct, 0) || 100;
  let y = 0;
  return active.map(s => {
    const h = (s.pct / total) * cfg.pageH;
    const seg = { id: s.id, y, h };
    y += h;
    return seg;
  });
}

// ── Canvas preview ────────────────────────────────────────────────────────────

function renderToCanvas(canvas, cfg) {
  const W = cfg.pageW, H = cfg.pageH;

  // Walk up to find the scrollable .preview container (not .preview-inner)
  // so we get the true available width, not the canvas's own parent width.
  let container = canvas.parentElement;
  while (container && !container.classList.contains('preview')) {
    container = container.parentElement;
  }
  // Fallback: use direct parent
  if (!container) container = canvas.parentElement;

  // Available width = container inner width minus padding
  const style   = window.getComputedStyle(container);
  const padH    = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const availW  = container.clientWidth - padH;

  // Scale: fit width exactly, height follows aspect ratio
  const scale = availW / W;
  const displayW = Math.round(availW);
  const displayH = Math.round(H * scale);

  // HiDPI: render at device pixel ratio for sharpness
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = displayW * dpr;
  canvas.height = displayH * dpr;

  // CSS size — 100% width handled by stylesheet, explicit height needed
  canvas.style.width  = displayW + 'px';
  canvas.style.height = displayH + 'px';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale * dpr, scale * dpr);
  drawSheet_ctx(ctx, W, H, cfg);
  ctx.restore();
}

function drawSheet_ctx(ctx, W, H, cfg) {
  const layout = buildLayout(cfg);
  for (const seg of layout) {
    switch (seg.id) {
      case 'task': drawTask_ctx(ctx, 0, seg.y, W, seg.h, cfg); break;
      case 'grid': drawGrid_ctx(ctx, 0, seg.y, W, seg.h, cfg); break;
      case 'work': drawWork_ctx(ctx, 0, seg.y, W, seg.h, cfg); break;
    }
  }
  // Sheet shadow / border
  ctx.strokeStyle = '#c8c0b8';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(0, 0, W, H);
}

// ── Task section (canvas) ─────────────────────────────────────────────────────
function drawTask_ctx(ctx, x, y, w, h, cfg) {
  // Background
  ctx.fillStyle = cfg.colors.taskBg;
  ctx.fillRect(x, y, w, h);

  // Separator line at bottom
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();

  // Badge
  ctx.fillStyle = cfg.colors.grid;
  ctx.font = `500 8px 'DM Sans', sans-serif`;
  ctx.fillText('POLECENIE', x + 14, y + 11);

  // Placeholder ruled lines
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.5;
  const pad = 14, lh = Math.max(18, h / 5);
  let ly = y + lh + 6;
  while (ly < y + h - 6) {
    ctx.beginPath(); ctx.moveTo(x + pad, ly); ctx.lineTo(x + w - pad, ly); ctx.stroke();
    ly += lh;
  }
}

// ── Grid section (canvas) ─────────────────────────────────────────────────────
function drawGrid_ctx(ctx, x, y, w, h, cfg) {
  ctx.fillStyle = cfg.colors.gridBg;
  ctx.fillRect(x, y, w, h);

  const step = parseFraction(cfg.step);
  const { xMin, xMax, yMin, yMax } = cfg;
  const mg = computeMargins(cfg);

  const innerX = x + mg.left;
  const innerY = y + mg.top;
  const innerW = w - mg.left - mg.right;
  const innerH = h - mg.top  - mg.bottom;
  if (innerW <= 0 || innerH <= 0) return;

  const sx = innerW / (xMax - xMin);
  const sy = innerH / (yMax - yMin);
  const ox = innerX + (-xMin) * sx;
  const oy = innerY + (yMax)  * sy;

  // Clip to inner area
  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();

  // Grid lines
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = cfg.gridLineW;

  for (let gx = snapUp(xMin, step); gx <= xMax + 1e-4; gx = round4(gx + step)) {
    const px = innerX + (gx - xMin) * sx;
    ctx.beginPath(); ctx.moveTo(px, innerY); ctx.lineTo(px, innerY + innerH); ctx.stroke();
  }
  for (let gy = snapUp(yMin, step); gy <= yMax + 1e-4; gy = round4(gy + step)) {
    const py = innerY + (yMax - gy) * sy;
    ctx.beginPath(); ctx.moveTo(innerX, py); ctx.lineTo(innerX + innerW, py); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = cfg.colors.axes;
  ctx.lineWidth = cfg.boldAxes ? cfg.axisLineW : cfg.gridLineW * 1.6;

  if (oy >= innerY && oy <= innerY + innerH) {
    ctx.beginPath(); ctx.moveTo(innerX, oy); ctx.lineTo(innerX + innerW, oy); ctx.stroke();
  }
  if (ox >= innerX && ox <= innerX + innerW) {
    ctx.beginPath(); ctx.moveTo(ox, innerY); ctx.lineTo(ox, innerY + innerH); ctx.stroke();
  }

  // Arrows
  if (cfg.showArrows) {
    const a = 7;
    ctx.strokeStyle = cfg.colors.axes;
    ctx.lineWidth = cfg.axisLineW;
    const xr = innerX + innerW, yt = innerY;
    if (inRange(oy, innerY, innerY + innerH)) {
      ctx.beginPath(); ctx.moveTo(xr, oy); ctx.lineTo(xr - a, oy - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xr, oy); ctx.lineTo(xr - a, oy + 4); ctx.stroke();
    }
    if (inRange(ox, innerX, innerX + innerW)) {
      ctx.beginPath(); ctx.moveTo(ox, yt); ctx.lineTo(ox - 4, yt + a); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, yt); ctx.lineTo(ox + 4, yt + a); ctx.stroke();
    }
  }

  ctx.restore();

  // Axis name labels outside clip
  if (cfg.showAxisLabels) {
    ctx.fillStyle = cfg.colors.axes;
    ctx.font = `600 ${cfg.labelFontSize + 2}px 'Lora', serif`;
    if (inRange(oy, innerY, innerY + innerH))
      ctx.fillText('x', innerX + innerW + 6, oy + 4);
    if (inRange(ox, innerX, innerX + innerW))
      ctx.fillText('y', ox + 5, innerY - 5);
  }

  // Tick labels
  if (cfg.labelType !== 'none') {
    ctx.fillStyle = cfg.colors.axes;
    ctx.font = `${cfg.labelFontSize}px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center';

    for (let lx = snapUp(xMin, step); lx <= xMax + 1e-4; lx = round4(lx + step)) {
      if (Math.abs(lx) < 1e-9) continue;
      const px = innerX + (lx - xMin) * sx;
      if (!inRange(px, innerX, innerX + innerW)) continue;
      const label = niceLabel(lx, cfg.labelType);
      if (!label) continue;
      const lyPos = clamp(oy, innerY, innerY + innerH);
      ctx.fillText(label, px, lyPos + cfg.labelFontSize + 3);
      ctx.strokeStyle = cfg.colors.axes; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(px, lyPos - 3); ctx.lineTo(px, lyPos + 3); ctx.stroke();
    }

    ctx.textAlign = 'right';
    for (let ly = snapUp(yMin, step); ly <= yMax + 1e-4; ly = round4(ly + step)) {
      if (Math.abs(ly) < 1e-9) continue;
      const py = innerY + (yMax - ly) * sy;
      if (!inRange(py, innerY, innerY + innerH)) continue;
      const label = niceLabel(ly, cfg.labelType);
      if (!label) continue;
      const lxPos = clamp(ox, innerX, innerX + innerW);
      ctx.fillText(label, lxPos - 4, py + 3);
      ctx.strokeStyle = cfg.colors.axes; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(lxPos - 3, py); ctx.lineTo(lxPos + 3, py); ctx.stroke();
    }
    ctx.textAlign = 'left';
  }

  // Inner border
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(innerX, innerY, innerW, innerH);
}

// ── Work section (canvas) ─────────────────────────────────────────────────────
function drawWork_ctx(ctx, x, y, w, h, cfg) {
  ctx.fillStyle = cfg.colors.workBg;
  ctx.fillRect(x, y, w, h);

  // Top line
  ctx.strokeStyle = cfg.colors.grid;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();

  // Badge
  ctx.fillStyle = cfg.colors.grid;
  ctx.font = `500 8px 'DM Sans', sans-serif`;
  ctx.fillText('OBLICZENIA', x + 14, y + 11);
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
    switch (seg.id) {
      case 'task': pdfTask(doc, 0, seg.y, W, seg.h, cfg); break;
      case 'grid': pdfGrid(doc, 0, seg.y, W, seg.h, cfg); break;
      case 'work': pdfWork(doc, 0, seg.y, W, seg.h, cfg); break;
    }
  }
  doc.setDrawColor(200, 194, 186);
  doc.setLineWidth(0.5);
  doc.rect(0, 0, W, H, 'S');
  return doc;
}

function pdfTask(doc, x, y, w, h, cfg) {
  doc.setFillColor(...hexToRgb(cfg.colors.taskBg));
  doc.rect(x, y, w, h, 'F');

  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(0.8);
  doc.line(x, y + h, x + w, y + h);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(cfg.colors.grid));
  doc.text('POLECENIE', x + 14, y + 10);

  // Ruled lines
  doc.setLineWidth(0.4);
  const pad = 14, lh = Math.max(18, h / 5);
  let ly = y + lh + 6;
  while (ly < y + h - 6) {
    doc.line(x + pad, ly, x + w - pad, ly);
    ly += lh;
  }
}

function pdfGrid(doc, x, y, w, h, cfg) {
  doc.setFillColor(...hexToRgb(cfg.colors.gridBg));
  doc.rect(x, y, w, h, 'F');

  const step = parseFraction(cfg.step);
  const { xMin, xMax, yMin, yMax } = cfg;
  const mg = computeMargins(cfg);

  const innerX = x + mg.left;
  const innerY = y + mg.top;
  const innerW = w - mg.left - mg.right;
  const innerH = h - mg.top  - mg.bottom;
  if (innerW <= 0 || innerH <= 0) return;

  const sx = innerW / (xMax - xMin);
  const sy = innerH / (yMax - yMin);
  const ox = innerX + (-xMin) * sx;
  const oy = innerY + (yMax)  * sy;

  // Grid lines
  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(cfg.gridLineW);

  for (let gx = snapUp(xMin, step); gx <= xMax + 1e-4; gx = round4(gx + step)) {
    const px = innerX + (gx - xMin) * sx;
    if (inRange(px, innerX, innerX + innerW))
      doc.line(px, innerY, px, innerY + innerH);
  }
  for (let gy = snapUp(yMin, step); gy <= yMax + 1e-4; gy = round4(gy + step)) {
    const py = innerY + (yMax - gy) * sy;
    if (inRange(py, innerY, innerY + innerH))
      doc.line(innerX, py, innerX + innerW, py);
  }

  // Axes
  doc.setDrawColor(...hexToRgb(cfg.colors.axes));
  doc.setLineWidth(cfg.boldAxes ? cfg.axisLineW : cfg.gridLineW * 1.8);

  if (inRange(oy, innerY, innerY + innerH))
    doc.line(innerX, oy, innerX + innerW, oy);
  if (inRange(ox, innerX, innerX + innerW))
    doc.line(ox, innerY, ox, innerY + innerH);

  // Arrows
  if (cfg.showArrows) {
    const a = 7;
    doc.setLineWidth(cfg.axisLineW);
    const xr = innerX + innerW, yt = innerY;
    if (inRange(oy, innerY, innerY + innerH)) {
      doc.line(xr, oy, xr - a, oy - 4);
      doc.line(xr, oy, xr - a, oy + 4);
    }
    if (inRange(ox, innerX, innerX + innerW)) {
      doc.line(ox, yt, ox - 4, yt + a);
      doc.line(ox, yt, ox + 4, yt + a);
    }
  }

  // Axis labels
  if (cfg.showAxisLabels) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(cfg.labelFontSize + 2);
    doc.setTextColor(...hexToRgb(cfg.colors.axes));
    if (inRange(oy, innerY, innerY + innerH))
      doc.text('x', innerX + innerW + 5, oy + 4);
    if (inRange(ox, innerX, innerX + innerW))
      doc.text('y', ox + 4, innerY - 4);
  }

  // Tick labels
  if (cfg.labelType !== 'none') {
    doc.setFont('Courier', 'normal');
    doc.setFontSize(cfg.labelFontSize);
    doc.setTextColor(...hexToRgb(cfg.colors.axes));

    for (let lx = snapUp(xMin, step); lx <= xMax + 1e-4; lx = round4(lx + step)) {
      if (Math.abs(lx) < 1e-9) continue;
      const px = innerX + (lx - xMin) * sx;
      if (!inRange(px, innerX, innerX + innerW)) continue;
      const label = niceLabel(lx, cfg.labelType);
      if (!label) continue;
      const lyPos = clamp(oy, innerY, innerY + innerH);
      doc.text(label, px, lyPos + cfg.labelFontSize + 2, { align: 'center' });
      doc.setLineWidth(0.6);
      doc.line(px, lyPos - 3, px, lyPos + 3);
    }

    for (let ly = snapUp(yMin, step); ly <= yMax + 1e-4; ly = round4(ly + step)) {
      if (Math.abs(ly) < 1e-9) continue;
      const py = innerY + (yMax - ly) * sy;
      if (!inRange(py, innerY, innerY + innerH)) continue;
      const label = niceLabel(ly, cfg.labelType);
      if (!label) continue;
      const lxPos = clamp(ox, innerX, innerX + innerW);
      doc.text(label, lxPos - 3, py + 3, { align: 'right' });
      doc.setLineWidth(0.6);
      doc.line(lxPos - 3, py, lxPos + 3, py);
    }
  }

  // Inner border
  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(0.5);
  doc.rect(innerX, innerY, innerW, innerH, 'S');
}

function pdfWork(doc, x, y, w, h, cfg) {
  doc.setFillColor(...hexToRgb(cfg.colors.workBg));
  doc.rect(x, y, w, h, 'F');

  doc.setDrawColor(...hexToRgb(cfg.colors.grid));
  doc.setLineWidth(0.8);
  doc.line(x, y, x + w, y);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(cfg.colors.grid));
  doc.text('OBLICZENIA', x + 14, y + 10);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function computeMargins(cfg) {
  const m = cfg.gridMargin || {};
  const def = Math.max(24, cfg.labelFontSize * 3.2);
  return {
    top:    m.top    != null ? Number(m.top)    : def,
    right:  m.right  != null ? Number(m.right)  : def,
    bottom: m.bottom != null ? Number(m.bottom) : def,
    left:   m.left   != null ? Number(m.left)   : def,
  };
}

function snapUp(min, step) {
  return Math.ceil(min / step) * step;
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

function inRange(v, lo, hi) {
  return v >= lo - 0.1 && v <= hi + 0.1;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

window.NoteGridPDF = { renderToCanvas, generatePDF };