const imageUpload = document.getElementById('imageUpload');
const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const dataRows = document.getElementById('dataRows');
const statusBar = document.getElementById('statusBar');
const downloadDb = document.getElementById('downloadDb');

let currentImage = null;
let database = []; 
let pendingColor = null; 
let isDragging = false;
let startX = 0, startY = 0;

// LÓGICA DE SERIGRAFÍA MEJORADA: 
// Detecta mejor colores como el Rojo o Naranjas que necesitan base aunque no sean "blancos"
function getSerigraphyAdvice(r, g, b) {
    // 1. Calculamos el brillo percibido (estándar)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 2. Calculamos la intensidad cromática (para captar rojos/vivos)
    const maxColor = Math.max(r, g, b);

    // REGLA: Si el brillo es alto O si el color es muy intenso (como un Rojo puro)
    // El umbral de 100 es más sensible que 128, atrapando más colores.
    if (brightness > 100 || maxColor > 180) {
        return true; // REQUIERE BASE (Colores claros, pasteles y rojos vivos)
    }
    
    return false; // NO REQUIERE BASE (Negros, Marinos, Forest muy oscuros)
}
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
            statusBar.innerHTML = "🎯 1: Clic en Color | 2: Arrastra sobre el Texto";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

imgCanvas.addEventListener('mousedown', (e) => {
    if (!currentImage) return;
    const rect = imgCanvas.getBoundingClientRect();
    // Ajuste de escala para que el clic coincida con la resolución real de la imagen
    startX = (e.clientX - rect.left) * (imgCanvas.width / rect.width);
    startY = (e.clientY - rect.top) * (imgCanvas.height / rect.height);
    isDragging = false;
});

imgCanvas.addEventListener('mousemove', (e) => {
    if (!currentImage || e.buttons !== 1) return;
    isDragging = true;
    const rect = imgCanvas.getBoundingClientRect();
    const curX = (e.clientX - rect.left) * (imgCanvas.width / rect.width);
    const curY = (e.clientY - rect.top) * (imgCanvas.height / rect.height);
    
    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(currentImage, 0, 0);
    ctx.strokeStyle = "#0984e3";
    ctx.lineWidth = 3;
    ctx.strokeRect(startX, startY, curX - startX, curY - startY);
});

imgCanvas.addEventListener('mouseup', async (e) => {
    if (!currentImage) return;
    const rect = imgCanvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left) * (imgCanvas.width / rect.width);
    const endY = (e.clientY - rect.top) * (imgCanvas.height / rect.height);

    ctx.drawImage(currentImage, 0, 0);

    // CLIC SIMPLE: Captura de Color y Base
    if (!isDragging || (Math.abs(endX - startX) < 5)) {
        const pixel = ctx.getImageData(startX, startY, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        const needsBase = getSerigraphyAdvice(pixel[0], pixel[1], pixel[2]);
        pendingColor = { hex, underbase: needsBase };
        statusBar.innerHTML = `🎨 ${hex} | Base: ${needsBase ? 'SÍ' : 'NO'}. Selecciona el texto ahora.`;
        return;
    }

    // ARRASTRE: OCR y guardado
    if (!pendingColor) return;
    statusBar.innerHTML = "⌛ Leyendo texto...";

    const cropX = Math.min(startX, endX), cropY = Math.min(startY, endY);
    const cropW = Math.abs(endX - startX), cropH = Math.abs(endY - startY);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW; tempCanvas.height = cropH;
    tempCanvas.getContext('2d').drawImage(imgCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    try {
        const result = await Tesseract.recognize(tempCanvas.toDataURL(), 'eng');
        database.push({
            id: Date.now(),
            hex: pendingColor.hex,
            colorName: result.data.text.trim().replace(/\n/g, ' '),
            underbase: pendingColor.underbase
        });
        renderDatabase();
        pendingColor = null;
        statusBar.innerHTML = "✅ Guardado. Puedes continuar.";
    } catch (err) { statusBar.innerHTML = "❌ Error en OCR"; }
});

function renderDatabase() {
    dataRows.innerHTML = database.map(item => `
        <div class="row-item">
            <div class="color-preview" style="background-color: ${item.hex}"></div>
            <input type="text" class="text-input" value="${item.colorName}" oninput="updateText(${item.id}, this.value)">
            <span class="badge ${item.underbase ? 'base-true' : 'base-false'}">${item.underbase ? 'CON BASE' : 'SIN BASE'}</span>
            <button class="delete-btn" onclick="deleteItem(${item.id})">✕</button>
        </div>
    `).reverse().join('');
    document.getElementById('dbControls').style.display = database.length ? 'block' : 'none';
}

// Funciones globales para edición y borrado
window.updateText = (id, newText) => {
    const item = database.find(i => i.id === id);
    if (item) item.colorName = newText;
};

window.deleteItem = (id) => {
    database = database.filter(item => item.id !== id);
    renderDatabase();
};

downloadDb.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(database, null, 4)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spec_tegra_${new Date().getTime()}.json`;
    a.click();
});
