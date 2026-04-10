let currentImage = null;
let database = []; // Aquí se acumulan todos los registros
let pendingColor = null;
let isDragging = false;
let startX = 0;
let startY = 0;

const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const statusBar = document.getElementById('statusBar');
const dataRows = document.getElementById('dataRows');

// 1. Umbral de Serigrafía: Define si requiere base blanca
function evaluateSerigraphyBase(r, g, b) {
    // Calculamos la luminancia percibida
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // Si el brillo es bajo (color oscuro), REQUIERE BASE (true)
    return brightness < 128; 
}

// 2. Selección Manual
imgCanvas.addEventListener('mousedown', (e) => {
    if (!currentImage) return;
    const rect = imgCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isDragging = false;
});

imgCanvas.addEventListener('mousemove', (e) => {
    if (!currentImage || e.buttons !== 1) return;
    isDragging = true;
    const rect = imgCanvas.getBoundingClientRect();
    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(currentImage, 0, 0);
    ctx.strokeStyle = '#ff3e3e'; // Rojo para destacar en serigrafía
    ctx.strokeRect(startX, startY, (e.clientX - rect.left) - startX, (e.clientY - rect.top) - startY);
});

imgCanvas.addEventListener('mouseup', async (e) => {
    if (!currentImage) return;
    const rect = imgCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    ctx.drawImage(currentImage, 0, 0);

    if (!isDragging) {
        const pixel = ctx.getImageData(startX, startY, 1, 1).data;
        const r = pixel[0], g = pixel[1], b = pixel[2];
        const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
        
        const needsBase = evaluateSerigraphyBase(r, g, b);
        pendingColor = { hex, needsBase };
        
        statusBar.innerHTML = `🎨 Color: ${hex} | <b>Base: ${needsBase ? 'SÍ (Oscuro)' : 'NO (Claro)'}</b>. Ahora selecciona el texto.`;
        return;
    }

    if (!pendingColor) return;

    // Procesar OCR
    const tempCanvas = document.createElement('canvas');
    const cw = Math.abs(endX - startX);
    const ch = Math.abs(endY - startY);
    tempCanvas.width = cw;
    tempCanvas.height = ch;
    tempCanvas.getContext('2d').drawImage(imgCanvas, Math.min(startX, endX), Math.min(startY, endY), cw, ch, 0, 0, cw, ch);

    try {
        const result = await Tesseract.recognize(tempCanvas.toDataURL(), 'eng');
        const text = result.data.text.trim().replace(/\n/g, ' ');
        
        const entry = { 
            id: Date.now(),
            hex: pendingColor.hex, 
            colorName: text, 
            underbase: pendingColor.needsBase 
        };
        
        database.push(entry);
        renderRows();
        pendingColor = null;
        statusBar.innerHTML = '✅ Guardado. Selecciona el siguiente color.';
    } catch (e) { console.error(e); }
});

// 3. Renderizado y descarga
function renderRows() {
    dataRows.innerHTML = database.map(item => `
        <div class="row-item">
            <div class="color-preview" style="background-color: ${item.hex}"></div>
            <span style="font-size:12px; width:70px">${item.hex}</span>
            <input type="text" value="${item.colorName}" style="flex:1">
            <span class="badge ${item.underbase ? 'base-true' : 'base-false'}">
                ${item.underbase ? 'CON BASE' : 'SIN BASE'}
            </span>
        </div>
    `).join('');
    document.getElementById('dbControls').style.display = 'block';
}

document.getElementById('downloadDb').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(database, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "tegra_color_database.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});
