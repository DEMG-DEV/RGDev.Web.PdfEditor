import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates an in-memory 3-page rich sample PDF to test editing features immediately
 */
export async function createDemoPdf(): Promise<{ buffer: ArrayBuffer; name: string; size: number }> {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // PAGE 1: Welcome & Overview
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4 (points)
  const { width: p1W, height: p1H } = page1.getSize();

  // Header band
  page1.drawRectangle({
    x: 0,
    y: p1H - 120,
    width: p1W,
    height: 120,
    color: rgb(0.9, 0.15, 0.15),
  });

  page1.drawText('RGDev PDF Editor', {
    x: 48,
    y: p1H - 60,
    size: 28,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText('Documento de Demostración y Pruebas', {
    x: 48,
    y: p1H - 90,
    size: 15,
    font: fontRegular,
    color: rgb(1, 0.9, 0.9),
  });

  // Body content
  page1.drawText('Bienvenido al editor interactivo de PDF', {
    x: 48,
    y: p1H - 160,
    size: 18,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.22),
  });

  const introParagraph = [
    'Este documento de prueba te permite explorar todas las capacidades del editor:',
    '• Añadir cuadros de texto con formato (fuente, tamaño, negrita, cursiva, alineación).',
    '• Dibujar trazos a mano alzada con pincel de alta precisión.',
    '• Insertar formas geométricas como rectángulos, círculos y líneas con colores personalizados.',
    '• Insertar imágenes PNG o JPG y colocarlas donde quieras.',
    '• Reordenar páginas, rotarlas 90° o eliminar páginas no deseadas en el panel lateral.',
    '• Exportar el documento resultante con precisión vectorial.',
  ];

  let currentY = p1H - 200;
  introParagraph.forEach((line) => {
    page1.drawText(line, {
      x: 48,
      y: currentY,
      size: 12,
      font: fontRegular,
      color: rgb(0.25, 0.3, 0.38),
    });
    currentY -= 24;
  });

  // Callout box
  page1.drawRectangle({
    x: 48,
    y: currentY - 80,
    width: p1W - 96,
    height: 70,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.8, 0.85, 0.92),
    borderWidth: 1,
  });

  page1.drawText('💡 Consejo: Prueba seleccionar la herramienta de texto o lápiz arriba', {
    x: 64,
    y: currentY - 45,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.35, 0.7),
  });

  page1.drawText('Haz clic en cualquier parte de esta página para escribir notas o comentarios.', {
    x: 64,
    y: currentY - 65,
    size: 10,
    font: fontRegular,
    color: rgb(0.35, 0.45, 0.55),
  });

  // Footer
  page1.drawText('Página 1 de 3 — Generado por RGDev PDF Editor', {
    x: 48,
    y: 36,
    size: 9,
    font: fontRegular,
    color: rgb(0.6, 0.65, 0.7),
  });

  // PAGE 2: Sample Invoice / Table
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  const { width: p2W, height: p2H } = page2.getSize();

  page2.drawText('REPORTE Y FACTURA DE EJEMPLO', {
    x: 48,
    y: p2H - 60,
    size: 20,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.22),
  });

  page2.drawText('Folio: #INV-2026-0042  •  Fecha: Octubre 2026', {
    x: 48,
    y: p2H - 85,
    size: 11,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.52),
  });

  // Table header
  page2.drawRectangle({
    x: 48,
    y: p2H - 130,
    width: p2W - 96,
    height: 30,
    color: rgb(0.93, 0.95, 0.98),
  });

  page2.drawText('DESCRIPCIÓN', { x: 60, y: p2H - 120, size: 10, font: fontBold, color: rgb(0.2, 0.25, 0.3) });
  page2.drawText('CANT.', { x: 340, y: p2H - 120, size: 10, font: fontBold, color: rgb(0.2, 0.25, 0.3) });
  page2.drawText('PRECIO', { x: 410, y: p2H - 120, size: 10, font: fontBold, color: rgb(0.2, 0.25, 0.3) });
  page2.drawText('TOTAL', { x: 490, y: p2H - 120, size: 10, font: fontBold, color: rgb(0.2, 0.25, 0.3) });

  // Table rows
  const items = [
    { desc: 'Licencia RGDev PDF Pro Anual', qty: '1', price: '$120.00', total: '$120.00' },
    { desc: 'Módulo de Conversión Avanzada OCR', qty: '1', price: '$45.00', total: '$45.00' },
    { desc: 'Soporte Técnico Prioritario 24/7', qty: '12', price: '$10.00', total: '$120.00' },
  ];

  let rowY = p2H - 160;
  items.forEach((item) => {
    page2.drawText(item.desc, { x: 60, y: rowY, size: 11, font: fontRegular, color: rgb(0.2, 0.25, 0.3) });
    page2.drawText(item.qty, { x: 350, y: rowY, size: 11, font: fontRegular, color: rgb(0.2, 0.25, 0.3) });
    page2.drawText(item.price, { x: 415, y: rowY, size: 11, font: fontRegular, color: rgb(0.2, 0.25, 0.3) });
    page2.drawText(item.total, { x: 495, y: rowY, size: 11, font: fontRegular, color: rgb(0.2, 0.25, 0.3) });

    page2.drawLine({
      start: { x: 48, y: rowY - 10 },
      end: { x: p2W - 48, y: rowY - 10 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    rowY -= 32;
  });

  // Total box
  page2.drawRectangle({
    x: 380,
    y: rowY - 40,
    width: p2W - 48 - 380,
    height: 35,
    color: rgb(0.9, 0.15, 0.15),
  });

  page2.drawText('TOTAL: $285.00 USD', {
    x: 395,
    y: rowY - 28,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page2.drawText('Página 2 de 3 — Generado por RGDev PDF Editor', {
    x: 48,
    y: 36,
    size: 9,
    font: fontRegular,
    color: rgb(0.6, 0.65, 0.7),
  });

  // PAGE 3: Certificate / Signature Area
  const page3 = pdfDoc.addPage([595.28, 841.89]);
  const { width: p3W, height: p3H } = page3.getSize();

  // Border frame
  page3.drawRectangle({
    x: 32,
    y: 32,
    width: p3W - 64,
    height: p3H - 64,
    borderColor: rgb(0.9, 0.15, 0.15),
    borderWidth: 2,
  });

  page3.drawText('CERTIFICADO DE CONFORMIDAD', {
    x: 130,
    y: p3H - 120,
    size: 20,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.22),
  });

  page3.drawText('Por medio del presente documento se hace constar que:', {
    x: 80,
    y: p3H - 180,
    size: 13,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.42),
  });

  page3.drawText('Usuario de Pruebas RGDev', {
    x: 160,
    y: p3H - 220,
    size: 18,
    font: fontBold,
    color: rgb(0.9, 0.15, 0.15),
  });

  page3.drawLine({
    start: { x: 120, y: p3H - 230 },
    end: { x: p3W - 120, y: p3H - 230 },
    thickness: 1,
    color: rgb(0.7, 0.75, 0.8),
  });

  page3.drawText('Ha completado satisfactoriamente la validación del editor interactivo.', {
    x: 90,
    y: p3H - 270,
    size: 12,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.42),
  });

  // Signature box
  page3.drawRectangle({
    x: 140,
    y: 130,
    width: p3W - 280,
    height: 90,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page3.drawText('✍️ Espacio para Firma Digital o Dibujo Manual', {
    x: 160,
    y: 195,
    size: 10,
    font: fontBold,
    color: rgb(0.5, 0.55, 0.65),
  });

  page3.drawText('(Usa la herramienta Dibujo para firmar aquí)', {
    x: 180,
    y: 145,
    size: 9,
    font: fontRegular,
    color: rgb(0.65, 0.7, 0.75),
  });

  page3.drawText('Página 3 de 3 — Generado por RGDev PDF Editor', {
    x: 48,
    y: 44,
    size: 9,
    font: fontRegular,
    color: rgb(0.6, 0.65, 0.7),
  });

  const pdfBytes = await pdfDoc.save();
  const buffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;

  return {
    buffer,
    name: 'demostracion_rgdev.pdf',
    size: buffer.byteLength,
  };
}
