const { jsPDF } = window.jspdf;

document.addEventListener("DOMContentLoaded", () => {
  const typeSelect = document.getElementById("type");
  const toggleAdvanced = document.getElementById("toggleAdvanced");
  const advancedOptions = document.getElementById("advancedOptions");
  const preview = document.getElementById("preview");

  typeSelect.addEventListener("change", () => {
    const type = typeSelect.value;
    document.getElementById("unitContainer").classList.toggle("hidden", type === "table");
    document.getElementById("fractionTypeContainer").classList.toggle("hidden", type === "table");
    document.getElementById("colsContainer").classList.toggle("hidden", type === "grid");
    document.getElementById("rowsContainer").classList.toggle("hidden", type === "grid");
  });

  toggleAdvanced.addEventListener("click", () => {
    advancedOptions.classList.toggle("hidden");
    toggleAdvanced.textContent = advancedOptions.classList.contains("hidden")
      ? "Pokaż zaawansowane opcje"
      : "Ukryj zaawansowane opcje";
  });

  document.getElementById("generateBtn").addEventListener("click", generatePDF);

  function generatePDF() {
    const type = document.getElementById("type").value;
    const orientation = document.getElementById("orientation").value;
    const unit = document.getElementById("unit").value;
    const fractionType = document.getElementById("fractionType").value;
    const cols = parseInt(document.getElementById("cols").value);
    const rows = parseInt(document.getElementById("rows").value);
    const gridColor = document.getElementById("gridColor").value;
    const gridSize = parseInt(document.getElementById("gridSize").value);
    const addHeader = document.getElementById("addHeader").checked;
    const addFooter = document.getElementById("addFooter").checked;
    const addMargins = document.getElementById("addMargins").checked;

    const format =
      orientation === "square"
        ? [500, 500]
        : "a4";

    const doc = new jsPDF({
      orientation: orientation === "landscape" ? "landscape" : "portrait",
      unit: "pt",
      format,
    });

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, width, height, "F");

    if (addHeader) doc.text("Nagłówek", width / 2 - 25, 25);
    if (addFooter) doc.text("Stopka", width / 2 - 20, height - 20);

    doc.setDrawColor(...hexToRgb(gridColor));

    if (type === "grid") drawGrid(doc, width, height, gridSize, unit, fractionType, addMargins);
    else drawTable(doc, width, height, cols, rows);

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);

    preview.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none"></iframe>`;
  }

  function drawGrid(doc, width, height, spacing, unitText, fractionType, addMargins) {
    const margin = addMargins ? 40 : 0;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let x = centerX; x <= width - margin; x += spacing) {
      doc.line(x, margin, x, height - margin);
      doc.line(centerX - (x - centerX), margin, centerX - (x - centerX), height - margin);
    }
    for (let y = centerY; y <= height - margin; y += spacing) {
      doc.line(margin, y, width - margin, y);
      doc.line(margin, centerY - (y - centerY), width - margin, centerY - (y - centerY));
    }

    doc.setDrawColor(255, 255, 255);
    doc.line(centerX, margin, centerX, height - margin);
    doc.line(margin, centerY, width - margin, centerY);

    doc.setTextColor(255, 255, 255);
    doc.text("x", width - margin - 10, centerY - 5);
    doc.text("y", centerX + 5, margin + 10);

    const stepFraction = parseFraction(unitText);
    const rangeX = Math.floor((width / 2) / spacing);
    const rangeY = Math.floor((height / 2) / spacing);
    const fixedDen = stepFraction.den; // stały mianownik z jednostki
    const stepValue = stepFraction.num / fixedDen;
    doc.setFontSize(8);

    for (let i = 1; i <= rangeX; i++) {
      const val = i * stepValue;
      const label = fractionType === "fraction" ? toFixedDenominator(val, fixedDen) : val.toFixed(2);
      const posR = centerX + i * spacing;
      const posL = centerX - i * spacing;
      doc.text(label, posR - 5, centerY + 12);
      doc.text("-" + label, posL - 10, centerY + 12);
      doc.line(posR, centerY - 3, posR, centerY + 3);
      doc.line(posL, centerY - 3, posL, centerY + 3);
    }

    for (let j = 1; j <= rangeY; j++) {
      const val = j * stepValue;
      const label = fractionType === "fraction" ? toFixedDenominator(val, fixedDen) : val.toFixed(2);
      const posU = centerY - j * spacing;
      const posD = centerY + j * spacing;
      doc.text(label, centerX + 6, posU + 3);
      doc.text("-" + label, centerX + 6, posD + 3);
      doc.line(centerX - 3, posU, centerX + 3, posU);
      doc.line(centerX - 3, posD, centerX + 3, posD);
    }
  }

  function drawTable(doc, width, height, cols, rows) {
    const cellW = width / cols;
    const cellH = height / rows;
    doc.setDrawColor(255, 255, 255);
    for (let i = 0; i <= cols; i++) doc.line(i * cellW, 0, i * cellW, height);
    for (let j = 0; j <= rows; j++) doc.line(0, j * cellH, width, j * cellH);
  }

  // Parsowanie jednostki np. "1/10" -> { num: 1, den: 10 }
  function parseFraction(str) {
    if (str.includes("/")) {
      const [a, b] = str.split("/").map(Number);
      return { num: a, den: b };
    }
    const val = parseFloat(str) || 1;
    return { num: val, den: 1 };
  }

  // Stały mianownik — np. 1/10 → 1/10, 2/10, 3/10, 1, 1 1/10, ...
  function toFixedDenominator(value, fixedDen) {
    const totalNum = Math.round(value * fixedDen);
    const whole = Math.floor(totalNum / fixedDen);
    const num = totalNum % fixedDen;

    if (num === 0) return `${whole}`;
    if (whole === 0) return `${num}/${fixedDen}`;
    return `${whole} ${num}/${fixedDen}`;
  }

  function hexToRgb(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }
});
