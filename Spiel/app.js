/* =========================================================
   Kantonspiel – Mobile Web App (localStorage + Mail Export)
   - 26 Kantone als Grid (Wappen)
   - Anklicken = abgehakt
   - Persistenz via localStorage
   - Start/Ziel Felder (werden gespeichert)
   - Export per Mail (mailto:) inkl. Start, Ziel, Checkliste
   - Copy-to-Clipboard Fallback
   - Finish-Dialog wenn 26/26
   ========================================================= */

const STORAGE_KEY = "kantonspiel.selected.v1";
const FINISH_KEY = "kantonspiel.finishedAt.v1";
const ROUTE_KEY = "kantonspiel.route.v1";

const EMAIL_TO = "janis.weiskopf@outlook.com";

// 26 Kantone (Code + Name)
const KANTONE = [
  { code: "AG", name: "Aargau" },
  { code: "AI", name: "Appenzell Innerrhoden" },
  { code: "AR", name: "Appenzell Ausserrhoden" },
  { code: "BE", name: "Bern" },
  { code: "BL", name: "Basel-Landschaft" },
  { code: "BS", name: "Basel-Stadt" },
  { code: "FR", name: "Freiburg" },
  { code: "GE", name: "Genf" },
  { code: "GL", name: "Glarus" },
  { code: "GR", name: "Graubuenden" },
  { code: "JU", name: "Jura" },
  { code: "LU", name: "Luzern" },
  { code: "NE", name: "Neuenburg" },
  { code: "NW", name: "Nidwalden" },
  { code: "OW", name: "Obwalden" },
  { code: "SG", name: "St. Gallen" },
  { code: "SH", name: "Schaffhausen" },
  { code: "SO", name: "Solothurn" },
  { code: "SZ", name: "Schwyz" },
  { code: "TG", name: "Thurgau" },
  { code: "TI", name: "Tessin" },
  { code: "UR", name: "Uri" },
  { code: "VD", name: "Waadt" },
  { code: "VS", name: "Wallis" },
  { code: "ZG", name: "Zug" },
  { code: "ZH", name: "Zuerich" }
];

// Passe hier die Dateiendung an, falls du PNG/JPG verwendest:
const WAPPEN_PATH = (code) => `assets/wappen/${code}.svg`;

// DOM
const grid = document.getElementById("grid");
const doneCountEl = document.getElementById("doneCount");
const leftCountEl = document.getElementById("leftCount");
const progressFill = document.getElementById("progressFill");

const btnReset = document.getElementById("btnReset");
const btnSelectAll = document.getElementById("btnSelectAll");

const finishDialog = document.getElementById("finishDialog");
const btnCloseFinish = document.getElementById("btnCloseFinish");
const btnNewRun = document.getElementById("btnNewRun");

// Route + Export
const startInput = document.getElementById("startInput");
const endInput = document.getElementById("endInput");
const btnMail = document.getElementById("btnMail");
const btnCopy = document.getElementById("btnCopy");

// State
let selected = loadSelected(); // Set von Codes

// Init
init();
renderAll();
updateStats();

function init() {
  // Route laden (falls Inputs im HTML existieren)
  if (startInput && endInput) {
    const route = loadRoute();
    startInput.value = route.start;
    endInput.value = route.end;

    startInput.addEventListener("input", saveRouteFromInputs);
    endInput.addEventListener("input", saveRouteFromInputs);
  }

  // Reset
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (!confirm("Wirklich alles zuruecksetzen?")) return;
      selected = new Set();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(FINISH_KEY);
      localStorage.removeItem(ROUTE_KEY);
      renderAll();
      updateStats();
    });
  }

  // Alles markieren (optional)
  if (btnSelectAll) {
    btnSelectAll.addEventListener("click", () => {
      selected = new Set(KANTONE.map((k) => k.code));
      saveSelected(selected);
      renderAll();
      updateStats(true);
    });
  }

  // Finish dialog actions
  if (btnCloseFinish && finishDialog) {
    btnCloseFinish.addEventListener("click", () => finishDialog.close());
  }

  if (btnNewRun && finishDialog) {
    btnNewRun.addEventListener("click", () => {
      finishDialog.close();
      selected = new Set();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(FINISH_KEY);
      // Route NICHT loeschen, damit Start/Ziel bleiben (falls du willst -> auch entfernen)
      renderAll();
      updateStats();
    });
  }

  // Mail Export
  if (btnMail) {
    btnMail.addEventListener("click", () => {
      const mailtoUrl = buildMailtoUrl();
      window.location.href = mailtoUrl;
    });
  }

  // Copy Fallback
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const text = buildMailBody();
      try {
        await navigator.clipboard.writeText(text);
        alert("Text kopiert ✅");
      } catch {
        window.prompt("Kopiere den Text:", text);
      }
    });
  }
}

function renderAll() {
  if (!grid) return;
  grid.innerHTML = "";

  KANTONE.forEach(({ code, name }) => {
    const isDone = selected.has(code);

    const item = document.createElement("button");
    item.type = "button";
    item.className = "kanton";
    item.setAttribute("role", "listitem");
    item.setAttribute("aria-pressed", String(isDone));
    item.dataset.code = code;
    item.dataset.done = String(isDone);

    item.innerHTML = `
      <img src="${WAPPEN_PATH(code)}" alt="Wappen ${name}" loading="lazy"
           onerror="this.style.opacity=0.35; this.title='Bild nicht gefunden';" />
      <div class="meta">
        <div class="code">${code}</div>
        <div class="name">${name}</div>
      </div>
      <div class="check" aria-hidden="true">${isDone ? "✓" : ""}</div>
    `;

    item.addEventListener("click", () => toggleKanton(code, item));
    grid.appendChild(item);
  });
}

function toggleKanton(code, el) {
  if (selected.has(code)) selected.delete(code);
  else selected.add(code);

  saveSelected(selected);

  const isDone = selected.has(code);
  el.dataset.done = String(isDone);
  el.setAttribute("aria-pressed", String(isDone));
  const check = el.querySelector(".check");
  if (check) check.textContent = isDone ? "✓" : "";

  updateStats(true);
}

function updateStats(maybeFinish = false) {
  const done = selected.size;
  const total = KANTONE.length;
  const left = total - done;

  if (doneCountEl) doneCountEl.textContent = String(done);
  if (leftCountEl) leftCountEl.textContent = String(left);

  const pct = Math.round((done / total) * 100);
  if (progressFill) progressFill.style.width = `${pct}%`;

  if (maybeFinish && done === total && finishDialog) {
    const alreadyFinishedAt = localStorage.getItem(FINISH_KEY);
    if (!alreadyFinishedAt) {
      localStorage.setItem(FINISH_KEY, new Date().toISOString());
      finishDialog.showModal();
    }
  }
}

// ---------- Persistenz: Kantone ----------
function loadSelected() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveSelected(set) {
  const arr = Array.from(set);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// ---------- Persistenz: Route ----------
function loadRoute() {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return { start: "", end: "" };
    const obj = JSON.parse(raw);
    return {
      start: (obj?.start ?? "").toString(),
      end: (obj?.end ?? "").toString()
    };
  } catch {
    return { start: "", end: "" };
  }
}

function saveRouteFromInputs() {
  if (!startInput || !endInput) return;
  const route = {
    start: startInput.value.trim(),
    end: endInput.value.trim()
  };
  localStorage.setItem(ROUTE_KEY, JSON.stringify(route));
}

// ---------- Mail Export ----------
function buildMailBody() {
  const route = loadRoute();

  const selectedSorted = KANTONE
    .filter((k) => selected.has(k.code))
    .map((k) => `${k.code} – ${k.name}`);

  const lines = [];
  lines.push("Kantonspiel – Resultat");
  lines.push("");
  lines.push(`Startpunkt: ${route.start || "-"}`);
  lines.push(`Endpunkt: ${route.end || "-"}`);
  lines.push("");
  lines.push(`Kantone (${selectedSorted.length}/26):`);

  if (selectedSorted.length === 0) {
    lines.push("- (noch keine)");
  } else {
    selectedSorted.forEach((k) => lines.push(`- ${k}`));
  }

  return lines.join("\n");
}

function buildMailtoUrl() {
  const route = loadRoute();
  const done = selected.size;

  const subject = `Kantonspiel: ${route.start || "Start"} → ${route.end || "Ziel"} (${done}/26)`;
  const body = buildMailBody();

  const enc = (s) => encodeURIComponent(s);
  return `mailto:${EMAIL_TO}?subject=${enc(subject)}&body=${enc(body)}`;
}
