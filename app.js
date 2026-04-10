// 1. Variables de configuración y estado
const imageUpload = document.getElementById('imageUpload');
const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const dataRows = document.getElementById('dataRows');
const exportBtn = document.getElementById('exportBtn');
const jsonOutput = document.getElementById('jsonOutput');
const statusBar = document.getElementById('statusBar');

let currentImage = null;
let extractedData = [];

// 2. Utilidades
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// 3. Procesamiento Automático
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            imgCanvas.width = img.width;
            imgCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            currentImage = img;
            
            statusBar.innerHTML = '✨ Detectando filas automáticamente...';
            autoDetectRows();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

async function autoDetectRows() {
    const imageData = ctx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
    const pixels = imageData.data;
    const detectedRows = [];
    
    // Escaneamos una línea vertical (X=20) para encontrar cambios de color (bloques)
    const scanX = 20; 
    let lastHex = "";

    for (let y = 0; y < imgCanvas.height; y += 5) { // Escaneo cada 5px para velocidad
        const index = (y * imgCanvas.width + scanX) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const hex = rgbToHex(r, g, b);

        // Si el color no es blanco (o muy claro) y es diferente al anterior, es una fila nueva
        if (hex !== "#FFFFFF" && hex !== lastHex && r < 245) { 
            detectedRows.push({ x: scanX, y: y, hex: hex });
            lastHex = hex;
            y += 40; // Saltamos un poco para no detectar el mismo bloque varias veces
        }
    }

    statusBar.innerHTML = `✅ Se detectaron ${detectedRows.length} colores. Procesando textos...`;
    
    // Procesar cada fila detectada
    for (const row of detectedRows) {
        await processRow(row);
    }
    
    statusBar.innerHTML = `🚀 Procesamiento completo. Revisa y exporta.`;
}

async function processRow(row) {
    const tempId = Date.now() + Math.random();
    
    // Definimos el área de texto relativa al color detectado
    const scanWidth = 450; 
    const scanHeight = 55;
    const sourceX = row.x + 50; // A la derecha del bloque
    const sourceY = row.y - 15; // Centramos un poco el recorte

    addUiRow(tempId, row.hex, "Leyendo...");

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scanWidth;
    tempCanvas.height = scanHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(imgCanvas, sourceX, sourceY, scanWidth, scanHeight, 0, 0, scanWidth, scanHeight);

    try {
        const result = await Tesseract.recognize(tempCanvas.toDataURL(), 'eng');
        const cleanText = result.data.text.replace(/\n/g, ' ').replace(/[|I—_]/g, '').trim();
        updateUiRow(tempId, row.hex, cleanText);
    } catch (e) {
        updateUiRow(tempId, row.hex, "Error");
    }
}

// 4. Interfaz y Exportación (Se mantienen tus funciones que ya funcionan)
function addUiRow(id, hex, initialText) {
    const row = document.createElement('div');
    row.className = 'row-item';
    row.id = `row-${id}`;
    row.innerHTML = `
        <div class="color-preview" style="background-color: ${hex}; border:1px solid #ccc"></div>
        <input type="text" class="hex-input" value="${hex}" data-id="${id}" data-type="hex">
        <input type="text" class="text-input" value="${initialText}" data-id="${id}" data-type="text">
    `;
    dataRows.appendChild(row);
    exportBtn.style.display = 'block';
    extractedData.push({ id, hex, text: initialText });
    attachListeners();
}

function updateUiRow(id, hex, text) {
    const row = document.getElementById(`row-${id}`);
    if (row) {
        row.querySelector('.text-input').value = text;
        const item = extractedData.find(i => i.id === id);
        if (item) item.text = text;
    }
}

function attachListeners() {
    document.querySelectorAll('#dataRows input').forEach(input => {
        input.onchange = (e) => {
            const id = parseFloat(e.target.dataset.id);
            const item = extractedData.find(i => i.id === id);
            if (item) item[e.target.dataset.type] = e.target.value;
        };
    });
}

exportBtn.addEventListener('click', () => {
    const finalData = extractedData.map(({ hex, text }) => ({ hex, colorName: text }));
    jsonOutput.style.display = 'block';
    jsonOutput.textContent = JSON.stringify(finalData, null, 4);
});
