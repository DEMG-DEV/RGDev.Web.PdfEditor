import { pdfjsLib } from './pdfWorker';
import type { PageMeta } from '@/types';
import { MAX_PDF_PAGES } from './security';

export async function loadPdfDocument(arrayBuffer: ArrayBuffer) {
  // Pass a cloned slice to avoid detached ArrayBuffer issues
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer.slice(0)),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
    cMapPacked: true,
  });

  try {
    const doc = await loadingTask.promise;

    // Validación anti-DoS: prevenir colapso de memoria por documentos con número excesivo de páginas
    if (doc.numPages > MAX_PDF_PAGES) {
      try {
        doc.destroy();
      } catch {
        // ignore
      }
      throw new Error(
        `El documento contiene ${doc.numPages} páginas, superando el límite de seguridad de ${MAX_PDF_PAGES} páginas para edición en memoria del navegador.`
      );
    }

    if (doc.numPages === 0) {
      try {
        doc.destroy();
      } catch {
        // ignore
      }
      throw new Error('El documento PDF no contiene ninguna página válida.');
    }

    const metas: Record<number, PageMeta> = {};

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        // Obtenemos las dimensiones intrínsecas sin rotación (rotation: 0)
        // para mantener paridad exacta con el sistema de coordenadas base de pdf-lib (MediaBox)
        const unrotatedViewport = page.getViewport({ scale: 1.0, rotation: 0 });
        metas[i] = {
          pageNumber: i,
          originalWidth: unrotatedViewport.width,
          originalHeight: unrotatedViewport.height,
          currentRotation: page.rotate || 0,
        };
      } finally {
        // Liberar recursos internos de la página en la caché de PDF.js
        page.cleanup();
      }
    }

    return { doc, metas };
  } catch (err) {
    try {
      loadingTask.destroy();
    } catch {
      // ignore
    }
    throw err;
  }
}
