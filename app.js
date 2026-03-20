/**
 * app.js — NoteGrid Vue 3 application
 */

const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

const DEFAULT_CFG = () => ({
  pageW: 1240,
  pageH: 1754,

  sections: [
    { id: 'task', name: 'Polecenie',        icon: '✏️', pct: 20, enabled: true  },
    { id: 'grid', name: 'Układ wsp.',       icon: '#',  pct: 55, enabled: true  },
    { id: 'work', name: 'Obliczenia',       icon: '📝', pct: 25, enabled: true  },
  ],

  xMin: -10, xMax: 10,
  yMin: -10, yMax: 10,
  step: '1',
  labelType: 'fraction',
  showAxisLabels: true,
  showArrows: true,
  boldAxes: true,

  colors: {
    taskBg:   '#f8f6f2',
    taskText: '#1a1816',
    gridBg:   '#ffffff',
    grid:     '#cccccc',
    axes:     '#1a1816',
    workBg:   '#fdfcfb',
  },

  gridLineW:    0.5,
  axisLineW:    1.5,
  taskFontSize: 13,
  labelFontSize: 9,
  taskText: '',
});

const PRESETS = [
  { label: 'A4 pion',    w: 595,  h: 842  },
  { label: 'A4 poziom',  w: 842,  h: 595  },
  { label: 'Tablet 11"', w: 1668, h: 2224 },
  { label: 'Tablet 13"', w: 2048, h: 2732 },
  { label: 'Tablica',    w: 2480, h: 3508 },
  { label: 'Kwadrat',    w: 1200, h: 1200 },
];

createApp({
  setup() {
    const cfg        = reactive(DEFAULT_CFG());
    const canvas     = ref(null);
    const previewWrap = ref(null);
    const isGenerating = ref(false);
    const pdfReady   = ref(false);
    const activePreset = ref('Tablet 11"');
    let   pdfBlob    = null;
    let   pdfFilename = 'notegrid.pdf';
    let   previewTimer = null;

    const presets = PRESETS;

    const colorFields = [
      { key: 'taskBg',   label: 'Tło polecenia'  },
      { key: 'taskText', label: 'Tekst polecenia' },
      { key: 'gridBg',   label: 'Tło siatki'     },
      { key: 'grid',     label: 'Linie siatki'   },
      { key: 'axes',     label: 'Osie + etykiety' },
      { key: 'workBg',   label: 'Tło obliczeń'   },
    ];

    const pctSum = computed(() => {
      return cfg.sections
        .filter(s => s.enabled)
        .reduce((sum, s) => sum + s.pct, 0);
    });

    // ── Methods ─────────────────────────────────────────────────

    function applyPreset(p) {
      cfg.pageW = p.w;
      cfg.pageH = p.h;
      activePreset.value = p.label;
      schedulePreview();
    }

    function resetDefaults() {
      const d = DEFAULT_CFG();
      Object.assign(cfg, d);
      cfg.sections = d.sections;
      cfg.colors = { ...d.colors };
      activePreset.value = 'Tablet 11"';
      pdfReady.value = false;
      schedulePreview();
    }

    function normalizePct() {
      const active = cfg.sections.filter(s => s.enabled);
      if (!active.length) return;
      const each = Math.floor(100 / active.length);
      let rem = 100 - each * active.length;
      active.forEach((s, i) => { s.pct = each + (i === 0 ? rem : 0); });
      schedulePreview();
    }

    function schedulePreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(drawPreview, 80);
    }

    function drawPreview() {
      if (!canvas.value) return;
      window.NoteGridPDF.renderToCanvas(canvas.value, cfg);
    }

    async function generate() {
      isGenerating.value = true;
      await nextTick();
      setTimeout(() => {
        try {
          const doc = window.NoteGridPDF.generatePDF(cfg);
          pdfBlob = doc.output('blob');
          pdfFilename = `notegrid_${cfg.pageW}x${cfg.pageH}.pdf`;
          pdfReady.value = true;
        } catch (e) {
          console.error('PDF generation error:', e);
        }
        isGenerating.value = false;
      }, 60);
    }

    function download() {
      if (!pdfBlob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfBlob);
      a.download = pdfFilename;
      a.click();
    }

    onMounted(() => {
      // Set default preset
      applyPreset(PRESETS.find(p => p.label === 'Tablet 11"'));

      // Re-draw on window resize
      window.addEventListener('resize', schedulePreview);
    });

    return {
      cfg, canvas, previewWrap,
      isGenerating, pdfReady,
      presets, activePreset, colorFields,
      pctSum,
      applyPreset, resetDefaults, normalizePct,
      schedulePreview, generate, download,
    };
  }
}).mount('#app');