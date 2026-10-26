import { rgb } from 'pdf-lib';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Convierte un string de color hexadecimal o rgb/rgba a componentes normalizados 0..1
 */
export function hexToRgb(hexOrRgb: string): RgbColor {
  if (!hexOrRgb) return { r: 0, g: 0, b: 0 };

  const str = hexOrRgb.trim().toLowerCase();

  // Handle rgb / rgba
  if (str.startsWith('rgb')) {
    const match = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return {
        r: Math.max(0, Math.min(1, parseInt(match[1], 10) / 255)),
        g: Math.max(0, Math.min(1, parseInt(match[2], 10) / 255)),
        b: Math.max(0, Math.min(1, parseInt(match[3], 10) / 255)),
      };
    }
  }

  // Handle transparent or none
  if (str === 'transparent' || str === 'none') {
    return { r: 0, g: 0, b: 0 };
  }

  // Handle hex
  let hex = str.replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (hex.length >= 6) {
    const num = parseInt(hex.substring(0, 6), 16);
    if (!isNaN(num)) {
      return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255,
      };
    }
  }

  return { r: 0, g: 0, b: 0 };
}

/**
 * Convierte un string de color a una instancia Color de pdf-lib
 */
export function toPdfColor(colorStr: string) {
  const { r, g, b } = hexToRgb(colorStr);
  return rgb(r, g, b);
}

/**
 * Convierte un punto del canvas de Fabric (en píxeles de escena, origen superior-izquierdo)
 * a coordenadas intrínsecas de página PDF (puntos 72 DPI, origen inferior-izquierdo).
 *
 * @param canvasX - Coordenada X en la escena de Fabric (0..canvasWidth)
 * @param canvasY - Coordenada Y en la escena de Fabric (0..canvasHeight)
 * @param canvasWidth - Ancho base de la escena de Fabric (px)
 * @param canvasHeight - Alto base de la escena de Fabric (px)
 * @param pdfWidth - Ancho intrínseco de la página en el PDF (pt)
 * @param pdfHeight - Alto intrínseco de la página en el PDF (pt)
 * @param rotation - Ángulo total de rotación de la página (0, 90, 180, 270)
 */
export function canvasToPdfPoint(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
  rotation = 0
): { x: number; y: number } {
  // Proporción normalizada dentro de la escena visual (sin clamping destructivo)
  const normX = canvasWidth > 0 ? canvasX / canvasWidth : 0;
  const normY = canvasHeight > 0 ? canvasY / canvasHeight : 0;

  const rot = ((rotation % 360) + 360) % 360;

  switch (rot) {
    case 90:
      // Rotado 90° horario en visualización:
      // El eje X visual va a lo largo del eje Y del PDF (0 -> pdfHeight)
      // El eje Y visual va a lo largo del eje X del PDF (0 -> pdfWidth)
      return {
        x: normY * pdfWidth,
        y: normX * pdfHeight,
      };

    case 180:
      // Rotado 180° horario:
      // Top-Left visual corresponde a Bottom-Right en el PDF
      return {
        x: (1 - normX) * pdfWidth,
        y: normY * pdfHeight,
      };

    case 270:
      // Rotado 270° horario (o 90° antihorario):
      // Top-Left visual corresponde a Top-Right en el PDF
      return {
        x: (1 - normY) * pdfWidth,
        y: (1 - normX) * pdfHeight,
      };

    case 0:
    default:
      // Sin rotación:
      // Eje X visual coincide con X del PDF (0 -> pdfWidth)
      // Eje Y visual invertido con Y del PDF (Y_pdf = (1 - normY) * pdfHeight)
      return {
        x: normX * pdfWidth,
        y: (1 - normY) * pdfHeight,
      };
  }
}

export interface PdfObjectTransform {
  // Coordenada del ancla (esquina inferior izquierda del elemento) en pdf-lib
  x: number;
  y: number;
  // Dimensiones escaladas en unidades PDF
  width: number;
  height: number;
  // Ángulo de rotación para pdf-lib (grados)
  rotateDegrees: number;
}

/**
 * Calcula la transformación exacta (posición, dimensiones y rotación) para dibujar
 * un objeto de Fabric (Rect, Image, etc.) en pdf-lib respetando la rotación de página.
 */
export function calculateObjectTransform(
  left: number,
  top: number,
  width: number,
  height: number,
  angle: number, // Ángulo del objeto en Fabric (grados, horario)
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
  pageRotation = 0
): PdfObjectTransform {
  const rot = ((pageRotation % 360) + 360) % 360;

  // Escala según rotación: si la página está a 90 o 270 grados,
  // canvasWidth corresponde a pdfHeight y canvasHeight corresponde a pdfWidth.
  let scaleX: number;
  let scaleY: number;

  if (rot === 90 || rot === 270) {
    scaleX = pdfHeight / canvasWidth;
    scaleY = pdfWidth / canvasHeight;
  } else {
    scaleX = pdfWidth / canvasWidth;
    scaleY = pdfHeight / canvasHeight;
  }

  const pdfW = width * scaleX;
  const pdfH = height * scaleY;

  // En Fabric.js, el objeto rota en sentido horario alrededor de (left, top).
  // Calculamos la posición visual real en pantalla de la esquina inferior izquierda
  // antes de mapearla a las coordenadas nativas del PDF.
  const rad = (angle * Math.PI) / 180;
  const screenBlX = left - height * Math.sin(rad);
  const screenBlY = top + height * Math.cos(rad);

  const anchor = canvasToPdfPoint(
    screenBlX,
    screenBlY,
    canvasWidth,
    canvasHeight,
    pdfWidth,
    pdfHeight,
    rot
  );

  // La rotación en pdf-lib es antihoraria. Sumamos la rotación base de la página
  // y restamos el ángulo horario de Fabric.
  let rotateDegrees = (rot - angle) % 360;
  if (rotateDegrees < 0) rotateDegrees += 360;

  return {
    x: anchor.x,
    y: anchor.y,
    width: pdfW,
    height: pdfH,
    rotateDegrees,
  };
}

/**
 * Elimina limpiamente un objeto individual o una selección múltiple (ActiveSelection)
 * de un canvas de Fabric, evitando controles huérfanos y desincronizaciones de estado.
 */
export function deleteFabricObject(canvas: any, obj: any): void {
  if (!canvas || !obj) return;

  if (obj.type === 'activeselection' && typeof obj.getObjects === 'function') {
    const objects = [...obj.getObjects()];
    canvas.discardActiveObject();
    objects.forEach((innerObj: any) => {
      canvas.remove(innerObj);
    });
  } else {
    canvas.remove(obj);
    canvas.discardActiveObject();
  }
  canvas.requestRenderAll();
}

/**
 * Formatea bytes a un tamaño legible por humanos (B, KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
