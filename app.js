async function autoDetectRows() {
    const imageData = ctx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
    const pixels = imageData.data;
    const detectedRows = [];
    
    // Usamos una columna de escaneo que pase por las líneas divisorias (ej. X=100)
    const scanX = 100; 
    let lineCount = 0;
    let inLine = false;

    for (let y = 0; y < imgCanvas.height; y++) {
        const index = (y * imgCanvas.width + scanX) * 4;
        const r = pixels[index];
        const g = pixels[index+1];
        const b = pixels[index+2];

        // Detectar color oscuro (línea divisoria)
        const isDark = (r < 180 && g < 180 && b < 180);

        if (isDark && !inLine) {
            inLine = true;
            lineCount++;
        } else if (!isDark && inLine) {
            inLine = false;
        }

        // Si detectamos el grupo de 3 líneas (o estamos al inicio de la primera fila)
        if (lineCount === 3 || (y === 10 && detectedRows.length === 0)) {
            // Buscamos el color un poco más abajo de las líneas (centro de la celda)
            const sampleY = y + 30; 
            if (sampleY < imgCanvas.height) {
                const sIdx = (sampleY * imgCanvas.width + 25) * 4; // X=25 para el cuadro de color
                const color = rgbToHex(pixels[sIdx], pixels[sIdx+1], pixels[sIdx+2]);
                
                // Evitamos duplicados y colores de fondo (blancos/grises claros)
                if (color !== "#FFFFFF" && pixels[sIdx] < 250) {
                    detectedRows.push({ x: 25, y: sampleY, hex: color });
                }
            }
            lineCount = 0; // Reiniciamos contador para el siguiente bloque
            y += 20; // Saltamos el área de las líneas para no re-detectar
        }
    }

    // ... resto del código para procesar filas ...
    statusBar.innerHTML = `✅ ${detectedRows.length} bloques identificados mediante divisores.`;
    for (const row of detectedRows) { await processRow(row); }
}
