/**
 * app.js — NoteGrid Vue 3
 * Funkcje: podgląd na żywo, generowanie PDF, zapis/wczytywanie presetów użytkownika
 */

const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

const LS_KEY = 'notegrid_user_presets';

// ── Wymiary kartek (pt) ───────────────────────────────────────────────────────
const PAGE_PRESETS = [
  { id: 'a4p',     label: 'A4',        w: 595,  h: 842  },
  { id: 'a4l',     label: 'A4 poziom', w: 842,  h: 595  },
  { id: 'a4x2',    label: 'A4×2',      w: 595,  h: 1684 },
  { id: 'ipad11',  label: 'iPad 11"',  w: 768,  h: 1024 },
  { id: 'ipad13',  label: 'iPad 13"',  w: 1024, h: 1366 },
  { id: 'ipadpro', label: 'iPad Pro',  w: 834,  h: 1194 },
];

// ── Domyślna konfiguracja ─────────────────────────────────────────────────────
const DEFAULT_CFG = () => ({
  pageW: 595,
  pageH: 1684,
  sections: [
    { id: 'task', name: 'Polecenie',  pct: 18, enabled: true },
    { id: 'grid', name: 'Siatka',    pct: 52, enabled: true },
    { id: 'work', name: 'Obliczenia', pct: 30, enabled: true },
  ],
  xMin: -10, xMax: 10,
  yMin: -10, yMax: 10,
  step: '1',
  labelType: 'fraction',
  showAxisLabels: true,
  showArrows: true,
  boldAxes: true,
  colors: {
    taskBg:  '#faf8f5',
    taskText:'#2a2520',
    gridBg:  '#ffffff',
    grid:    '#d0c8bf',
    axes:    '#2a2520',
    workBg:  '#fdfcfa',
  },
  gridLineW:    0.5,
  axisLineW:    1.4,
  labelFontSize: 9,
  gridMargin: { top: 32, right: 32, bottom: 32, left: 32 },
});

function cloneCfg(c) {
  return {
    ...c,
    sections:   c.sections.map(s => ({ ...s })),
    colors:     { ...c.colors },
    gridMargin: { ...c.gridMargin },
  };
}

function loadSavedPresets() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function persistPresets(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

// ── Vue App ───────────────────────────────────────────────────────────────────
createApp({
  setup() {
    const cfg           = reactive(DEFAULT_CFG());
    const canvas        = ref(null);
    const isGenerating  = ref(false);
    const pdfReady      = ref(false);
    const activePagePre = ref('a4x2');
    const sidebarOpen   = ref(true);
    let   pdfBlob       = null;
    let   pdfName       = 'notegrid.pdf';
    let   previewTimer  = null;

    // Presety użytkownika
    const savedPresets  = ref(loadSavedPresets());

    // Modal zapisu
    const showSaveModal = ref(false);
    const newPresetName = ref('');
    const saveError     = ref('');
    const overwriteMode = ref(false);

    // Modal wczytywania
    const showLoadModal = ref(false);

    // ── Obliczenia ─────────────────────────────────────────────
    const pctSum = computed(() =>
      cfg.sections.filter(s => s.enabled).reduce((a, s) => a + s.pct, 0)
    );

    // ── Miniatury formatów ─────────────────────────────────────
    function thumbStyle(p) {
      const BOX = 28;
      const r = p.w / p.h;
      return r >= 1
        ? { width: BOX + 'px', height: Math.round(BOX / r) + 'px' }
        : { width: Math.round(BOX * r) + 'px', height: BOX + 'px' };
    }

    // ── Format kartki ──────────────────────────────────────────
    function applyPagePreset(p) {
      cfg.pageW = p.w; cfg.pageH = p.h;
      activePagePre.value = p.id;
      schedulePreview();
    }

    function rotateFormat() {
      [cfg.pageW, cfg.pageH] = [cfg.pageH, cfg.pageW];
      const m = PAGE_PRESETS.find(p => p.w === cfg.pageW && p.h === cfg.pageH);
      activePagePre.value = m ? m.id : null;
      schedulePreview();
    }

    function onCustomSize() {
      const m = PAGE_PRESETS.find(p => p.w === cfg.pageW && p.h === cfg.pageH);
      activePagePre.value = m ? m.id : null;
      schedulePreview();
    }

    // ── Sekcje ─────────────────────────────────────────────────
    function normalizePct() {
      const active = cfg.sections.filter(s => s.enabled);
      if (!active.length) return;
      const each = Math.floor(100 / active.length);
      const rem  = 100 - each * active.length;
      active.forEach((s, i) => { s.pct = each + (i === 0 ? rem : 0); });
      schedulePreview();
    }

    // ── Marginesy ──────────────────────────────────────────────
    function syncMargins() {
      const avg = Math.round(
        (cfg.gridMargin.top + cfg.gridMargin.right +
         cfg.gridMargin.bottom + cfg.gridMargin.left) / 4
      );
      cfg.gridMargin.top = cfg.gridMargin.right =
      cfg.gridMargin.bottom = cfg.gridMargin.left = avg;
      schedulePreview();
    }

    // ── Podgląd ────────────────────────────────────────────────
    function schedulePreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        if (canvas.value) window.NoteGridPDF.renderToCanvas(canvas.value, cfg);
      }, 60);
    }

    // ── Generowanie PDF ────────────────────────────────────────
    async function generate() {
      isGenerating.value = true;
      await nextTick();
      setTimeout(() => {
        try {
          const doc = window.NoteGridPDF.generatePDF(cfg);
          pdfBlob = doc.output('blob');
          pdfName = `notegrid_${cfg.pageW}x${cfg.pageH}.pdf`;
          pdfReady.value = true;
        } catch (e) { console.error(e); }
        isGenerating.value = false;
      }, 60);
    }

    function download() {
      if (!pdfBlob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfBlob);
      a.download = pdfName;
      a.click();
    }

    // ── Reset ──────────────────────────────────────────────────
    function resetDefaults() {
      const d = DEFAULT_CFG();
      Object.assign(cfg, cloneCfg(d));
      activePagePre.value = 'a4x2';
      pdfReady.value = false;
      schedulePreview();
    }

    // ── Zapis presetu ──────────────────────────────────────────
    function openSaveModal() {
      newPresetName.value = '';
      saveError.value = '';
      overwriteMode.value = false;
      showSaveModal.value = true;
      nextTick(() => document.getElementById('presetNameInput')?.focus());
    }

    function onPresetNameInput() {
      const name = newPresetName.value.trim();
      overwriteMode.value = savedPresets.value.some(p => p.name === name);
      saveError.value = '';
    }

    function confirmSave() {
      const name = newPresetName.value.trim();
      if (!name) { saveError.value = 'Wpisz nazwę presetu.'; return; }
      if (name.length > 40) { saveError.value = 'Maks. 40 znaków.'; return; }

      const existing = savedPresets.value.findIndex(p => p.name === name);
      const entry = {
        id:   existing >= 0 ? savedPresets.value[existing].id : Date.now().toString(),
        name,
        cfg:  cloneCfg(cfg),
        date: new Date().toLocaleDateString('pl-PL'),
      };

      if (existing >= 0) savedPresets.value.splice(existing, 1, entry);
      else savedPresets.value.unshift(entry);

      persistPresets(savedPresets.value);
      showSaveModal.value = false;
    }

    // ── Wczytywanie presetu ────────────────────────────────────
    function openLoadModal() {
      showLoadModal.value = true;
    }

    function loadPreset(preset) {
      Object.assign(cfg, cloneCfg(preset.cfg));
      const m = PAGE_PRESETS.find(p => p.w === cfg.pageW && p.h === cfg.pageH);
      activePagePre.value = m ? m.id : null;
      pdfReady.value = false;
      showLoadModal.value = false;
      schedulePreview();
    }

    function deletePreset(id) {
      savedPresets.value = savedPresets.value.filter(p => p.id !== id);
      persistPresets(savedPresets.value);
    }

    // ── Sidebar toggle (mobile) ────────────────────────────────
    function toggleSidebar() {
      sidebarOpen.value = !sidebarOpen.value;
      setTimeout(schedulePreview, 320);
    }

    // ── Mount ──────────────────────────────────────────────────
    onMounted(() => {
      if (window.innerWidth < 700) sidebarOpen.value = false;
      requestAnimationFrame(() => schedulePreview());

      const previewEl = document.querySelector('.preview');
      if (previewEl && window.ResizeObserver) {
        new ResizeObserver(() => schedulePreview()).observe(previewEl);
      } else {
        window.addEventListener('resize', schedulePreview);
      }
    });

    return {
      cfg, canvas,
      isGenerating, pdfReady,
      pagePresets: PAGE_PRESETS,
      activePagePre, sidebarOpen,
      pctSum,
      savedPresets,
      showSaveModal, newPresetName, saveError, overwriteMode,
      showLoadModal,
      colorFields: [
        { key: 'taskBg',  label: 'Tło polecenia'  },
        { key: 'gridBg',  label: 'Tło siatki'     },
        { key: 'grid',    label: 'Linie siatki'   },
        { key: 'axes',    label: 'Osie + etykiety' },
        { key: 'workBg',  label: 'Tło obliczeń'   },
      ],
      axisToggles: [
        { key: 'showAxisLabels', label: 'Etykiety osi (x, y)' },
        { key: 'showArrows',     label: 'Strzałki na osiach'  },
        { key: 'boldAxes',       label: 'Grube osie główne'   },
      ],
      thumbStyle,
      applyPagePreset, rotateFormat, onCustomSize,
      normalizePct, syncMargins, schedulePreview,
      generate, download, resetDefaults,
      openSaveModal, confirmSave, onPresetNameInput,
      openLoadModal, loadPreset, deletePreset,
      toggleSidebar,
    };
  }
}).mount('#app');