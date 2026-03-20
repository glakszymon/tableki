/**
 * app.js — NoteGrid Vue 3
 */

const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

// ── Presets ───────────────────────────────────────────────────────────────────
// Dimensions in pt (1 pt = 1/72 inch; A4 = 595×842 pt)
const PRESETS = [
  { id: 'a4p',      label: 'A4',          w: 595,  h: 842  },
  { id: 'a4l',      label: 'A4 poziom',   w: 842,  h: 595  },
  { id: 'a4x2',     label: 'A4×2',        w: 595,  h: 1684 },
  { id: 'ipad11',   label: 'iPad 11"',    w: 768,  h: 1024 },
  { id: 'ipad13',   label: 'iPad 13"',    w: 1024, h: 1366 },
  { id: 'ipadpro',  label: 'iPad Pro',    w: 834,  h: 1194 },
];

// ── Default config ────────────────────────────────────────────────────────────
const DEFAULT_CFG = () => ({
  pageW: 595,
  pageH: 1684,   // A4×2 default

  sections: [
    { id: 'task', name: 'Polecenie',  pct: 18, enabled: true  },
    { id: 'grid', name: 'Siatka',    pct: 52, enabled: true  },
    { id: 'work', name: 'Obliczenia', pct: 30, enabled: true  },
  ],

  xMin: -10, xMax: 10,
  yMin: -10, yMax: 10,
  step: '1',
  labelType: 'fraction',
  showAxisLabels: true,
  showArrows: true,
  boldAxes: true,

  colors: {
    taskBg:   '#faf8f5',
    taskText: '#2a2520',
    gridBg:   '#ffffff',
    grid:     '#d0c8bf',
    axes:     '#2a2520',
    workBg:   '#fdfcfa',
  },

  gridLineW:    0.5,
  axisLineW:    1.4,
  labelFontSize: 9,

  gridMargin: { top: 32, right: 32, bottom: 32, left: 32 },
});

// ── App ───────────────────────────────────────────────────────────────────────
createApp({
  setup() {
    const cfg          = reactive(DEFAULT_CFG());
    const canvas       = ref(null);
    const isGenerating = ref(false);
    const pdfReady     = ref(false);
    const activePreset = ref('a4x2');
    let   pdfBlob      = null;
    let   pdfName      = 'notegrid.pdf';
    let   previewTimer = null;

    // ── Computed ──────────────────────────────────────────────
    const pctSum = computed(() =>
      cfg.sections.filter(s => s.enabled).reduce((a, s) => a + s.pct, 0)
    );

    // ── Preset thumbnails ─────────────────────────────────────
    function thumbStyle(p) {
      const BOX = 32;
      const ratio = p.w / p.h;
      let tw, th;
      if (ratio >= 1) { tw = BOX; th = Math.round(BOX / ratio); }
      else            { th = BOX; tw = Math.round(BOX * ratio); }
      return { width: tw + 'px', height: th + 'px' };
    }

    // ── Preset apply ──────────────────────────────────────────
    function applyPreset(p) {
      cfg.pageW = p.w;
      cfg.pageH = p.h;
      activePreset.value = p.id;
      schedulePreview();
    }

    // ── Rotate ────────────────────────────────────────────────
    function rotateFormat() {
      const tmp = cfg.pageW;
      cfg.pageW = cfg.pageH;
      cfg.pageH = tmp;
      // Update active preset if it matches swapped dims
      const match = PRESETS.find(p => p.w === cfg.pageW && p.h === cfg.pageH);
      activePreset.value = match ? match.id : null;
      schedulePreview();
    }

    // ── Custom size input ─────────────────────────────────────
    function onCustomSize() {
      const match = PRESETS.find(p => p.w === cfg.pageW && p.h === cfg.pageH);
      activePreset.value = match ? match.id : null;
      schedulePreview();
    }

    // ── Sections ──────────────────────────────────────────────
    function normalizePct() {
      const active = cfg.sections.filter(s => s.enabled);
      if (!active.length) return;
      const each = Math.floor(100 / active.length);
      const rem  = 100 - each * active.length;
      active.forEach((s, i) => { s.pct = each + (i === 0 ? rem : 0); });
      schedulePreview();
    }

    // ── Sync margins ──────────────────────────────────────────
    function syncMargins() {
      const avg = Math.round((cfg.gridMargin.top + cfg.gridMargin.right + cfg.gridMargin.bottom + cfg.gridMargin.left) / 4);
      cfg.gridMargin.top = cfg.gridMargin.right = cfg.gridMargin.bottom = cfg.gridMargin.left = avg;
      schedulePreview();
    }

    // ── Preview ───────────────────────────────────────────────
    function schedulePreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(drawPreview, 60);
    }

    function drawPreview() {
      if (!canvas.value) return;
      window.NoteGridPDF.renderToCanvas(canvas.value, cfg);
    }

    // ── Generate PDF ──────────────────────────────────────────
    async function generate() {
      isGenerating.value = true;
      await nextTick();
      setTimeout(() => {
        try {
          const doc = window.NoteGridPDF.generatePDF(cfg);
          pdfBlob = doc.output('blob');
          pdfName = `notegrid_${cfg.pageW}x${cfg.pageH}.pdf`;
          pdfReady.value = true;
        } catch (err) {
          console.error('PDF error:', err);
        }
        isGenerating.value = false;
      }, 60);
    }

    // ── Download ──────────────────────────────────────────────
    function download() {
      if (!pdfBlob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfBlob);
      a.download = pdfName;
      a.click();
    }

    // ── Reset ─────────────────────────────────────────────────
    function resetDefaults() {
      const d = DEFAULT_CFG();
      Object.assign(cfg, d);
      cfg.sections = d.sections.map(s => ({ ...s }));
      cfg.colors   = { ...d.colors };
      cfg.gridMargin = { ...d.gridMargin };
      activePreset.value = 'a4x2';
      pdfReady.value = false;
      schedulePreview();
    }

    // ── Mount ─────────────────────────────────────────────────
    onMounted(() => {
      schedulePreview();
      window.addEventListener('resize', schedulePreview);
    });

    return {
      cfg, canvas,
      isGenerating, pdfReady,
      presets: PRESETS,
      activePreset,
      pctSum,
      colorFields: [
        { key: 'taskBg',   label: 'Tło polecenia'  },
        { key: 'gridBg',   label: 'Tło siatki'     },
        { key: 'grid',     label: 'Linie siatki'   },
        { key: 'axes',     label: 'Osie + etykiety' },
        { key: 'workBg',   label: 'Tło obliczeń'   },
      ],
      axisToggles: [
        { key: 'showAxisLabels', label: 'Etykiety osi (x, y)' },
        { key: 'showArrows',     label: 'Strzałki na osiach'  },
        { key: 'boldAxes',       label: 'Grube osie główne'   },
      ],
      thumbStyle,
      applyPreset, rotateFormat, onCustomSize,
      normalizePct, schedulePreview, syncMargins,
      generate, download, resetDefaults,
    };
  }
}).mount('#app');