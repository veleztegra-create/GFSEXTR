const imageUpload = document.getElementById('imageUpload');
const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const dataRows = document.getElementById('dataRows');
const statusBar = document.getElementById('statusBar');
const downloadDb = document.getElementById('downloadDb');
const jsonPreview = document.getElementById('jsonPreview');

let currentImage = null;
let database = []; 
let pendingColor = null; 
let isDragging = false;
let startX = 0, startY = 0;

// 1. Lógica de Umbral para Serigrafía
function getSerigraphyAdvice(r, g, b) {
    // Calculamos el brillo percibido (0-255)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // Umbral industrial: si es menor a 128 es oscuro y necesita Base Blanca
    return brightness < 128; 
}

function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// 2. Carga de Imagen
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
            statusBar.innerHTML = "🎯 <b>PASO 1:</b> Haz clic en el cuadro de color.";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// 3. Selección Manual (Eventos del Mouse)
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
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(currentImage, 0, 0);
    ctx.strokeStyle = "#0984e3";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, curX - startX, curY - startY);
});

imgCanvas.addEventListener('mouseup', async (e) => {
    if (!currentImage) return;
    const rect = imgCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    ctx.drawImage(currentImage, 0, 0);

    // CASO: CLIC (Captura Color y evalúa umbral)
    if (!isDragging || (Math.abs(endX - startX) < 5)) {
        const pixel = ctx.getImageData(startX, startY, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        const needsBase = getSerigraphyAdvice(pixel[0], pixel[1], pixel[2]);
        
        pendingColor = { hex, underbase: needsBase };
        statusBar.innerHTML = `🎨 Color: ${hex} | <b>Base: ${needsBase ? 'SÍ' : 'NO'}</b>. Ahora selecciona el texto.`;
        return;
    }

    // CASO: ARRASTRE (OCR)
    if (!pendingColor) {
        alert("Primero selecciona el color con un clic.");
        return;
    }

    const cropX = Math.min(startX, endX);
    const cropY = Math.min(startY, endY);
    const cropW = Math.abs(endX - startX);
    const cropH = Math.abs(endY - startY);

    statusBar.innerHTML = "⌛ Analizando texto con OCR...";

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    tempCanvas.getContext('2d').drawImage(imgCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    try {
        const result = await Tesseract.recognize(tempCanvas.toDataURL(), 'eng');
        const cleanText = result.data.text.trim().replace(/\n/g, ' ');
        
        // Guardar en la Base de Datos
        database.push({
            id: Date.now(),
            hex: pendingColor.hex,
            colorName: cleanText,
            underbase: pendingColor.underbase
        });

        renderDatabase();
        pendingColor = null;
        statusBar.innerHTML = "✅ Guardado. Selecciona el siguiente color.";
    } catch (err) {
        console.error(err);
        statusBar.innerHTML = "❌ Error en OCR.";
    }
});

// 4. Renderizar y Guardar
function renderDatabase() {
    dataRows.innerHTML = database.map(item => `
        <div class="row-item">
            <div class="color-preview" style="background-color: ${item.hex}"></div>
            <input type="text" class="text-input" value="${item.colorName}" readonly>
            <span class="badge ${item.underbase ? 'base-true' : 'base-false'}">
                ${item.underbase ? 'CON BASE' : 'SIN BASE'}
            </span>
        </div>
    `).reverse().join(''); // El más nuevo arriba

    document.getElementById('dbControls').style.display = 'block';
    jsonPreview.textContent = JSON.stringify(database, null, 2);
}

downloadDb.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(database, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spec_database_${new Date().getTime()}.json`;
    a.click();
});
