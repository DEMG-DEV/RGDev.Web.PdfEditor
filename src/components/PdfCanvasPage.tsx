import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { usePdfStore } from '@/store/usePdfStore';

interface PdfCanvasPageProps {
  pageNumber: number;
  pdfDoc: PDFDocumentProxy;
}

export const PdfCanvasPage: React.FC<PdfCanvasPageProps> = ({ pageNumber, pdfDoc }) => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fabricInstanceRef = useRef<fabric.Canvas | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const scale = usePdfStore((s) => s.scale);
  const userRotation = usePdfStore((s) => s.rotations[pageNumber] || 0);
  const activeTool = usePdfStore((s) => s.activeTool);
  const setActiveTool = usePdfStore((s) => s.setActiveTool);
  const toolProps = usePdfStore((s) => s.toolProps);
  const activePage = usePdfStore((s) => s.activePage);
  const setActivePage = usePdfStore((s) => s.setActivePage);
  const registerCanvas = usePdfStore((s) => s.registerCanvas);
  const unregisterCanvas = usePdfStore((s) => s.unregisterCanvas);
  const setSelectedObject = usePdfStore((s) => s.setSelectedObject);
  const recordCanvasState = usePdfStore((s) => s.recordCanvasState);

  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  // 1. Inicialización y ciclo de vida de la instancia de Fabric.js
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const fCanvas = new fabric.Canvas(fabricCanvasRef.current, {
      selection: true,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      stopContextMenu: true,
      fireRightClick: true,
    });

    fabricInstanceRef.current = fCanvas;
    registerCanvas(pageNumber, fCanvas);

    // Configuración del pincel de dibujo libre
    if (fCanvas.freeDrawingBrush) {
      fCanvas.freeDrawingBrush.color = toolProps.stroke;
      fCanvas.freeDrawingBrush.width = toolProps.strokeWidth;
    }

    // Escuchadores de selección y cambios
    const handleSelection = () => {
      const activeObj = fCanvas.getActiveObject();

      // Descartar controles activos en los demás lienzos para evitar controles huérfanos
      const allCanvases = usePdfStore.getState().canvases;
      Object.entries(allCanvases).forEach(([pStr, c]) => {
        if (c && Number(pStr) !== pageNumber) {
          c.discardActiveObject();
          c.requestRenderAll();
        }
      });

      setSelectedObject(activeObj || null);
      setActivePage(pageNumber);
    };

    const handleClearSelection = () => {
      const currentSelected = usePdfStore.getState().selectedObject;
      if (currentSelected && currentSelected.canvas === fCanvas) {
        setSelectedObject(null);
      }
    };

    const handleObjectModified = () => {
      recordCanvasState(pageNumber);
    };

    const handlePathCreated = () => {
      recordCanvasState(pageNumber);
    };

    const handleCanvasMouseDown = () => {
      if (usePdfStore.getState().activePage !== pageNumber) {
        setActivePage(pageNumber);
      }
    };

    fCanvas.on('mouse:down', handleCanvasMouseDown);
    fCanvas.on('selection:created', handleSelection);
    fCanvas.on('selection:updated', handleSelection);
    fCanvas.on('selection:cleared', handleClearSelection);
    fCanvas.on('object:modified', handleObjectModified);
    fCanvas.on('path:created', handlePathCreated);

    return () => {
      unregisterCanvas(pageNumber);
      fCanvas.off();
      try {
        fCanvas.dispose();
      } catch {
        // Ignorar
      }
      fabricInstanceRef.current = null;
    };
  }, [pageNumber]);

  // 2. Renderizado del documento PDF con PDF.js en el canvas subyacente
  useEffect(() => {
    let isCancelled = false;

    // Si había una tarea de renderizado en curso, cancelarla antes de iniciar la siguiente
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignorar
      }
    }

    const renderPage = async () => {
      if (!pdfCanvasRef.current || !pdfDoc) return;
      let page: PDFPageProxy | null = null;

      try {
        page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const totalRotation = ((page.rotate || 0) + userRotation) % 360;
        const viewport = page.getViewport({ scale, rotation: totalRotation });

        const dpr = window.devicePixelRatio || 1;
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        setPageSize({ width: viewport.width, height: viewport.height });

        // Ajuste nítido para pantallas High-DPI / Retina
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
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
          // Cancelación esperada de PDF.js
        } else {
          console.error(`Error al renderizar la página ${pageNumber}:`, err);
        }
      } finally {
        if (page) {
          try {
            page.cleanup();
          } catch {
            // Ignorar errores al limpiar recursos de página
          }
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignorar
        }
      }
    };
  }, [pdfDoc, pageNumber, scale, userRotation]);

  // 3. Sincronizar dimensiones y zoom de Fabric Canvas
  useEffect(() => {
    const fCanvas = fabricInstanceRef.current;
    if (!fCanvas) return;

    fCanvas.setDimensions({
      width: pageSize.width,
      height: pageSize.height,
    });
    fCanvas.setZoom(scale);
    fCanvas.requestRenderAll();
  }, [pageSize, scale]);

  // 4. Modos de herramientas y escuchadores de creación de figuras/texto
  useEffect(() => {
    const fCanvas = fabricInstanceRef.current;
    if (!fCanvas) return;

    if (activeTool === 'draw') {
      fCanvas.isDrawingMode = true;
      fCanvas.selection = false;
      if (fCanvas.freeDrawingBrush) {
        fCanvas.freeDrawingBrush.color = toolProps.stroke;
        fCanvas.freeDrawingBrush.width = toolProps.strokeWidth;
      }
    } else {
      fCanvas.isDrawingMode = false;
      fCanvas.selection = activeTool === 'select';
      fCanvas.defaultCursor =
        activeTool === 'text' ? 'text' : activeTool === 'select' ? 'default' : 'crosshair';
    }

    // Manejador de clics para agregar formas o texto en coordenadas de escena
    const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (activeTool === 'select' || activeTool === 'draw') return;

      const pointer = fCanvas.getScenePoint(opt.e);
      let newObj: fabric.FabricObject | null = null;

      if (activeTool === 'text') {
        const textbox = new fabric.Textbox('Haz doble clic para editar texto', {
          left: pointer.x,
          top: pointer.y,
          width: 240,
          fontSize: toolProps.fontSize,
          fontFamily: toolProps.fontFamily,
          fill: toolProps.fill,
          fontWeight: toolProps.isBold ? 'bold' : 'normal',
          fontStyle: toolProps.isItalic ? 'italic' : 'normal',
          textAlign: toolProps.textAlign,
          cornerColor: '#e5322d',
          cornerStrokeColor: '#ffffff',
          borderColor: '#e5322d',
          cornerSize: 8,
          transparentCorners: false,
        });
        newObj = textbox;
      } else if (activeTool === 'rectangle') {
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 140,
          height: 90,
          fill: toolProps.fill === 'transparent' ? 'transparent' : toolProps.fill,
          stroke: toolProps.stroke,
          strokeWidth: toolProps.strokeWidth,
          opacity: toolProps.opacity,
          cornerColor: '#e5322d',
          cornerStrokeColor: '#ffffff',
          borderColor: '#e5322d',
          cornerSize: 8,
          transparentCorners: false,
        });
        newObj = rect;
      } else if (activeTool === 'circle') {
        const circle = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 50,
          fill: toolProps.fill === 'transparent' ? 'transparent' : toolProps.fill,
          stroke: toolProps.stroke,
          strokeWidth: toolProps.strokeWidth,
          opacity: toolProps.opacity,
          cornerColor: '#e5322d',
          cornerStrokeColor: '#ffffff',
          borderColor: '#e5322d',
          cornerSize: 8,
          transparentCorners: false,
        });
        newObj = circle;
      } else if (activeTool === 'line') {
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x + 150, pointer.y], {
          stroke: toolProps.stroke,
          strokeWidth: toolProps.strokeWidth,
          opacity: toolProps.opacity,
          cornerColor: '#e5322d',
          cornerStrokeColor: '#ffffff',
          borderColor: '#e5322d',
          cornerSize: 8,
          transparentCorners: false,
        });
        newObj = line;
      }

      if (newObj) {
        fCanvas.add(newObj);
        fCanvas.setActiveObject(newObj);
        fCanvas.requestRenderAll();
        recordCanvasState(pageNumber);
        setSelectedObject(newObj);
        setActivePage(pageNumber);
        setActiveTool('select');
      }
    };

    fCanvas.on('mouse:down', handleMouseDown);

    return () => {
      fCanvas.off('mouse:down', handleMouseDown);
    };
  }, [activeTool, toolProps, pageNumber]);

  return (
    <div
      id={`pdf-page-${pageNumber}`}
      ref={containerRef}
      onClick={() => setActivePage(pageNumber)}
      className={`relative mx-auto my-6 bg-white rounded-lg shadow-md transition-all ${
        activePage === pageNumber ? 'ring-2 ring-red-500/80 shadow-xl' : 'hover:shadow-lg'
      }`}
      style={{
        width: pageSize.width,
        height: pageSize.height,
      }}
    >
      {/* Canvas subyacente de PDF.js */}
      <canvas
        ref={pdfCanvasRef}
        className="absolute top-0 left-0 rounded-lg pointer-events-none"
      />

      {/* Canvas interactivo superior de Fabric.js */}
      <div className="absolute top-0 left-0 z-10 w-full h-full">
        <canvas ref={fabricCanvasRef} />
      </div>

      {/* Píldora de número de página */}
      <div className="absolute bottom-2 right-2 z-20 pointer-events-none bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs opacity-60 hover:opacity-100 transition-opacity">
        Pág. {pageNumber}
      </div>
    </div>
  );
};
