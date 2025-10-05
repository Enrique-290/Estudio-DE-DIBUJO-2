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

  let strokeMinY = Infinity;
  function start(ev){
    ev.preventDefault();
    drawing = true;
    const p = getPos(ev);
    lastX = p.x; lastY = p.y;
    strokeMinY = p.y;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
  }
  function draw(ev){
    if (!drawing) return;
    ev.preventDefault();
    const p = getPos(ev);
    strokeMinY = Math.min(strokeMinY, p.y);
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
  function end(ev){
    if (!drawing) return;
    drawing = false;
    ctx.beginPath();
    pushHistory();

    // AutoTexto Demo: crea una caja editable en la línea siguiente
    if (autotext.value === 'demo') {
      overlay.hidden = false;
      setTimeout(() => {
        overlay.hidden = true;
        const posY = clamp(strokeMinY + 28, 14, canvas.getBoundingClientRect().height - 40);
        createEditableTextbox(20, posY, "Escribe aquí el texto detectado…");
      }, 450); // efecto "reconociendo"
    }
  }

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

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
    // limpia cajas
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
    // Componer texto sobre el canvas para export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ex = exportCanvas.getContext('2d');
    ex.scale(scale, scale);
    ex.drawImage(canvas, 0, 0, canvas.width/scale, canvas.height/scale);
    // pintar todos los textos
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

  // Exportar PDF (simple 1 página usando canvas → dataURL dentro de un objeto PDF liviano)
  exportPdfBtn.addEventListener('click', () => {
    // PDF mínimo (A4) embebiendo imagen: para mantenerlo simple, generamos un data URL y lo abrimos en nueva pestaña.
    const dataURL = exportAsPNG();
    const w = window.open('about:blank');
    w.document.write(`<img src="${dataURL}" style="width:100%">`);
    w.document.close();
  });

  // Fondos
  function applyBackground(kind){
    canvas.classList.remove('bg-grid','bg-ruled','bg-dotted');
    if (kind === 'grid') canvas.classList.add('bg-grid');
    if (kind === 'ruled') canvas.classList.add('bg-ruled');
    if (kind === 'dotted') canvas.classList.add('bg-dotted');
  }
  background.addEventListener('change', (e)=> applyBackground(e.target.value));

  // Atajos
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoBtn.click(); }
    if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoBtn.click(); }
  });

  // Cajas de texto editables (demo "reconocido")
  function createEditableTextbox(x, y, placeholder=""){
    const box = document.createElement('div');
    box.className = 'text-box text-print';
    box.contentEditable = 'true';
    box.style.left = `${x + canvas.getBoundingClientRect().left}px`;
    box.style.top = `${y + canvas.getBoundingClientRect().top}px`;
    box.style.transform = `translate(0,0)`;
    box.style.position = 'absolute';
    box.innerText = placeholder;
    document.body.appendChild(box);

    // al hacer click fuera, si está vacío, eliminar
    function blurHandler(){
      if (!box.innerText.trim()) {
        box.remove();
      } else {
        // reubicar dentro del textLayer relativo al canvas
        const cRect = canvas.getBoundingClientRect();
        const bRect = box.getBoundingClientRect();
        const relLeft = bRect.left - cRect.left;
        const relTop = bRect.top - cRect.top;
        box.style.left = relLeft + 'px';
        box.style.top = relTop + 'px';
        textLayer.appendChild(box);
      }
      box.removeEventListener('blur', blurHandler);
    }
    box.addEventListener('blur', blurHandler);
    box.focus();
    // seleccionar todo
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Inicializa
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