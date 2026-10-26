import React, { useEffect } from 'react';
import { usePdfStore } from '@/store/usePdfStore';
import { useAuthStore } from '@/store/useAuthStore';
import { UploadZone } from '@/components/UploadZone';
import { Header } from '@/components/Header';
import { Toolbar } from '@/components/Toolbar';
import { ToolOptionsBar } from '@/components/ToolOptionsBar';
import { Sidebar } from '@/components/Sidebar';
import { PdfViewer } from '@/components/PdfViewer';
import { PricingModal } from '@/components/PricingModal';
import { AuthModal } from '@/components/AuthModal';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { deleteFabricObject } from '@/utils/coordinateConverter';

export const App: React.FC = () => {
  const initAuth = useAuthStore((s) => s.initAuth);
  const file = usePdfStore((s) => s.file);
  const undo = usePdfStore((s) => s.undo);
  const redo = usePdfStore((s) => s.redo);
  const zoomIn = usePdfStore((s) => s.zoomIn);
  const zoomOut = usePdfStore((s) => s.zoomOut);
  const resetZoom = usePdfStore((s) => s.resetZoom);
  const setActiveTool = usePdfStore((s) => s.setActiveTool);
  const selectedObject = usePdfStore((s) => s.selectedObject);
  const setSelectedObject = usePdfStore((s) => s.setSelectedObject);
  const activePage = usePdfStore((s) => s.activePage);
  const recordCanvasState = usePdfStore((s) => s.recordCanvasState);
  const toasts = usePdfStore((s) => s.toasts);
  const removeToast = usePdfStore((s) => s.removeToast);
  const addToast = usePdfStore((s) => s.addToast);

  // Inicializar autenticación y detectar retorno de Stripe Checkout
  useEffect(() => {
    initAuth();

    // Comprobar parámetros de retorno de Stripe
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');

    if (checkoutStatus === 'success') {
      addToast('¡Suscripción completada con éxito! Tu cuenta RGDev Pro está activa.', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (checkoutStatus === 'cancelled') {
      addToast('El proceso de suscripción fue cancelado.', 'info');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [initAuth, addToast]);

  // Atajos globales de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // Detectar si el usuario está interactuando con un campo de formulario o elemento editable
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"]') !== null);

      // Comprobar con guardia de tipos si un objeto de texto de Fabric está en modo edición activa
      const isEditingFabricText = Boolean(
        selectedObject &&
          'isEditing' in selectedObject &&
          (selectedObject as { isEditing?: boolean }).isEditing
      );

      // Si está editando un texto en Fabric, solo permitir que Escape salga del modo edición
      if (isEditingFabricText) {
        if (e.key === 'Escape') {
          (selectedObject as any)?.exitEditing?.();
          return;
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Deshacer / Rehacer: Solo si el usuario NO está escribiendo en un input HTML
      if (!isInput) {
        // Undo: Ctrl+Z or Cmd+Z
        if (cmdOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }

        // Redo: Ctrl+Y or Cmd+Shift+Z
        if (
          (cmdOrCtrl && e.key.toLowerCase() === 'y') ||
          (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')
        ) {
          e.preventDefault();
          redo();
          return;
        }
      }

      // Zoom in: Ctrl + '+' or '='
      if (cmdOrCtrl && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        zoomIn();
        return;
      }

      // Zoom out: Ctrl + '-'
      if (cmdOrCtrl && e.key === '-') {
        e.preventDefault();
        zoomOut();
        return;
      }

      // Reset zoom: Ctrl + '0'
      if (cmdOrCtrl && e.key === '0') {
        e.preventDefault();
        resetZoom();
        return;
      }

      // Eliminar: Delete o Backspace (solo si no es un input HTML y no está editando texto)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedObject && selectedObject.canvas) {
          e.preventDefault();
          const canvas = selectedObject.canvas;
          recordCanvasState(activePage);
          deleteFabricObject(canvas, selectedObject);
          setSelectedObject(null);
        }
        return;
      }

      // Escape: volver a la herramienta de selección
      if (e.key === 'Escape') {
        setActiveTool('select');
        if (selectedObject && selectedObject.canvas) {
          selectedObject.canvas.discardActiveObject();
          selectedObject.canvas.requestRenderAll();
          setSelectedObject(null);
        }
      }

      // Atajos de herramientas con teclas directas (V, T, P, R, C, L)
      if (!isInput && !cmdOrCtrl) {
        switch (e.key.toLowerCase()) {
          case 'v':
            setActiveTool('select');
            break;
          case 't':
            setActiveTool('text');
            break;
          case 'p':
            setActiveTool('draw');
            break;
          case 'r':
            setActiveTool('rectangle');
            break;
          case 'c':
            setActiveTool('circle');
            break;
          case 'l':
            setActiveTool('line');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedObject,
    activePage,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
    setActiveTool,
    setSelectedObject,
    recordCanvasState,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-slate-800 font-sans">
      {!file ? (
        <UploadZone />
      ) : (
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Header */}
          <Header />

          {/* Barra de herramientas y opciones */}
          <Toolbar />
          <ToolOptionsBar />

          {/* Espacio de trabajo principal (Sidebar + Viewer) */}
          <div className="flex flex-1 overflow-hidden relative">
            <Sidebar />
            <PdfViewer />
          </div>
        </div>
      )}

      {/* Modales de Monetización y Autenticación */}
      <PricingModal />
      <AuthModal />

      {/* Notificaciones Toast flotantes */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all transform translate-y-0 opacity-100 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}

            <span>{toast.message}</span>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
