const imageUpload = document.getElementById('imageUpload');
const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const dataRows = document.getElementById('dataRows');
const exportBtn = document.getElementById('exportBtn');
const jsonOutput = document.getElementById('jsonOutput');

let currentImage = null;
let extractedData = [];

// Utilidad para convertir RGB a HEX
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// Cargar imagen en el Canvas
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
            dataRows.innerHTML = '<p>Haz clic en los cuadros de color en la imagen para extraer los datos.</p>';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Extraer color al hacer clic
imgCanvas.addEventListener('click', async (e) => {
    if (!currentImage) return;

    // Obtener coordenadas del clic
    const rect = imgCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Leer el píxel clickeado
    const pixelData = ctx.getImageData(x, y, 1, 1).data;
    const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);

    // Crear una entrada temporal en la UI mientras carga el OCR
    const tempId = Date.now();
    addUiRow(tempId, hexColor, "Analizando texto...");

    // Definir un área de búsqueda para el texto (A la derecha del clic)
    // Asumimos que el texto está en los 400 píxeles a la derecha del cuadro de color
    const textScanWidth = 400;
    const textScanHeight = 60; // Altura aproximada de la fila
    
    // Ejecutar OCR en esa región específica
    try {
        const result = await Tesseract.recognize(
            imgCanvas.toDataURL(),
            'eng', // Puedes cambiar a 'spa' si los textos están en español
            {
                rectangle: { 
                    top: Math.max(0, y - textScanHeight/2), 
                    left: Math.min(imgCanvas.width, x + 50), // Empezar a buscar a la derecha del clic
                    width: Math.min(textScanWidth, imgCanvas.width - x - 50), 
                    height: textScanHeight 
                }
            }
        );
        
        // Limpiar el texto detectado (quitar saltos de línea extra)
        const cleanText = result.data.text.replace(/\n/g, ' ').trim();
        updateUiRow(tempId, hexColor, cleanText);

    } catch (error) {
        console.error("Error en OCR:", error);
        updateUiRow(tempId, hexColor, "Error al leer texto");
    }
});

// Funciones para manejar la Interfaz de Usuario de los datos
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

    // Guardar en nuestro arreglo de datos
    extractedData.push({ id, hex, text: initialText });
    attachListeners();
}

function updateUiRow(id, hex, text) {
    const row = document.getElementById(`row-${id}`);
    if (row) {
        const textInput = row.querySelector('.text-input');
        textInput.value = text;
        
        // Actualizar el arreglo de datos
        const dataItem = extractedData.find(item => item.id === id);
        if (dataItem) dataItem.text = text;
    }
}

// Mantener el JSON sincronizado con las ediciones manuales
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

// Exportar datos
exportBtn.addEventListener('click', () => {
    // Limpiar el ID interno antes de exportar
    const finalData = extractedData.map(({ hex, text }) => ({ hex, colorName: text }));
    const jsonString = JSON.stringify(finalData, null, 4);
    
    jsonOutput.style.display = 'block';
    jsonOutput.textContent = jsonString;
});
