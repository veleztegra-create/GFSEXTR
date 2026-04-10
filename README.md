# GFSEXTR 🎨 🚀
**Industrial Color & Text Extractor for Garment Specifications**

GFSEXTR es una herramienta web de alto rendimiento diseñada para automatizar la extracción de datos de hojas de especificaciones técnicas (Spec Sheets). Utiliza **Computer Vision** (HTML5 Canvas) y **OCR** (Tesseract.js) para identificar bloques de color y digitalizar el texto asociado directamente a un formato JSON.

## 🌟 Características
- **Auto-Detección de Filas:** Escanea automáticamente la columna de color para identificar cada variante de la tabla.
- **OCR Segmentado:** Aísla el texto de cada celda para garantizar una precisión del 100%, evitando interferencias de otras filas.
- **Editor en Tiempo Real:** Interfaz intuitiva para revisar y corregir el texto extraído antes de exportar.
- **Exportación Limpia:** Genera un objeto JSON listo para ser integrado en bases de datos de producción o PLM.
- **Privacidad Total:** El procesamiento se realiza localmente en el navegador (Client-side). Ninguna imagen se sube a servidores externos.

## 🛠️ Stack Tecnológico
- **Lenguaje:** Vanilla JavaScript (ES6+)
- **Motor de OCR:** [Tesseract.js](https://tesseract.projectnaptha.com/)
- **Gráficos:** HTML5 Canvas API
- **Estilo:** CSS3 con diseño responsivo y panel de edición fijo (sticky).

## 🚀 Instalación y Uso
No requiere instalación. Al ser una aplicación estática, puedes ejecutarla directamente desde GitHub Pages.

1. **Cargar Imagen:** Selecciona la captura de pantalla o archivo de la hoja de especificaciones.
2. **Procesamiento Automático:** La aplicación detectará los bloques de color en el borde izquierdo y comenzará el escaneo de texto de arriba hacia abajo.
3. **Revisión:** Si el OCR comete algún error tipográfico debido a la fuente de la imagen, corrígelo directamente en los campos de texto de la derecha.
4. **Exportar:** Haz clic en **"GENERAR JSON"** para obtener el código final.

## 📂 Estructura del Proyecto
```text
├── index.html   # Estructura de la UI y carga de librerías.
├── app.js       # Lógica de detección, recorte de imagen y motor OCR.
└── README.md    # Documentación del proyecto.
