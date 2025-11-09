const { jsPDF } = window.jspdf;

document.addEventListener("DOMContentLoaded", () => {
  const typeSelect = document.getElementById("type");
  const unitContainer = document.getElementById("unitContainer");
  const tableOptions = document.getElementById("tableOptions");
  const advancedSettings = document.getElementById("advancedSettings");
  const toggleBtn = document.getElementById("toggleAdvanced");
  const status = document.getElementById("status");

  // przełączanie typu dokumentu
  typeSelect.addEventListener("change", () => {
    const type = typeSelect.value;
    unitContainer.classList.toggle("hidden", type === "table");
    tableOptions.classList.toggle("hidden", type === "grid");
  });

  // rozwijanie ustawień
  toggleBtn.addEventListener("click", () => {
    advancedSettings.classList.toggle("hidden");
    toggleBtn.textContent = advancedSettings.classList.contains("hidden")
      ? "⚙️ Pokaż ustawienia zaawansowane"
      : "⬆️ Ukryj ustawienia zaawansowane";
  });

  document.getElementById("generateBtn").addEventListener("click", generatePDF);

  // funkcje pomocnicze
  function fractionToFloat(str) {
    try {
      if (str.includes("/")) {
        const [a, b] = str.split("/").map(Number);
        return a / b;
      }
      return parseFloat(str);
    } catch {
      return 1;
    }
  }

  function toFractionString(value) {
    const fraction = approximateFraction(value);
    if (fraction.den === 1) return `${fraction.num}`;
    if (Math.abs(fraction.num) > fraction.den) {
      const whole = Math.trunc(fraction.num / fraction.den);
      const rem = Math.abs(fraction.num % fraction.den);
      return `${whole} ${rem}/${fraction.den}`;
    }
    return `${fraction.num}/${fraction.den}`;
  }

  function approximateFraction(x, maxDen = 8) {
    let best = { num: Math.round(x), den: 1 };
    let minErr = Math.abs(best.num / best.den - x);
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(x * d);
      const err = Math.abs(n / d - x);
      if (err < minErr) {
        best = { num: n, den: d };
        minErr = err;
      }
    }
    return best;
  }

  function hexToRGB(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }

  function generatePDF() {
    const type = document.getElementById("type").value;
    const orientation = document.getElementById("orientation").value;
    const unitInput = document.getElementById("unit").value;
    const unit = fractionToFloat(unitInput);
    const cols = parseInt(document.getElementById("cols")?.value || 5);
    const rows = parseInt(document.getElementById("rows")?.value || 5);
    const spacingCm = parseFloat(document.getElementById("spacing")?.value || 1);
    const valueStyle = document.getElementById("valueStyle")?.value || "fraction";

    const [bgR, bgG, bgB] = hexToRGB(document.getElementById("bgColor")?.value || "#000000");
    const [gridR, gridG, gridB] = hexToRGB(document.getElementById("gridColor")?.value || "#555555");
    const [axisR, axisG, axisB] = hexToRGB(document.getElementById("axisColor")?.value || "#FFFFFF");

    const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(0, 0, width, height, "F");
    doc.setTextColor(axisR, axisG, axisB);

    if (type === "grid") {
      drawGrid(doc, width, height, unit, unitInput, spacingCm, valueStyle, gridR, gridG, gridB, axisR, axisG, axisB);
      const name = `siatka_${unitInput.replace("/", "-")}.pdf`;
      doc.save(name);
      status.textContent = `✅ Wygenerowano ${name}`;
    } else {
      drawTable(doc, width, height, cols, rows, axisR, axisG, axisB);
      const name = `tabela_${cols}x${rows}.pdf`;
      doc.save(name);
      status.textContent = `✅ Wygenerowano ${name}`;
    }
  }

  function drawGrid(doc, width, height, unit, unitText, spacingCm, valueStyle, gridR, gridG, gridB, axisR, axisG, axisB) {
    const centerX = width / 2;
    const centerY = height / 2;
    const spacing = 28.35 * spacingCm;

    // siatka
    doc.setDrawColor(gridR, gridG, gridB);
    for (let x = centerX; x <= width; x += spacing) {
      doc.line(x, 0, x, height);
      doc.line(centerX - (x - centerX), 0, centerX - (x - centerX), height);
    }
    for (let y = centerY; y <= height; y += spacing) {
      doc.line(0, y, width, y);
      doc.line(0, centerY - (y - centerY), width, centerY - (y - centerY));
    }

    // osie
    doc.setDrawColor(axisR, axisG, axisB);
    doc.setLineWidth(1);
    doc.line(centerX, 0, centerX, height);
    doc.line(0, centerY, width, centerY);

    // oznaczenia
    doc.setFontSize(10);
    doc.text("x", width - 15, centerY - 5);
    doc.text("y", centerX + 8, 20);

    doc.setFontSize(8);
    const maxX = Math.floor(width / (2 * spacing));
    const maxY = Math.floor(height / (2 * spacing));

    for (let i = -maxX; i <= maxX; i++) {
      if (i === 0) continue;
      const val = i * unit;
      const label = valueStyle === "fraction" ? toFractionString(val) : val.toFixed(2);
      const xPos = centerX + i * spacing;
      doc.text(label, xPos - 5, centerY - 10, { align: "center" });
      doc.line(xPos, centerY - 3, xPos, centerY + 3);
    }

    for (let j = -maxY; j <= maxY; j++) {
      if (j === 0) continue;
      const val = j * unit;
      const label = valueStyle === "fraction" ? toFractionString(val) : val.toFixed(2);
      const yPos = centerY - j * spacing;
      doc.text(label, centerX + 8, yPos + 3);
      doc.line(centerX - 3, yPos, centerX + 3, yPos);
    }

    doc.setFontSize(9);
    doc.text(`Jednostka osi = ${unitText}`, 40, height - 40);
  }

  function drawTable(doc, width, height, cols, rows, axisR, axisG, axisB) {
    const cellW = width / cols;
    const cellH = height / rows;
    doc.setDrawColor(axisR, axisG, axisB);
    for (let i = 0; i <= cols; i++) doc.line(i * cellW, 0, i * cellW, height);
    for (let j = 0; j <= rows; j++) doc.line(0, j * cellH, width, j * cellH);
  }
});
