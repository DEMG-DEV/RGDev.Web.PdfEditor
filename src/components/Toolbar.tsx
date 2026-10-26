import React, { useRef } from 'react';
import {
  MousePointer,
  Type,
  Image as ImageIcon,
  Pencil,
  Square,
  Circle as CircleIcon,
  Minus,
  Trash2,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import type { ToolType } from '@/types';
import * as fabric from 'fabric';
import { validateImageFile, sanitizeSvgXml } from '@/utils/security';
import { deleteFabricObject } from '@/utils/coordinateConverter';

export const Toolbar: React.FC = () => {
  const activeTool = usePdfStore((s) => s.activeTool);
  const setActiveTool = usePdfStore((s) => s.setActiveTool);
  const selectedObject = usePdfStore((s) => s.selectedObject);
  const setSelectedObject = usePdfStore((s) => s.setSelectedObject);
  const activePage = usePdfStore((s) => s.activePage);
  const canvases = usePdfStore((s) => s.canvases);
  const recordCanvasState = usePdfStore((s) => s.recordCanvasState);
  const addToast = usePdfStore((s) => s.addToast);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const tools: Array<{ id: ToolType; label: string; icon: React.ReactNode }> = [
    { id: 'select', label: 'Seleccionar (V)', icon: <MousePointer className="w-4 h-4" /> },
    { id: 'text', label: 'Añadir Texto (T)', icon: <Type className="w-4 h-4" /> },
    { id: 'image', label: 'Insertar Imagen', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'draw', label: 'Dibujar a mano (P)', icon: <Pencil className="w-4 h-4" /> },
    { id: 'rectangle', label: 'Rectángulo (R)', icon: <Square className="w-4 h-4" /> },
    { id: 'circle', label: 'Círculo (C)', icon: <CircleIcon className="w-4 h-4" /> },
    { id: 'line', label: 'Línea (L)', icon: <Minus className="w-4 h-4" /> },
  ];

  const handleToolClick = (toolId: ToolType) => {
    if (toolId === 'image') {
      imageInputRef.current?.click();
    } else {
      setActiveTool(toolId);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // 1. Validación de seguridad de archivo de imagen (tamaño, tipo y magic bytes reales)
    const validation = await validateImageFile(file);
    if (!validation.valid) {
      addToast(validation.error || 'Archivo de imagen no válido.', 'error');
      return;
    }

    const canvas = canvases[activePage];
    if (!canvas) {
      addToast('Selecciona una página primero para insertar la imagen', 'error');
      return;
    }

    let imageSrc = '';
    let isObjectUrl = false;

    try {
      // 2. Si es SVG, sanitización profunda contra XSS
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      if (isSvg) {
        const rawSvgText = await file.text();
        const cleanSvg = sanitizeSvgXml(rawSvgText);
        const svgBlob = new Blob([cleanSvg], { type: 'image/svg+xml' });
        imageSrc = URL.createObjectURL(svgBlob);
        isObjectUrl = true;
      } else {
        const imageBlob = new Blob([await file.arrayBuffer()], { type: file.type });
        imageSrc = URL.createObjectURL(imageBlob);
        isObjectUrl = true;
      }

      // 3. Crear FabricImage
      const img = await fabric.FabricImage.fromURL(imageSrc);

      // Dimensiones de escena reales (independientes del zoom de pantalla)
      const currentZoom = canvas.getZoom() || 1;
      const sceneWidth = canvas.getWidth() / currentZoom;
      const sceneHeight = canvas.getHeight() / currentZoom;

      // Escalar la imagen a un tamaño razonable respecto al canvas
      const maxWidth = sceneWidth * 0.45;
      const maxHeight = sceneHeight * 0.45;
      let scale = 1;

      if (img.width && img.height) {
        const scaleX = maxWidth / img.width;
        const scaleY = maxHeight / img.height;
        scale = Math.min(1, Math.min(scaleX, scaleY));
      }

      img.set({
        left: (sceneWidth - (img.width || 200) * scale) / 2,
        top: (sceneHeight - (img.height || 200) * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        cornerColor: '#e5322d',
        cornerStrokeColor: '#ffffff',
        borderColor: '#e5322d',
        cornerSize: 10,
        transparentCorners: false,
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      recordCanvasState(activePage);
      setSelectedObject(img);
      setActiveTool('select');
      addToast('Imagen añadida con éxito', 'success');
    } catch (err) {
      console.error('Error adding image:', err);
      addToast('No se pudo procesar la imagen seleccionada.', 'error');
    } finally {
      // Garantizar la liberación inmediata del ObjectURL en memoria sin fugas
      if (isObjectUrl && imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedObject) return;
    const canvas = selectedObject.canvas;
    if (!canvas) return;

    recordCanvasState(activePage);
    deleteFabricObject(canvas, selectedObject);
    setSelectedObject(null);
    addToast('Elemento eliminado', 'info');
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-center gap-1 sm:gap-2 shadow-xs shrink-0 select-none overflow-x-auto">
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageUpload}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
      />

      <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              title={tool.label}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              {tool.icon}
              <span className="hidden md:inline">{tool.label.split(' (')[0]}</span>
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-slate-200 mx-1" />

      {/* Delete selected object button */}
      <button
        onClick={handleDeleteSelected}
        disabled={!selectedObject}
        title="Eliminar elemento seleccionado (Supr / Backspace)"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
      >
        <Trash2 className="w-4 h-4" />
        <span className="hidden lg:inline">Eliminar</span>
      </button>
    </div>
  );
};
