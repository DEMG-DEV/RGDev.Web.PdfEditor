import {
  PDFDocument,
  StandardFonts,
  degrees,
  type PDFPage,
  type PDFFont,
} from 'pdf-lib';
import * as fabric from 'fabric';
import {
  toPdfColor,
  canvasToPdfPoint,
  calculateObjectTransform,
} from '@/utils/coordinateConverter';
import { ensurePdfExtension, sanitizeWinAnsiText } from '@/utils/security';

export interface FabricTextLike {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  fill?: string;
  textAlign?: string;
}

export interface FabricLineLike {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface ExportPdfOptions {
  originalPdfBuffer: ArrayBuffer;
  pageOrder: number[]; // 1-indexed page numbers in desired export order
  rotations: Record<number, number>; // Additional user rotations per page
  canvases: Record<number, fabric.Canvas>;
  pageMetas: Record<number, { originalWidth: number; originalHeight: number; currentRotation?: number }>;
}

/**
 * Mapea la familia tipográfica seleccionada a una fuente estándar de pdf-lib.
 */
async function resolvePdfFont(
  pdfDoc: PDFDocument,
  fontFamily: string,
  isBold = false,
  isItalic = false
): Promise<PDFFont> {
  const family = (fontFamily || '').toLowerCase();

  try {
    if (family.includes('courier')) {
      if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
      if (isBold) return await pdfDoc.embedFont(StandardFonts.CourierBold);
      if (isItalic) return await pdfDoc.embedFont(StandardFonts.CourierOblique);
      return await pdfDoc.embedFont(StandardFonts.Courier);
    }

    if (family.includes('times')) {
      if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
      if (isBold) return await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      if (isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      return await pdfDoc.embedFont(StandardFonts.TimesRoman);
    }

    // Default to Helvetica
    if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    if (isBold) return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    return await pdfDoc.embedFont(StandardFonts.Helvetica);
  } catch (e) {
    console.warn('Fallback to standard Helvetica font:', e);
    return await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
}

/**
 * Exporta el documento PDF final con todas las anotaciones, páginas reordenadas y rotaciones aplicadas.
 */
export async function exportEditedPdf({
  originalPdfBuffer,
  pageOrder,
  rotations,
  canvases,
  pageMetas,
}: ExportPdfOptions): Promise<Uint8Array> {
  // 1. Cargar documento original
  const srcDoc = await PDFDocument.load(originalPdfBuffer);
  const outDoc = await PDFDocument.create();

  // 2. Filtrar páginas válidas
  const validPageIndices: number[] = [];
  const pageMapping: Array<{ originalPageNum: number; outPageIndex: number }> = [];

  pageOrder.forEach((pageNum) => {
    const idx = pageNum - 1;
    if (idx >= 0 && idx < srcDoc.getPageCount()) {
      validPageIndices.push(idx);
      pageMapping.push({
        originalPageNum: pageNum,
        outPageIndex: validPageIndices.length - 1,
      });
    }
  });

  if (validPageIndices.length === 0) {
    throw new Error('El documento no contiene páginas para exportar.');
  }

  // 3. Copiar páginas en el orden especificado
  const copiedPages = await outDoc.copyPages(srcDoc, validPageIndices);

  // 4. Agregar páginas al documento de salida y calcular rotaciones totales
  const pageRotations: Record<number, number> = {};

  copiedPages.forEach((page, index) => {
    outDoc.addPage(page);
    const { originalPageNum } = pageMapping[index];
    const userRotation = rotations[originalPageNum] || 0;
    const currentRot = page.getRotation().angle;
    const finalRot = (currentRot + userRotation) % 360;
    pageRotations[originalPageNum] = finalRot;

    if (userRotation !== 0) {
      page.setRotation(degrees(finalRot));
    }
  });

  // 5. Renderizar anotaciones en cada página
  for (let i = 0; i < pageMapping.length; i++) {
    const { originalPageNum, outPageIndex } = pageMapping[i];
    const page = outDoc.getPage(outPageIndex);
    const canvas = canvases[originalPageNum];
    if (!canvas) continue;

    const objects = canvas.getObjects();
    if (!objects || objects.length === 0) continue;

    const meta = pageMetas[originalPageNum];
    const pdfWidth = meta ? meta.originalWidth : page.getWidth();
    const pdfHeight = meta ? meta.originalHeight : page.getHeight();

    // Las dimensiones base del canvas en Fabric (independientes del zoom de pantalla)
    const totalRotation = pageRotations[originalPageNum] || 0;
    const isRotated90or270 = totalRotation === 90 || totalRotation === 270;
    const canvasBaseWidth = isRotated90or270 ? pdfHeight : pdfWidth;
    const canvasBaseHeight = isRotated90or270 ? pdfWidth : pdfHeight;

    // Separar trazos libres (freehand paths) de formas y textos
    const freehandPaths = objects.filter((o) => o.type === 'path');
    const otherObjects = objects.filter((o) => o.type !== 'path');

    // 5a. Si hay trazos libres, renderizarlos como un PNG overlay transparente de alta resolución
    if (freehandPaths.length > 0) {
      try {
        await renderPathsOverlay(
          canvas,
          freehandPaths,
          page,
          outDoc,
          pdfWidth,
          pdfHeight,
          totalRotation
        );
      } catch (err) {
        console.warn('Failed to render freehand paths overlay:', err);
      }
    }

    // 5b. Renderizar objetos vectoriales y textos nativos
    for (const obj of otherObjects) {
      try {
        await renderFabricObject(obj, page, outDoc, {
          canvasWidth: canvasBaseWidth,
          canvasHeight: canvasBaseHeight,
          pdfWidth,
          pdfHeight,
          pageRotation: totalRotation,
        });
      } catch (objErr) {
        console.warn('Error rendering object:', obj.type, objErr);
      }
    }
  }

  // 6. Guardar y retornar bytes
  return await outDoc.save();
}

/**
 * Renderiza trazos de dibujo libre como un PNG nítido superpuesto con la rotación adecuada,
 * de manera totalmente independiente del nivel de zoom actual de la interfaz.
 */
async function renderPathsOverlay(
  canvas: fabric.Canvas,
  paths: fabric.FabricObject[],
  page: PDFPage,
  pdfDoc: PDFDocument,
  pdfWidth: number,
  pdfHeight: number,
  pageRotation: number
) {
  // Descartar selección activa para evitar bordes/controles en el renderizado
  canvas.discardActiveObject();

  // Ocultar temporalmente los objetos que no son trazos libres
  const allObjects = canvas.getObjects();
  const visibilityMap = new Map<fabric.FabricObject, boolean>();
  allObjects.forEach((o) => {
    visibilityMap.set(o, o.visible);
    o.visible = paths.includes(o);
  });

  // Guardar zoom, viewportTransform y dimensiones actuales de la vista
  const currentZoom = canvas.getZoom();
  const currentVpTransform = canvas.viewportTransform ? [...canvas.viewportTransform] : null;
  const currentWidth = canvas.getWidth();
  const currentHeight = canvas.getHeight();

  const rot = ((pageRotation % 360) + 360) % 360;
  const isRot90or270 = rot === 90 || rot === 270;
  const baseWidth = isRot90or270 ? pdfHeight : pdfWidth;
  const baseHeight = isRot90or270 ? pdfWidth : pdfHeight;

  // Ajustar temporalmente el canvas a dimensiones base 1:1 y zoom 1.0
  canvas.setDimensions({ width: baseWidth, height: baseHeight });
  canvas.setZoom(1.0);
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.renderAll();

  // Renderizar overlay a 2x de resolución para nitidez óptima (144 DPI equivalente)
  const dataUrl = canvas.toDataURL({
    format: 'png',
    multiplier: 2,
  });

  // Restaurar visibilidad y estado original de la vista del usuario
  allObjects.forEach((o) => {
    o.visible = visibilityMap.get(o) ?? true;
  });

  canvas.setDimensions({ width: currentWidth, height: currentHeight });
  if (currentVpTransform) {
    canvas.setViewportTransform(currentVpTransform as [number, number, number, number, number, number]);
  }
  canvas.setZoom(currentZoom);
  canvas.requestRenderAll();

  // Embeber PNG
  const parts = dataUrl.split(',');
  if (parts.length < 2 || !parts[1]) {
    return;
  }
  const base64Data = parts[1];
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const pngImage = await pdfDoc.embedPng(bytes);

  // Ubicación del overlay según la rotación de la página en pdf-lib
  switch (rot) {
    case 90:
      page.drawImage(pngImage, {
        x: pdfWidth,
        y: 0,
        width: pdfHeight,
        height: pdfWidth,
        rotate: degrees(90),
      });
      break;
    case 180:
      page.drawImage(pngImage, {
        x: pdfWidth,
        y: pdfHeight,
        width: pdfWidth,
        height: pdfHeight,
        rotate: degrees(180),
      });
      break;
    case 270:
      page.drawImage(pngImage, {
        x: 0,
        y: pdfHeight,
        width: pdfHeight,
        height: pdfWidth,
        rotate: degrees(270),
      });
      break;
    case 0:
    default:
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pdfWidth,
        height: pdfHeight,
        rotate: degrees(0),
      });
      break;
  }
}

interface RenderContext {
  canvasWidth: number;
  canvasHeight: number;
  pdfWidth: number;
  pdfHeight: number;
  pageRotation: number;
}

/**
 * Renderiza un objeto individual de Fabric (Text, Rect, Circle, Line, Image) en PDFPage.
 */
async function renderFabricObject(
  obj: fabric.FabricObject,
  page: PDFPage,
  pdfDoc: PDFDocument,
  ctx: RenderContext
) {
  const { canvasWidth, canvasHeight, pdfWidth, pdfHeight, pageRotation } = ctx;

  const left = obj.left || 0;
  const top = obj.top || 0;
  const scaleX = obj.scaleX || 1;
  const scaleY = obj.scaleY || 1;
  const width = (obj.width || 0) * scaleX;
  const height = (obj.height || 0) * scaleY;
  const angle = obj.angle || 0;
  const opacity = typeof obj.opacity === 'number' ? Math.max(0, Math.min(1, obj.opacity)) : 1;

  const objType = obj.type;

  // 1. Textbox / Text / IText
  if (objType === 'textbox' || objType === 'text' || objType === 'i-text') {
    const textObj = obj as unknown as FabricTextLike;

    const text = textObj.text || '';
    if (!text.trim()) return;

    const isBold = textObj.fontWeight === 'bold' || textObj.fontWeight === 700;
    const isItalic = textObj.fontStyle === 'italic';
    const font = await resolvePdfFont(pdfDoc, textObj.fontFamily || 'Helvetica', isBold, isItalic);

    // Escala del tamaño de fuente
    const baseFontSizePx = (textObj.fontSize || 18) * scaleY;
    const isRot90or270 = pageRotation === 90 || pageRotation === 270;
    const scaleFactor = isRot90or270 ? pdfWidth / canvasHeight : pdfHeight / canvasHeight;
    const fontSizePt = Math.max(6, baseFontSizePx * scaleFactor);

    const fillColor =
      textObj.fill && typeof textObj.fill === 'string'
        ? toPdfColor(textObj.fill)
        : toPdfColor('#000000');

    // Manejo de wrap de texto multilínea: si Fabric ya calculó los saltos (_textLines), respetarlos
    const fabricTb = obj as unknown as { _textLines?: string[]; textLines?: string[]; lineHeight?: number };
    let lines: string[] = [];
    if (Array.isArray(fabricTb._textLines) && fabricTb._textLines.length > 0) {
      lines = fabricTb._textLines;
    } else if (Array.isArray(fabricTb.textLines) && fabricTb.textLines.length > 0) {
      lines = fabricTb.textLines;
    } else {
      lines = text.split('\n');
    }

    const objLineHeight = fabricTb.lineHeight || 1.16;
    const lineSpacingPx = baseFontSizePx * objLineHeight;
    const boxWidthPx = width;
    const rad = (angle * Math.PI) / 180;
    const cosAngle = Math.cos(rad);
    const sinAngle = Math.sin(rad);

    lines.forEach((line, idx) => {
      // Sanitizar texto contra caracteres no compatibles con fuentes estándar WinAnsi (evita crash en export)
      const safeLine = sanitizeWinAnsiText(line);
      if (!safeLine.trim()) return;

      const lineWidthPt = font.widthOfTextAtSize(safeLine, fontSizePt);
      const lineWidthPx = (lineWidthPt / fontSizePt) * baseFontSizePx;

      let alignOffsetPx = 0;
      if (textObj.textAlign === 'center') {
        alignOffsetPx = Math.max(0, (boxWidthPx - lineWidthPx) / 2);
      } else if (textObj.textAlign === 'right') {
        alignOffsetPx = Math.max(0, boxWidthPx - lineWidthPx);
      }

      const localX = alignOffsetPx;
      const localY = (idx * lineSpacingPx) + (0.85 * baseFontSizePx);

      // Posición visual en pantalla rotada según el ángulo del textbox
      const screenX = left + localX * cosAngle - localY * sinAngle;
      const screenY = top + localX * sinAngle + localY * cosAngle;

      const pt = canvasToPdfPoint(
        screenX,
        screenY,
        canvasWidth,
        canvasHeight,
        pdfWidth,
        pdfHeight,
        pageRotation
      );

      let textAngle = (pageRotation - angle) % 360;
      if (textAngle < 0) textAngle += 360;

      try {
        page.drawText(safeLine, {
          x: pt.x,
          y: pt.y,
          size: fontSizePt,
          font,
          color: fillColor,
          opacity,
          rotate: degrees(textAngle),
        });
      } catch (drawErr) {
        console.warn('Fallback error rendering text line in PDF:', drawErr);
      }
    });
    return;
  }

  // 2. Rect
  if (objType === 'rect') {
    const fillStr = (obj.fill as string) || 'transparent';
    const strokeStr = (obj.stroke as string) || '';
    const strokeW = (obj.strokeWidth || 0) * scaleX;

    const hasFill = fillStr && fillStr !== 'transparent' && fillStr !== 'none';
    const hasStroke = strokeStr && strokeStr !== 'transparent' && strokeStr !== 'none' && strokeW > 0;

    // Evitar que rectángulos vacíos se dibujen como bloques negros por defecto en pdf-lib
    if (!hasFill && !hasStroke) return;

    const transform = calculateObjectTransform(
      left,
      top,
      width,
      height,
      angle,
      canvasWidth,
      canvasHeight,
      pdfWidth,
      pdfHeight,
      pageRotation
    );

    page.drawRectangle({
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
      color: hasFill ? toPdfColor(fillStr) : undefined,
      borderColor: hasStroke ? toPdfColor(strokeStr) : undefined,
      borderWidth: hasStroke ? strokeW : 0,
      opacity,
      rotate: degrees(transform.rotateDegrees),
    });
    return;
  }

  // 3. Circle
  if (objType === 'circle') {
    const fillStr = (obj.fill as string) || 'transparent';
    const strokeStr = (obj.stroke as string) || '';
    const strokeW = (obj.strokeWidth || 0) * scaleX;

    const hasFill = fillStr && fillStr !== 'transparent' && fillStr !== 'none';
    const hasStroke = strokeStr && strokeStr !== 'transparent' && strokeStr !== 'none' && strokeW > 0;

    if (!hasFill && !hasStroke) return;

    // Centro del círculo en pantalla teniendo en cuenta la rotación de Fabric
    const rad = (angle * Math.PI) / 180;
    const centerX = left + (width / 2) * Math.cos(rad) - (height / 2) * Math.sin(rad);
    const centerY = top + (width / 2) * Math.sin(rad) + (height / 2) * Math.cos(rad);

    const centerPt = canvasToPdfPoint(
      centerX,
      centerY,
      canvasWidth,
      canvasHeight,
      pdfWidth,
      pdfHeight,
      pageRotation
    );

    const isRot90or270 = pageRotation === 90 || pageRotation === 270;
    const sX = isRot90or270 ? pdfHeight / canvasWidth : pdfWidth / canvasWidth;
    const sY = isRot90or270 ? pdfWidth / canvasHeight : pdfHeight / canvasHeight;

    const xRadius = (width * sX) / 2;
    const yRadius = (height * sY) / 2;

    let rotDegrees = (pageRotation - angle) % 360;
    if (rotDegrees < 0) rotDegrees += 360;

    page.drawEllipse({
      x: centerPt.x,
      y: centerPt.y,
      xScale: isRot90or270 ? yRadius : xRadius,
      yScale: isRot90or270 ? xRadius : yRadius,
      color: hasFill ? toPdfColor(fillStr) : undefined,
      borderColor: hasStroke ? toPdfColor(strokeStr) : undefined,
      borderWidth: hasStroke ? strokeW : 0,
      opacity,
      rotate: degrees(rotDegrees),
    });
    return;
  }

  // 4. Line
  if (objType === 'line') {
    const lineObj = obj as any;
    let pt1 = { x: left, y: top };
    let pt2 = { x: left + width, y: top };

    // Usar calcLinePoints() y calcTransformMatrix() para puntos exactos bajo cualquier transformación
    if (typeof lineObj.calcLinePoints === 'function' && typeof lineObj.calcTransformMatrix === 'function') {
      const pts = lineObj.calcLinePoints();
      const matrix = lineObj.calcTransformMatrix();
      const pA = fabric.util.transformPoint(new fabric.Point(pts.x1, pts.y1), matrix);
      const pB = fabric.util.transformPoint(new fabric.Point(pts.x2, pts.y2), matrix);
      pt1 = { x: pA.x, y: pA.y };
      pt2 = { x: pB.x, y: pB.y };
    }

    const p1 = canvasToPdfPoint(
      pt1.x,
      pt1.y,
      canvasWidth,
      canvasHeight,
      pdfWidth,
      pdfHeight,
      pageRotation
    );
    const p2 = canvasToPdfPoint(
      pt2.x,
      pt2.y,
      canvasWidth,
      canvasHeight,
      pdfWidth,
      pdfHeight,
      pageRotation
    );

    const strokeStr = (obj.stroke as string) || '#e5322d';
    const strokeThickness = Math.max(1, (obj.strokeWidth || 1) * scaleX);

    page.drawLine({
      start: { x: p1.x, y: p1.y },
      end: { x: p2.x, y: p2.y },
      thickness: strokeThickness,
      color: toPdfColor(strokeStr),
      opacity,
    });
    return;
  }

  // 5. Image (fabric.FabricImage)
  if (objType === 'image') {
    try {
      const dataUrl = obj.toDataURL({ format: 'png' });
      const parts = dataUrl.split(',');
      if (parts.length < 2 || !parts[1]) {
        return;
      }
      const base64Data = parts[1];
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const embeddedImg = await pdfDoc.embedPng(bytes);

      const transform = calculateObjectTransform(
        left,
        top,
        width,
        height,
        angle,
        canvasWidth,
        canvasHeight,
        pdfWidth,
        pdfHeight,
        pageRotation
      );

      page.drawImage(embeddedImg, {
        x: transform.x,
        y: transform.y,
        width: transform.width,
        height: transform.height,
        opacity,
        rotate: degrees(transform.rotateDegrees),
      });
    } catch (imgErr) {
      console.warn('Failed to embed fabric image:', imgErr);
    }
    return;
  }
}

/**
 * Descarga los bytes del PDF en el navegador de manera segura y libera el ObjectURL.
 * Garantiza la extensión obligatoria .pdf y sanitiza path traversal.
 * Tiempo de retención de URL de 60s para prevenir fallos de descarga asíncrona en Safari.
 */
export function downloadPdf(bytes: Uint8Array, filename = 'documento_editado.pdf') {
  const safeName = ensurePdfExtension(filename, 'documento_editado.pdf');
  const bufferSlice = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([bufferSlice], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revocación asíncrona segura (60s) para asegurar que el stream se complete en Safari y Firefox
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}
