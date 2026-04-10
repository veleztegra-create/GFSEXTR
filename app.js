// 1. Declaración de variables
const imageUpload = document.getElementById('imageUpload');
const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const dataRows = document.getElementById('dataRows');
const exportBtn = document.getElementById('exportBtn');
const jsonOutput = document.getElementById('jsonOutput');
const statusBar = document.getElementById('statusBar');

let currentImage = null;
let extractedData = [];
let pendingColor = null; 
let isDragging = false;
let startX = 0;
let startY = 0;

// 2. Utilidades de color
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// NUEVO: Función para determinar si un color es claro u oscuro (Umbral)
function isColorLight(r, g, b) {
    // Fórmula de luminancia estándar
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 180; // Si es mayor a 180, se considera "claro"
}

// 3. Carga de imagen
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
            statusBar.innerHTML = '🎯 <b>Paso 1:</b> Haz clic en el cuadro de color.';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// 4. Lógica de Selección Manual con Inteligencia de Umbral
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
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(currentImage, 0, 0);

    ctx.strokeStyle = '#0056b3';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
});

imgCanvas.addEventListener('mouseup', async (e) => {
    if (!currentImage) return;
    const rect = imgCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(currentImage, 0, 0);

    // CLIC SIMPLE: Capturar Color y Evaluar Umbral
    if (!isDragging || (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5)) {
        const pixelData = ctx.getImageData(startX, startY, 1, 1).data;
        const r = pixelData[0], g = pixelData[1], b = pixelData[2];
        pendingColor = rgbToHex(r, g, b);
        
        const lightMode = isColorLight(r, g, b) ? "CLARO ⚪" : "OSCURO ⚫";
        statusBar.innerHTML = `🎨 Color: ${pendingColor} (${lightMode}). <b>Paso 2:</b> Arrastra sobre el texto.`;
        return;
    }

    // ARRASTRAR: Recorte y OCR
    if (!pendingColor) {
        alert("Primero selecciona un color con un clic.");
        return;
    }

    const cropW = Math.abs(endX - startX);
    const cropH = Math.abs(endY - startY);
    const cropX = Math.min(startX, endX);
    const cropY = Math.min(startY, endY);

    const tempId = Date.now();
    addUiRow(tempId, pendingColor, "Procesando...");

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext('2d');

    // APLICAR FILTRO SI EL COLOR ES CLARO
    // Si el color es claro, aplicamos un poco de contraste al recorte para que las letras resalten
    const colorRGB = ctx.getImageData(startX, startY, 1, 1).data; // Usamos el punto original
    if (isColorLight(colorRGB[0], colorRGB[1], colorRGB[2])) {
        tempCtx.filter = 'contrast(1.5) grayscale(1)';
    }

    tempCtx.drawImage(imgCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    pendingColor = null;

    try {
        const result = await Tesseract.recognize(tempCanvas.toDataURL(), 'eng');
        const cleanText = result.data.text.replace(/\n/g, ' ').replace(/[|I—_]/g, '').trim();
        updateUiRow(tempId, null, cleanText);
        statusBar.innerHTML = '🎯 <b>Paso 1:</b> Selecciona el siguiente color.';
    } catch (err) {
        updateUiRow(tempId, null, "Error en lectura");
    }
});

// 5. Interfaz (Igual que antes)
function addUiRow(id, hex, initialText) {
    const row = document.createElement('div');
    row.className = 'row-item';
    row.id = `row-${id}`;
    row.innerHTML = `
        <div class="color-preview" style="background-color: ${hex};"></div>
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
