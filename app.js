// 1. Declaración de variables
const imageUpload = document.getElementById('imageUpload');
const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const dataRows = document.getElementById('dataRows');
const exportBtn = document.getElementById('exportBtn');
const jsonOutput = document.getElementById('jsonOutput');
const statusBar = document.getElementById('statusBar'); // Nueva barra de estado

let currentImage = null;
let extractedData = [];

// Variables para la nueva herramienta de recorte
let pendingColor = null; 
let isDragging = false;
let startX = 0;
let startY = 0;

// 2. Utilidad para convertir RGB a HEX
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// 3. Cargar imagen en el Canvas
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
            pendingColor = null; // Reiniciar estado
            
            statusBar.innerHTML = 'Paso 1: Haz <b>clic simple</b> en un cuadro de color.';
            dataRows.innerHTML = '';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// 4. Lógica de selección (Clic para color, Arrastrar para texto)

// A. Cuando el usuario presiona el mouse
imgCanvas.addEventListener('mousedown', (e) => {
    if (!currentImage) return;
    const rect = imgCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isDragging = false; 
});

// B. Cuando el usuario mueve el mouse presionado (Dibuja el cuadro guía)
imgCanvas.addEventListener('mousemove', (e) => {
    // Si el mouse no está presionado (botón 1), no hacer nada
    if (!currentImage || e.buttons !== 1) return; 
    
    isDragging = true;
    const rect = imgCanvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Limpiar y redibujar la imagen base para que no se raye toda la pantalla
    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(currentImage, 0, 0);

    // Dibujar el rectángulo de selección azul semi-transparente
    const width = currentX - startX;
    const height = currentY - startY;
    
    ctx.strokeStyle = '#0056b3';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Línea punteada
    ctx.strokeRect(startX, startY, width, height);
    
    ctx.fillStyle = 'rgba(0, 86, 179, 0.2)';
    ctx.fillRect(startX, startY, width, height);
});

// C. Cuando el usuario suelta el clic
imgCanvas.addEventListener('mouseup', async (e) => {
    if (!currentImage) return;

    const rect = imgCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    // Redibujar la imagen limpia (quita el cuadro punteado)
    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(currentImage, 0, 0);
    ctx.setLineDash([]); // Quitar punteado

    // CASO 1: Fue un clic simple (No arrastró) -> Extraer Color
    if (!isDragging || (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5)) {
        const pixelData = ctx.getImageData(startX, startY, 1, 1).data;
        pendingColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
        
        // Actualizar barra de estado visualmente
        statusBar.innerHTML = `Paso 2: Color <span style="display:inline-block; width:15px; height:15px; background-color:${pendingColor}; vertical-align:middle; border:1px solid #000; margin:0 5px;"></span> seleccionado. Ahora <b>haz clic y arrastra</b> sobre el texto correspondiente.`;
        return; // Termina aquí y espera a que el usuario dibuje el cuadro
    }

    // CASO 2: Arrastró para seleccionar un área (Recortar y leer texto)
    if (!pendingColor) {
        alert("¡Cuidado! Primero debes hacer un clic simple en el color, y luego dibujar el cuadro del texto.");
        return;
    }

    // Calcular dimensiones del recorte (Soporta arrastrar de abajo hacia arriba o derecha a izquierda)
    const width = endX - startX;
    const height = endY - startY;
    const cropX = width > 0 ? startX : endX;
    const cropY = height > 0 ? startY : endY;
    const cropW = Math.abs(width);
    const cropH = Math.abs(height);

    // Preparar UI
    const tempId = Date.now();
    const activeColor = pendingColor; // Guardar el color actual para esta fila
    pendingColor = null; // Reiniciar para la siguiente lectura
    
    statusBar.innerHTML = 'Paso 1: Haz <b>clic simple</b> en el siguiente cuadro de color.';
    addUiRow(tempId, activeColor, "Analizando área seleccionada...");

    // Crear el recorte usando el Canvas temporal
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(
        imgCanvas, 
        cropX, cropY, cropW, cropH, 
        0, 0, cropW, cropH
    );

    // Mandar SOLO el recorte seleccionado a Tesseract
    try {
        const result = await Tesseract.recognize(tempCanvas.toDataURL(), 'eng');
        
        let cleanText = result.data.text
            .replace(/\n/g, ' ')
            .replace(/[|I—_]/g, '')
            .trim();

        updateUiRow(tempId, activeColor, cleanText);

    } catch (error) {
        console.error("Error en OCR:", error);
        updateUiRow(tempId, activeColor, "Error al leer texto");
    }
});

// 5. Funciones de Interfaz (Se mantienen igual)
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
        const textInput = row.querySelector('.text-input');
        textInput.value = text;
        const dataItem = extractedData.find(item => item.id === id);
        if (dataItem) dataItem.text = text;
    }
}

function attachListeners() {
    const inputs = document.querySelectorAll('#dataRows input');
    inputs.forEach(input => {
        input.onchange = (e) => {
            const id = parseInt(e.target.dataset.id);
            const type = e.target.dataset.type;
            const dataItem = extractedData.find(item => item.id === id);
            if (dataItem) {
                dataItem[type] = e.target.value;
                if (type === 'hex') {
                    document.querySelector(`#row-${id} .color-preview`).style.backgroundColor = e.target.value;
                }
            }
        };
    });
}

// 6. Exportar datos a JSON
exportBtn.addEventListener('click', () => {
    const finalData = extractedData.map(({ hex, text }) => ({ hex, colorName: text }));
    jsonOutput.style.display = 'block';
    jsonOutput.textContent = JSON.stringify(finalData, null, 4);
});
