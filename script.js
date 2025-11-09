const { jsPDF } = window.jspdf;

document.addEventListener("DOMContentLoaded", () => {
  const typeSelect = document.getElementById("type");
  const unitContainer = document.getElementById("unitContainer");
  const tableOptions = document.getElementById("tableOptions");
  const status = document.getElementById("status");

  typeSelect.addEventListener("change", () => {
    const type = typeSelect.value;
    unitContainer.classList.toggle("hidden", type === "table");
    tableOptions.classList.toggle("hidden", type === "grid");
  });

  document.getElementById("generateBtn").addEventListener("click", generatePDF);

  function generatePDF() {
    const type = document.getElementById("type").value;
    const orientation = document.getElementById("orientation").value;
    const unit = document.getElementById("unit").value;
    const cols = parseInt(document.getElementById("cols").value);
    const rows = parseInt(document.getElementById("rows").value);

    const doc = new jsPDF({
      orientation: orientation === "landscape" ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // tło
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, width, height, "F");

    doc.setDrawColor(255, 255, 255);
    doc.setTextColor(255, 255, 255);

    if (type === "grid") {
      drawGrid(doc, width, height, unit);
      const name = `siatka_dark_${unit.replace("/", "-")}.pdf`;
      doc.save(name);
      status.textContent = `✅ Wygenerowano ${name}`;
    } else {
      drawTable(doc, width, height, cols, rows);
      const name = `tabela_dark_${cols}x${rows}.pdf`;
      doc.save(name);
      status.textContent = `✅ Wygenerowano ${name}`;
    }
  }

  function drawGrid(doc, width, height, unitText) {
    const centerX = width / 2;
    const centerY = height / 2;
    const spacing = 28.35; // 1cm = 28.35pt

    // szare linie siatki
    doc.setDrawColor(100, 100, 100);
    for (let x = centerX; x <= width; x += spacing) {
      doc.line(x, 0, x, height);
      doc.line(centerX - (x - centerX), 0, centerX - (x - centerX), height);
    }
    for (let y = centerY; y <= height; y += spacing) {
      doc.line(0, y, width, y);
      doc.line(0, centerY - (y - centerY), width, centerY - (y - centerY));
    }

    // osie
    doc.setDrawColor(255, 255, 255);
    doc.line(centerX, 0, centerX, height);
    doc.line(0, centerY, width, centerY);

    // podpisy osi
    doc.setFontSize(10);
    doc.text("x", width - 15, centerY - 5);
    doc.text("y", centerX + 5, 15);

    // podpis jednostki
    doc.setFontSize(9);
    doc.text(`Jednostka osi = ${unitText}`, 40, height - 40);
  }

  function drawTable(doc, width, height, cols, rows) {
    const cellW = width / cols;
    const cellH = height / rows;

    for (let i = 0; i <= cols; i++) {
      doc.line(i * cellW, 0, i * cellW, height);
    }
    for (let j = 0; j <= rows; j++) {
      doc.line(0, j * cellH, width, j * cellH);
    }
  }
});
