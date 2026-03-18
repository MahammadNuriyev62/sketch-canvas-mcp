import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import "./global.css";
import "./mcp-app.css";

// ── Types ──────────────────────────────────────────────────────────

type Tool = "pen" | "rect" | "circle" | "arrow" | "text" | "eraser";

interface Stroke {
  type: "pen" | "eraser";
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface RectShape {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  width: number;
}

interface CircleShape {
  type: "circle";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  width: number;
}

interface ArrowShape {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

interface TextLabel {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

type DrawItem = Stroke | RectShape | CircleShape | ArrowShape | TextLabel;

// ── DOM refs ───────────────────────────────────────────────────────

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const appEl = document.querySelector(".app") as HTMLElement;
const colorPicker = document.getElementById("color-picker") as HTMLInputElement;
const strokeWidthSelect = document.getElementById("stroke-width") as HTMLSelectElement;
const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;
const syncIndicator = document.getElementById("sync-indicator") as HTMLElement;
const textInputOverlay = document.getElementById("text-input-overlay") as HTMLElement;
const textInput = document.getElementById("text-input") as HTMLInputElement;
const toolBtns = document.querySelectorAll<HTMLButtonElement>(".tool-btn");

// ── State ──────────────────────────────────────────────────────────

let currentTool: Tool = "pen";
let items: DrawItem[] = [];
let isDrawing = false;
let currentStroke: Stroke | null = null;
let shapeStart: { x: number; y: number } | null = null;
let isDarkTheme = false;

function getColor(): string {
  return currentTool === "eraser" ? (isDarkTheme ? "#1a1a1a" : "#ffffff") : colorPicker.value;
}

function getStrokeWidth(): number {
  return currentTool === "eraser" ? 20 : parseInt(strokeWidthSelect.value, 10);
}

// ── Canvas sizing ──────────────────────────────────────────────────

function resizeCanvas() {
  const container = canvas.parentElement!;
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}

// ── Drawing functions ──────────────────────────────────────────────

function drawStroke(s: Stroke) {
  if (s.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (s.type === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  }
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  for (let i = 1; i < s.points.length; i++) {
    ctx.lineTo(s.points[i].x, s.points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRect(r: RectShape) {
  ctx.save();
  ctx.strokeStyle = r.color;
  ctx.lineWidth = r.width;
  ctx.lineJoin = "round";
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

function drawCircle(c: CircleShape) {
  ctx.save();
  ctx.strokeStyle = c.color;
  ctx.lineWidth = c.width;
  ctx.beginPath();
  ctx.ellipse(c.cx, c.cy, Math.abs(c.rx), Math.abs(c.ry), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawArrow(a: ArrowShape) {
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.width;
  ctx.lineCap = "round";

  // Line
  ctx.beginPath();
  ctx.moveTo(a.x1, a.y1);
  ctx.lineTo(a.x2, a.y2);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const headLen = Math.max(12, a.width * 4);
  ctx.beginPath();
  ctx.moveTo(a.x2, a.y2);
  ctx.lineTo(
    a.x2 - headLen * Math.cos(angle - Math.PI / 6),
    a.y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    a.x2 - headLen * Math.cos(angle + Math.PI / 6),
    a.y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawText(t: TextLabel) {
  ctx.save();
  ctx.fillStyle = t.color;
  ctx.font = `${t.fontSize}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillText(t.text, t.x, t.y);
  ctx.restore();
}

function drawItem(item: DrawItem) {
  switch (item.type) {
    case "pen":
    case "eraser":
      drawStroke(item);
      break;
    case "rect":
      drawRect(item);
      break;
    case "circle":
      drawCircle(item);
      break;
    case "arrow":
      drawArrow(item);
      break;
    case "text":
      drawText(item);
      break;
  }
}

function clearCanvas() {
  const container = canvas.parentElement!;
  const rect = container.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
}

function redraw() {
  clearCanvas();
  for (const item of items) {
    drawItem(item);
  }
}

function updateUndoBtn() {
  undoBtn.disabled = items.length === 0;
}

// ── Coordinate helpers ─────────────────────────────────────────────

function getCanvasPos(e: MouseEvent | Touch): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ── Pointer events (mouse + touch unified) ─────────────────────────

function handlePointerDown(x: number, y: number) {
  if (currentTool === "text") {
    showTextInput(x, y);
    return;
  }

  isDrawing = true;

  if (currentTool === "pen" || currentTool === "eraser") {
    currentStroke = {
      type: currentTool === "eraser" ? "eraser" : "pen",
      points: [{ x, y }],
      color: getColor(),
      width: getStrokeWidth(),
    };
  } else {
    shapeStart = { x, y };
  }
}

function handlePointerMove(x: number, y: number) {
  if (!isDrawing) return;

  if (currentStroke) {
    currentStroke.points.push({ x, y });
    redraw();
    drawStroke(currentStroke);
  } else if (shapeStart) {
    redraw();
    const preview = buildShape(shapeStart.x, shapeStart.y, x, y);
    if (preview) drawItem(preview);
  }
}

function handlePointerUp(x: number, y: number) {
  if (!isDrawing) return;
  isDrawing = false;

  if (currentStroke) {
    if (currentStroke.points.length >= 2) {
      items.push(currentStroke);
    }
    currentStroke = null;
  } else if (shapeStart) {
    const shape = buildShape(shapeStart.x, shapeStart.y, x, y);
    if (shape) items.push(shape);
    shapeStart = null;
  }

  redraw();
  updateUndoBtn();
  scheduleSync();
}

function buildShape(x1: number, y1: number, x2: number, y2: number): DrawItem | null {
  const color = getColor();
  const width = getStrokeWidth();

  if (currentTool === "rect") {
    return { type: "rect", x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), color, width };
  } else if (currentTool === "circle") {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return { type: "circle", cx, cy, rx: Math.abs(x2 - x1) / 2, ry: Math.abs(y2 - y1) / 2, color, width };
  } else if (currentTool === "arrow") {
    return { type: "arrow", x1, y1, x2, y2, color, width };
  }
  return null;
}

// ── Text input ─────────────────────────────────────────────────────

function showTextInput(x: number, y: number) {
  textInputOverlay.classList.remove("hidden");
  textInputOverlay.style.left = `${x}px`;
  textInputOverlay.style.top = `${y}px`;
  textInput.value = "";
  textInput.style.color = colorPicker.value;
  textInput.focus();

  const commit = () => {
    const val = textInput.value.trim();
    if (val) {
      items.push({
        type: "text",
        x,
        y,
        text: val,
        color: colorPicker.value,
        fontSize: 16,
      });
      redraw();
      updateUndoBtn();
      scheduleSync();
    }
    textInputOverlay.classList.add("hidden");
    textInput.removeEventListener("keydown", onKey);
    textInput.removeEventListener("blur", commit);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      textInputOverlay.classList.add("hidden");
      textInput.removeEventListener("keydown", onKey);
      textInput.removeEventListener("blur", commit);
    }
  };

  textInput.addEventListener("keydown", onKey);
  textInput.addEventListener("blur", commit, { once: true });
}

// ── Mouse events ───────────────────────────────────────────────────

canvas.addEventListener("mousedown", (e) => {
  const pos = getCanvasPos(e);
  handlePointerDown(pos.x, pos.y);
});

canvas.addEventListener("mousemove", (e) => {
  const pos = getCanvasPos(e);
  handlePointerMove(pos.x, pos.y);
});

canvas.addEventListener("mouseup", (e) => {
  const pos = getCanvasPos(e);
  handlePointerUp(pos.x, pos.y);
});

canvas.addEventListener("mouseleave", (e) => {
  if (isDrawing) {
    const pos = getCanvasPos(e);
    handlePointerUp(pos.x, pos.y);
  }
});

// ── Touch events ───────────────────────────────────────────────────

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const pos = getCanvasPos(e.touches[0]);
  handlePointerDown(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const pos = getCanvasPos(e.touches[0]);
  handlePointerMove(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  const pos = getCanvasPos(e.changedTouches[0]);
  handlePointerUp(pos.x, pos.y);
}, { passive: false });

// ── Tool selection ─────────────────────────────────────────────────

toolBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentTool = btn.dataset.tool as Tool;
    toolBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    canvas.style.cursor = currentTool === "eraser"
      ? "crosshair"
      : currentTool === "text"
        ? "text"
        : "crosshair";
  });
});

// ── Undo / Clear ───────────────────────────────────────────────────

undoBtn.addEventListener("click", () => {
  items.pop();
  redraw();
  updateUndoBtn();
  scheduleSync();
});

clearBtn.addEventListener("click", () => {
  items = [];
  redraw();
  updateUndoBtn();
  scheduleSync();
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    items.pop();
    redraw();
    updateUndoBtn();
    scheduleSync();
  }
});

// ── Export + send ──────────────────────────────────────────────────

function exportCanvasAsBase64(): string {
  // Create an export canvas with white background
  const container = canvas.parentElement!;
  const rect = container.getBoundingClientRect();
  const exportCanvas = document.createElement("canvas");
  const exportCtx = exportCanvas.getContext("2d")!;

  exportCanvas.width = rect.width * 2;
  exportCanvas.height = rect.height * 2;
  exportCtx.setTransform(2, 0, 0, 2, 0, 0);

  // White background for readability
  exportCtx.fillStyle = "#ffffff";
  exportCtx.fillRect(0, 0, rect.width, rect.height);

  // Redraw all items onto export canvas
  for (const item of items) {
    drawItemOnCtx(exportCtx, item);
  }

  const dataUrl = exportCanvas.toDataURL("image/png");
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

function drawItemOnCtx(c: CanvasRenderingContext2D, item: DrawItem) {
  switch (item.type) {
    case "pen":
    case "eraser": {
      if (item.points.length < 2) return;
      c.save();
      c.strokeStyle = item.type === "eraser" ? "#ffffff" : item.color;
      c.lineWidth = item.width;
      c.lineCap = "round";
      c.lineJoin = "round";
      if (item.type === "eraser") {
        c.globalCompositeOperation = "destination-out";
      }
      c.beginPath();
      c.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < item.points.length; i++) {
        c.lineTo(item.points[i].x, item.points[i].y);
      }
      c.stroke();
      c.restore();
      break;
    }
    case "rect":
      c.save();
      c.strokeStyle = item.color;
      c.lineWidth = item.width;
      c.lineJoin = "round";
      c.strokeRect(item.x, item.y, item.w, item.h);
      c.restore();
      break;
    case "circle":
      c.save();
      c.strokeStyle = item.color;
      c.lineWidth = item.width;
      c.beginPath();
      c.ellipse(item.cx, item.cy, Math.abs(item.rx), Math.abs(item.ry), 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      break;
    case "arrow": {
      c.save();
      c.strokeStyle = item.color;
      c.fillStyle = item.color;
      c.lineWidth = item.width;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(item.x1, item.y1);
      c.lineTo(item.x2, item.y2);
      c.stroke();
      const angle = Math.atan2(item.y2 - item.y1, item.x2 - item.x1);
      const headLen = Math.max(12, item.width * 4);
      c.beginPath();
      c.moveTo(item.x2, item.y2);
      c.lineTo(item.x2 - headLen * Math.cos(angle - Math.PI / 6), item.y2 - headLen * Math.sin(angle - Math.PI / 6));
      c.lineTo(item.x2 - headLen * Math.cos(angle + Math.PI / 6), item.y2 - headLen * Math.sin(angle + Math.PI / 6));
      c.closePath();
      c.fill();
      c.restore();
      break;
    }
    case "text":
      c.save();
      c.fillStyle = item.color;
      c.font = `${item.fontSize}px ${getComputedStyle(document.body).fontFamily}`;
      c.textBaseline = "top";
      c.fillText(item.text, item.x, item.y);
      c.restore();
      break;
  }
}

function showStatus(msg: string, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.remove("hidden");
  statusEl.classList.toggle("error", isError);
  setTimeout(() => statusEl.classList.add("hidden"), 3000);
}

// ── Auto-sync: continuously push sketch into model context ──────

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToHost, 800);
}

async function syncToHost() {
  syncTimer = null;
  if (items.length === 0) return;

  try {
    const base64 = exportCanvasAsBase64();
    const caps = app.getHostCapabilities();
    const supportsContextImage = !!(caps?.updateModelContext as any)?.image;
    const imageBlock = { type: "image" as const, data: base64, mimeType: "image/png" };

    await app.updateModelContext({
      content: [
        ...(supportsContextImage ? [imageBlock] : []),
        {
          type: "text" as const,
          text: supportsContextImage
            ? "The user is sketching on a canvas. The current state of their drawing is attached as an image. Interpret the sketch visually and respond accordingly."
            : `The user is sketching on a canvas. The current drawing is encoded as a base64 PNG:\n\n<image data="data:image/png;base64,${base64}" />`,
        },
      ],
    });

    syncIndicator.textContent = "Synced";
    syncIndicator.classList.add("synced");
    setTimeout(() => {
      syncIndicator.textContent = "";
      syncIndicator.classList.remove("synced");
    }, 1500);
  } catch (err) {
    console.error("Sync error:", err);
  }
}

// ── Resize handling ────────────────────────────────────────────────

window.addEventListener("resize", resizeCanvas);

// ── Host context ───────────────────────────────────────────────────

function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
    isDarkTheme = ctx.theme === "dark";
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
  if (ctx.safeAreaInsets) {
    appEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    appEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    appEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    appEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

// ── MCP App lifecycle ──────────────────────────────────────────────

const app = new App(
  { name: "Sketch Canvas", version: "1.0.0" },
  {},
  { autoResize: false },
);

app.onteardown = async () => {
  return {};
};

app.ontoolinput = () => {};
app.ontoolresult = () => {};
app.ontoolcancelled = () => {};
app.onerror = console.error;
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const hostCtx = app.getHostContext();
  if (hostCtx) {
    handleHostContextChanged(hostCtx);
  }
  resizeCanvas();

  // Request a tall canvas area from the host
  app.sendSizeChanged({ width: 800, height: 460 });
});
