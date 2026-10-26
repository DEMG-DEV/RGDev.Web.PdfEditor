import React, { useState, useRef } from 'react';
import { Upload, FileText, Sparkles, ShieldCheck, Zap, Lock, Crown } from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { loadPdfDocument } from '@/utils/pdfLoader';
import { createDemoPdf } from '@/utils/demoPdf';
import { validatePdfFile, sanitizeFileName, ensurePdfExtension } from '@/utils/security';
import { UserMenu } from '@/components/UserMenu';
import { useAuthStore } from '@/store/useAuthStore';

export const UploadZone: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAll = usePdfStore((s) => s.resetAll);
  const setFile = usePdfStore((s) => s.setFile);
  const setPdfDoc = usePdfStore((s) => s.setPdfDoc);
  const addToast = usePdfStore((s) => s.addToast);

  const handleProcessFile = async (file: File) => {
    // 1. Validación de seguridad profunda (tamaño máx 100MB, formato, cabecera mágica %PDF-)
    const validation = await validatePdfFile(file);
    if (!validation.valid) {
      addToast(validation.error || 'Archivo PDF no válido.', 'error');
      return;
    }

    try {
      setIsLoading(true);

      // Limpiar documento previo para liberar Web Workers y canvases de memoria
      resetAll();

      const arrayBuffer = await file.arrayBuffer();
      const { doc, metas } = await loadPdfDocument(arrayBuffer);

      const safeName = ensurePdfExtension(file.name, 'documento.pdf');

      setFile({
        name: safeName,
        size: file.size,
        arrayBuffer,
      });
      setPdfDoc(doc, metas);
      addToast(`Documento cargado con éxito: ${doc.numPages} páginas`, 'success');
    } catch (err: unknown) {
      console.error('Error loading PDF:', err);
      const errMsg =
        err instanceof Error
          ? err.message
          : 'No se pudo procesar el archivo PDF. Verifica que no esté dañado ni protegido por contraseña.';
      addToast(errMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
    // Reset input value to allow selecting same file again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleLoadDemo = async () => {
    try {
      setIsLoading(true);
      resetAll();

      const demo = await createDemoPdf();
      const { doc, metas } = await loadPdfDocument(demo.buffer);

      setFile({
        name: sanitizeFileName(demo.name, 'demostracion.pdf'),
        size: demo.size,
        arrayBuffer: demo.buffer,
      });
      setPdfDoc(doc, metas);
      addToast('¡PDF de demostración cargado correctamente!', 'success');
    } catch (err) {
      console.error('Error loading demo PDF:', err);
      addToast('Error al generar el PDF de demostración', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-full w-full flex flex-col justify-between items-center transition-colors duration-200 ${
        isDragging ? 'bg-red-50/60' : 'bg-slate-50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Navbar */}
      <header className="w-full h-16 px-6 flex items-center justify-between border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-red-500/30">
            RG
          </div>
          <span className="font-bold text-slate-800 text-sm tracking-tight">
            RGDev <span className="text-red-600">PDF Editor</span>
          </span>
        </div>
        <UserMenu />
      </header>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf,.pdf"
        className="hidden"
      />

      <div className="max-w-2xl w-full text-center space-y-6 my-auto px-4 py-8">
        {/* Title & Subtitle */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-4 h-4" />
            Editor de PDF Online Gratuito
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Editar archivos PDF
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
            Añade texto, formas, dibujos libres y firmas directamente a las páginas de tus documentos PDF con total precisión.
          </p>
        </div>

        {/* Drop Zone Box */}
        <div
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`cursor-pointer group relative border-2 border-dashed rounded-3xl p-8 sm:p-12 transition-all duration-200 bg-white ${
            isDragging
              ? 'border-red-500 bg-red-50/40 shadow-xl scale-[1.01]'
              : 'border-slate-300 hover:border-red-400 hover:shadow-lg'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-5">
            {/* Primary Action Button */}
            <button
              type="button"
              disabled={isLoading}
              className="inline-flex items-center gap-3 px-8 py-4 sm:px-10 sm:py-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-lg sm:text-xl shadow-lg shadow-red-600/30 transition-all duration-150 transform active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Procesando PDF...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span>Seleccionar archivo PDF</span>
                </>
              )}
            </button>

            <p className="text-sm text-slate-500 font-medium">
              o arrastra y suelta tu archivo PDF aquí (máximo 100 MB)
            </p>
          </div>
        </div>

        {/* Demo Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLoadDemo}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-red-500" />
            <span>Cargar PDF de demostración</span>
          </button>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 text-left border-t border-slate-200">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60">
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Rápido y Ligero</h4>
              <p className="text-xs text-slate-500 mt-0.5">Renderizado de alta velocidad directo en el navegador.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">100% Privado</h4>
              <p className="text-xs text-slate-500 mt-0.5">Tus documentos nunca salen de tu ordenador.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Sin Límite</h4>
              <p className="text-xs text-slate-500 mt-0.5">Edita y anota tantas páginas como desees sin costo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
