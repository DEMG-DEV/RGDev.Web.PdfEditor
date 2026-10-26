import React, { useEffect, useRef } from 'react';
import {
  RotateCw,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';

interface ThumbnailItemProps {
  pageNumber: number;
  index: number;
  totalCount: number;
  isActive: boolean;
  pdfDoc: PDFDocumentProxy;
  rotation: number;
  onSelect: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMove?: (fromIndex: number, toIndex: number) => void;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
  pageNumber,
  index,
  totalCount,
  isActive,
  pdfDoc,
  rotation,
  onSelect,
  onRotate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderThumbnail = async () => {
      if (!canvasRef.current || !pdfDoc) return;
      let page: PDFPageProxy | null = null;

      // Cancelar tarea previa si aún está corriendo
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      try {
        page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        // Sumar rotación intrínseca de la página con la rotación del usuario
        const totalRotation = ((page.rotate || 0) + rotation) % 360;
        const baseViewport = page.getViewport({ scale: 0.22, rotation: totalRotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Ajuste nítido para pantallas High-DPI / Retina
        const dpr = window.devicePixelRatio || 1;
        const width = Math.floor(baseViewport.width);
        const height = Math.floor(baseViewport.height);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport: baseViewport,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: unknown) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'name' in err &&
          (err as { name: string }).name === 'RenderingCancelledException'
        ) {
          // Cancelación esperada
        } else {
          // Fallo no crítico de miniatura
        }
      } finally {
        if (page) {
          try {
            page.cleanup();
          } catch {
            // ignore
          }
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, rotation]);

  return (
    <div
      onClick={onSelect}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const fromIdxStr = e.dataTransfer.getData('text/plain');
        const fromIdx = parseInt(fromIdxStr, 10);
        if (!isNaN(fromIdx) && fromIdx !== index && onMove) {
          onMove(fromIdx, index);
        }
      }}
      className={`group relative flex flex-col items-center p-3 rounded-xl cursor-pointer transition-all border-2 ${
        isActive
          ? 'bg-red-50/50 border-red-500 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {/* Page number badge */}
      <div className="w-full flex items-center justify-between mb-2">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${
            isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          Pág. {pageNumber}
        </span>

        {/* Thumbnail Action Buttons */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition-opacity"
        >
          {/* Rotate */}
          <button
            type="button"
            onClick={onRotate}
            title="Rotar 90°"
            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Move up */}
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            title="Mover arriba"
            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-20 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Move down */}
          <button
            type="button"
            disabled={index === totalCount - 1}
            onClick={onMoveDown}
            title="Mover abajo"
            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-20 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          {totalCount > 1 && (
            <button
              type="button"
              onClick={onDelete}
              title="Eliminar página"
              className="p-1 rounded hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Miniature preview canvas */}
      <div className="w-full flex items-center justify-center bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-2xs overflow-hidden min-h-[140px]">
        <canvas ref={canvasRef} className="max-w-full h-auto rounded shadow-xs" />
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const isSidebarOpen = usePdfStore((s) => s.isSidebarOpen);
  const pdfDoc = usePdfStore((s) => s.pdfDoc);
  const pageOrder = usePdfStore((s) => s.pageOrder);
  const rotations = usePdfStore((s) => s.rotations);
  const activePage = usePdfStore((s) => s.activePage);
  const setActivePage = usePdfStore((s) => s.setActivePage);
  const rotatePage = usePdfStore((s) => s.rotatePage);
  const deletePage = usePdfStore((s) => s.deletePage);
  const movePage = usePdfStore((s) => s.movePage);

  if (!isSidebarOpen || !pdfDoc) return null;

  const handleSelectPage = (pageNum: number) => {
    setActivePage(pageNum);
    const element = document.getElementById(`pdf-page-${pageNum}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col h-full select-none shrink-0 overflow-hidden shadow-xs">
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Páginas ({pageOrder.length})
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pageOrder.map((pageNum, idx) => (
          <ThumbnailItem
            key={pageNum}
            pageNumber={pageNum}
            index={idx}
            totalCount={pageOrder.length}
            isActive={activePage === pageNum}
            pdfDoc={pdfDoc}
            rotation={rotations[pageNum] || 0}
            onSelect={() => handleSelectPage(pageNum)}
            onRotate={() => rotatePage(pageNum, 90)}
            onDelete={() => deletePage(pageNum)}
            onMoveUp={() => movePage(idx, idx - 1)}
            onMoveDown={() => movePage(idx, idx + 1)}
            onMove={movePage}
          />
        ))}
      </div>
    </aside>
  );
};
