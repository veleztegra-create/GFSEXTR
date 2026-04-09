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

    // Crear una entrada temporal en la UI
    const tempId = Date.now();
    addUiRow(tempId, hexColor, "Analizando texto...");

    // --- NUEVO ENFOQUE: Recortar la imagen con un Canvas temporal ---
    
    // Dimensiones del área de texto (Ajusta estos valores según tu tabla)
    const scanWidth = 350;  // Ancho de la celda de texto
    const scanHeight = 50;  // Alto aproximado de la fila
    
    // Crear un canvas invisible en memoria
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scanWidth;
    tempCanvas.height = scanHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Calcular desde dónde recortar (Un poco a la derecha del clic, y centrado en Y)
    const sourceX = x + 40; // Brincamos el cuadro de color
    const sourceY = y - (scanHeight / 2);

    // Dibujar solo esa porción en el canvas temporal
    tempCtx.drawImage(
        imgCanvas, 
        sourceX, sourceY, scanWidth, scanHeight, // Qué parte copiar (origen)
        0, 0, scanWidth, scanHeight              // Dónde pegarlo (destino)
    );

    // Convertir solo ese pequeño recorte a base64
    const croppedImageData = tempCanvas.toDataURL();

    // Ejecutar OCR EXCLUSIVAMENTE en el recorte
    try {
        const result = await Tesseract.recognize(
            croppedImageData,
            'eng' // Puedes agregar configuraciones extra aquí si lo necesitas
        );
        
        // Limpiar el texto: quitar saltos de línea, barras verticales extrañas ('|', 'I') y espacios en blanco
        let cleanText = result.data.text
            .replace(/\n/g, ' ')
            .replace(/[|I—_]/g, '') // Limpia caracteres basura comunes en bordes de tablas
            .trim();

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
