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
