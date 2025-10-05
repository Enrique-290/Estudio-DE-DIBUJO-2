(() => {
  const canvas = document.getElementById('board');
  const wrap = document.getElementById('canvasWrap');
  const ctx = canvas.getContext('2d');

  const color = document.getElementById('color');
  const size = document.getElementById('size');
  const sizeVal = document.getElementById('sizeVal');
  const alpha = document.getElementById('alpha');
  const alphaVal = document.getElementById('alphaVal');
  const mode = document.getElementById('mode');
  const background = document.getElementById('background');
  const autotext = document.getElementById('autotext');

  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');

  const overlay = document.getElementById('overlay');
  const textLayer = document.getElementById('textLayer');

  let drawing = false;
  let lastX = 0, lastY = 0;
  let scale = window.devicePixelRatio || 1;

  // Historial para undo/redo
  const history = [];
  let historyIndex = -1;

  function pushHistory() {
    if (historyIndex < history.length - 1) history.splice(historyIndex + 1);
    try {
      history.push(canvas.toDataURL('image/png'));
      historyIndex = history.length - 1;
      updateUndoRedoUI();
    } catch(e) { console.warn('No se pudo registrar el estado:', e); }
  }
  function updateUndoRedoUI(){
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
  }
  function restoreFrom(dataURL){
    const img = new Image();
    img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img, 0, 0); };
    img.src = dataURL;
  }

  function setCanvasSize() {
    const pad = 20;
    const w = Math.min(wrap.clientWidth - pad*2, 1200);
    const h = Math.min(wrap.clientHeight - pad*2, 800);
    const vw = w > 0 ? w : 800;
    const vh = h > 0 ? h : 600;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  }

  function getPos(ev){
    if (ev.touches && ev.touches.length) {
      const rect = canvas.getBoundingClientRect();
      const t = ev.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    } else {
      return { x: ev.offsetX, y: ev.offsetY };
    }
  }

  // Track bounding box of current stroke
  let box = null;
  function start(ev){
    ev.preventDefault();
    drawing = true;
    const p = getPos(ev);
    lastX = p.x; lastY = p.y;
    box = {minX:p.x, minY:p.y, maxX:p.x, maxY:p.y};
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
  }
  function draw(ev){
    if (!drawing) return;
    ev.preventDefault();
    const p = getPos(ev);
    box.minX = Math.min(box.minX, p.x);
    box.minY = Math.min(box.minY, p.y);
    box.maxX = Math.max(box.maxX, p.x);
    box.maxY = Math.max(box.maxY, p.y);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const modeVal = mode.value;
    let strokeStyle = color.value;
    let globalAlpha = parseFloat(alpha.value);
    let lineWidth = parseInt(size.value, 10);

    if (modeVal === 'erase') {
      strokeStyle = '#ffffff';
      globalAlpha = 1;
    } else if (modeVal === 'highlighter') {
      globalAlpha = Math.min(globalAlpha, 0.4);
      lineWidth = Math.max(lineWidth, 16);
    }

    ctx.globalAlpha = globalAlpha;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  async function end(ev){
    if (!drawing) return;
    drawing = false;
    ctx.beginPath();
    pushHistory();

    if (autotext.value === 'demo') {
      showRecognizing(true);
      await wait(350);
      showRecognizing(false);
      createTextBox(box.minX, box.maxY + 10, "Texto detectado…");
    } else if (autotext.value === 'azure') {
      try {
        showRecognizing(true);
        const crop = cropBox(box, 18); // margen
        const blob = await canvasToBlob(crop);
        const res = await fetch('/api/recognize', { method:'POST', body: blob });
        const data = await res.json();
        const text = (data && data.text || '').trim();
        showRecognizing(false);
        if (text) {
          createTextBox(box.minX, box.maxY + 10, text);
        } else {
          createTextBox(box.minX, box.maxY + 10, "(sin texto)");
        }
      } catch (e) {
        showRecognizing(false);
        console.error(e);
        createTextBox(box.minX, box.maxY + 10, "(error OCR)");
      }
    }
  }

  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function cropBox(b, margin=10){
    const x = Math.max(0, Math.floor((b.minX - margin)));
    const y = Math.max(0, Math.floor((b.minY - margin)));
    const w = Math.min(canvas.width/scale - x, Math.ceil((b.maxX - b.minX) + margin*2));
    const h = Math.min(canvas.height/scale - y, Math.ceil((b.maxY - b.minY) + margin*2 + 20)); // un poco de extra abajo
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(w * scale);
    tmp.height = Math.round(h * scale);
    const tctx = tmp.getContext('2d');
    tctx.scale(scale, scale);
    tctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return tmp;
  }

  function canvasToBlob(cnv){
    return new Promise(res => cnv.toBlob(res, 'image/png', 1));
  }

  function showRecognizing(on){
    overlay.hidden = !on;
  }

  // Eventos mouse/touch
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', draw, {passive:false});
  canvas.addEventListener('touchend', end);

  // Controles
  size.addEventListener('input', () => sizeVal.textContent = size.value);
  alpha.addEventListener('input', () => alphaVal.textContent = parseFloat(alpha.value).toFixed(2));

  clearBtn.addEventListener('click', () => {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    textLayer.innerHTML = "";
    pushHistory();
  });

  undoBtn.addEventListener('click', () => {
    if (historyIndex > 0) {
      historyIndex--;
      restoreFrom(history[historyIndex]);
      updateUndoRedoUI();
    }
  });
  redoBtn.addEventListener('click', () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      restoreFrom(history[historyIndex]);
      updateUndoRedoUI();
    }
  });

  // Guardar PNG
  saveBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'apunte.png';
    link.href = exportAsPNG();
    link.click();
  });

  function exportAsPNG(){
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ex = exportCanvas.getContext('2d');
    ex.scale(scale, scale);
    ex.drawImage(canvas, 0, 0, canvas.width/scale, canvas.height/scale);
    [...textLayer.querySelectorAll('.text-box')].forEach(box => {
      const rect = box.getBoundingClientRect();
      const cRect = canvas.getBoundingClientRect();
      const x = (rect.left - cRect.left);
      const y = (rect.top - cRect.top) + 20;
      ex.fillStyle = '#111';
      ex.font = '22px "Segoe UI", Arial';
      ex.fillText(box.innerText.trim(), x*scale, y*scale);
    });
    return exportCanvas.toDataURL('image/png');
  }

  exportPdfBtn.addEventListener('click', () => {
    const dataURL = exportAsPNG();
    const w = window.open('about:blank');
    w.document.write(`<img src="${dataURL}" style="width:100%">`);
    w.document.close();
  });

  function applyBackground(kind){
    canvas.classList.remove('bg-grid','bg-ruled','bg-dotted');
    if (kind === 'grid') canvas.classList.add('bg-grid');
    if (kind === 'ruled') canvas.classList.add('bg-ruled');
    if (kind === 'dotted') canvas.classList.add('bg-dotted');
  }
  background.addEventListener('change', (e)=> applyBackground(e.target.value));

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoBtn.click(); }
    if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoBtn.click(); }
  });

  function createTextBox(x, y, text){
    const box = document.createElement('div');
    box.className = 'text-box text-print';
    box.contentEditable = 'true';
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.innerText = text || '';
    textLayer.appendChild(box);
    box.focus();
    // seleccionar todo
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function init(){
    setCanvasSize();
    sizeVal.textContent = size.value;
    alphaVal.textContent = parseFloat(alpha.value).toFixed(2);
    applyBackground(background.value);
  }
  window.addEventListener('resize', () => {
    const snapshot = canvas.toDataURL('image/png');
    setCanvasSize();
    restoreFrom(snapshot);
    pushHistory();
  });
  init();
})();