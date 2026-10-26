import React, { useState } from 'react';
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { exportEditedPdf, downloadPdf } from '@/services/pdfExporter';
import { formatFileSize } from '@/utils/coordinateConverter';
import { sanitizeFileName, ensurePdfExtension } from '@/utils/security';
import { UserMenu } from '@/components/UserMenu';
import { useAuthStore } from '@/store/useAuthStore';

export const Header: React.FC = () => {
  const file = usePdfStore((s) => s.file);
  const scale = usePdfStore((s) => s.scale);
  const zoomIn = usePdfStore((s) => s.zoomIn);
  const zoomOut = usePdfStore((s) => s.zoomOut);
  const resetZoom = usePdfStore((s) => s.resetZoom);
  const undo = usePdfStore((s) => s.undo);
  const redo = usePdfStore((s) => s.redo);
  const undoStack = usePdfStore((s) => s.undoStack);
  const redoStack = usePdfStore((s) => s.redoStack);
  const isExporting = usePdfStore((s) => s.isExporting);
  const setExporting = usePdfStore((s) => s.setExporting);
  const isSidebarOpen = usePdfStore((s) => s.isSidebarOpen);
  const toggleSidebar = usePdfStore((s) => s.toggleSidebar);
  const resetAll = usePdfStore((s) => s.resetAll);
  const addToast = usePdfStore((s) => s.addToast);

  const pageOrder = usePdfStore((s) => s.pageOrder);
  const rotations = usePdfStore((s) => s.rotations);
  const canvases = usePdfStore((s) => s.canvases);
  const pageMetas = usePdfStore((s) => s.pageMetas);

  const canExport = useAuthStore((s) => s.canExport);
  const recordExport = useAuthStore((s) => s.recordExport);
  const openPricingModal = useAuthStore((s) => s.openPricingModal);

  const [docName, setDocName] = useState(file?.name || 'documento.pdf');
  const [isEditingName, setIsEditingName] = useState(false);

  // Sync if file name changes
  React.useEffect(() => {
    if (file?.name) {
      setDocName(file.name);
    }
  }, [file?.name]);

  const handleExport = async () => {
    if (!file) return;

    // Verificar cuota y límites de plan (Stripe Paywall)
    const check = canExport(pageOrder.length, file.size);
    if (!check.allowed) {
      openPricingModal(check.reason);
      return;
    }

    try {
      setExporting(true);
      addToast('Generando documento PDF de alta calidad...', 'info');

      const editedBytes = await exportEditedPdf({
        originalPdfBuffer: file.arrayBuffer,
        pageOrder,
        rotations,
        canvases,
        pageMetas,
      });

      const safeBase = sanitizeFileName(docName.trim(), 'documento');
      const baseNoExt = safeBase.replace(/\.pdf$/i, '');
      const exportFileName = `${baseNoExt}_editado.pdf`;

      downloadPdf(editedBytes, exportFileName);
      await recordExport();
      addToast('¡PDF descargado con éxito!', 'success');
    } catch (err: unknown) {
      console.error('Error exporting PDF:', err);
      const errMsg =
        err instanceof Error ? err.message : 'Error al exportar el archivo PDF. Intenta nuevamente.';
      addToast(errMsg, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    const cleaned = ensurePdfExtension(docName.trim(), 'documento.pdf');
    setDocName(cleaned);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shadow-xs select-none z-30 shrink-0">
      {/* Left section: Logo & Document Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900 text-lg hidden sm:inline tracking-tight">
            RGDev <span className="text-red-600 font-extrabold">PDF</span>
          </span>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* File Name */}
        <div className="flex items-center gap-2 min-w-0">
          {isEditingName ? (
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
              autoFocus
              className="text-sm font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded px-2 py-1 outline-hidden focus:ring-2 focus:ring-red-500 max-w-[200px]"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm font-semibold text-slate-800 truncate hover:text-red-600 transition-colors max-w-[160px] sm:max-w-[240px] text-left"
              title="Haz clic para renombrar"
            >
              {docName}
            </button>
          )}

          {file && (
            <span className="text-xs text-slate-600 bg-slate-100 font-medium px-2 py-0.5 rounded-full hidden md:inline shrink-0">
              {formatFileSize(file.size)}
            </span>
          )}
        </div>
      </div>

      {/* Center section: Undo/Redo & Zoom Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/80 p-0.5">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Deshacer (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Rehacer (Ctrl+Y)"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/80 p-0.5">
          <button
            onClick={zoomOut}
            title="Alejar (-)"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            title="Restablecer zoom al 100%"
            className="px-2 text-xs font-semibold text-slate-700 hover:text-slate-900 min-w-[50px] text-center"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            title="Acercar (+)"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right section: Actions, User Menu & Download Button */}
      <div className="flex items-center gap-2">
        <UserMenu />

        <button
          onClick={resetAll}
          title="Abrir otro PDF"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden sm:flex items-center gap-1.5 text-xs font-medium"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Abrir otro</span>
        </button>

        {/* Main CTA */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-md shadow-red-600/25 transition-all active:scale-95 disabled:opacity-50"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="hidden sm:inline">Exportando...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
