import React, { useRef } from 'react';
import { usePdfStore } from '@/store/usePdfStore';
import { PdfCanvasPage } from './PdfCanvasPage';
import { FileQuestion } from 'lucide-react';

export const PdfViewer: React.FC = () => {
  const pdfDoc = usePdfStore((s) => s.pdfDoc);
  const pageOrder = usePdfStore((s) => s.pageOrder);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!pdfDoc || pageOrder.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 bg-slate-100">
        <FileQuestion className="w-16 h-16 text-slate-400 mb-3" />
        <h3 className="text-lg font-bold text-slate-700">No hay páginas para mostrar</h3>
        <p className="text-sm text-slate-500 max-w-sm text-center mt-1">
          Has eliminado todas las páginas del documento o no se ha cargado ningún archivo aún.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-slate-200/70 p-6 md:p-8 flex flex-col items-center"
    >
      <div className="w-full max-w-full flex flex-col items-center">
        {pageOrder.map((pageNum) => (
          <PdfCanvasPage
            key={pageNum}
            pageNumber={pageNum}
            pdfDoc={pdfDoc}
          />
        ))}
      </div>
    </div>
  );
};
