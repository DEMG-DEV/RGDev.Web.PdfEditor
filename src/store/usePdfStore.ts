import { create } from 'zustand';
import * as fabric from 'fabric';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type {
  PdfStoreState,
  PdfFileInfo,
  PageMeta,
  ToolType,
  ToolProperties,
  SelectedObjectInfo,
} from '@/types';

const DEFAULT_TOOL_PROPS: ToolProperties = {
  fontSize: 18,
  fontFamily: 'Helvetica',
  fill: '#1e293b',
  stroke: '#e5322d',
  strokeWidth: 2,
  opacity: 1,
  isBold: false,
  isItalic: false,
  textAlign: 'left',
};

const MAX_HISTORY_STEPS = 30;

// Flag interno para evitar carreras concurrentes durante undo/redo
let isRestoringHistory = false;

// Registro de los últimos estados serializados por página para cálculo diferencial de Undo/Redo
const lastCanvasStates: Record<number, string> = {};

interface FabricTextLike {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  fill?: string | unknown;
  textAlign?: string;
}

interface FabricShapeLike {
  fill?: string | unknown;
  stroke?: string | null;
  strokeWidth?: number;
  opacity?: number;
}

const extractObjectInfo = (obj: fabric.FabricObject | null): SelectedObjectInfo | null => {
  if (!obj) return null;
  const type = obj.type || 'object';
  const textObj = obj as unknown as FabricTextLike;
  const shapeObj = obj as unknown as FabricShapeLike;

  return {
    type,
    fill: typeof shapeObj.fill === 'string' ? shapeObj.fill : undefined,
    stroke: typeof shapeObj.stroke === 'string' ? shapeObj.stroke : undefined,
    strokeWidth: typeof shapeObj.strokeWidth === 'number' ? shapeObj.strokeWidth : undefined,
    fontSize: typeof textObj.fontSize === 'number' ? textObj.fontSize : undefined,
    fontFamily: typeof textObj.fontFamily === 'string' ? textObj.fontFamily : undefined,
    fontWeight: textObj.fontWeight,
    fontStyle: typeof textObj.fontStyle === 'string' ? textObj.fontStyle : undefined,
    textAlign: typeof textObj.textAlign === 'string' ? textObj.textAlign : undefined,
    opacity: typeof obj.opacity === 'number' ? obj.opacity : 1,
  };
};

export const usePdfStore = create<PdfStoreState>((set, get) => ({
  file: null,
  pdfDoc: null,
  numPages: 0,
  pageOrder: [],
  rotations: {},
  deletedPages: [],
  pageMetas: {},

  scale: 1.0,
  activePage: 1,
  activeTool: 'select',
  toolProps: DEFAULT_TOOL_PROPS,

  canvases: {},
  selectedObject: null,
  selectedObjectInfo: null,

  undoStack: [],
  redoStack: [],

  isExporting: false,
  isSidebarOpen: true,
  toasts: [],

  setFile: (file: PdfFileInfo | null) => set({ file }),

  setPdfDoc: (doc: PDFDocumentProxy | null, metas: Record<number, PageMeta>) => {
    const prevDoc = get().pdfDoc;
    if (prevDoc && prevDoc !== doc) {
      try {
        prevDoc.destroy();
      } catch {
        // Ignorar si ya estaba destruido
      }
    }

    if (!doc) {
      set({
        pdfDoc: null,
        numPages: 0,
        pageOrder: [],
        rotations: {},
        deletedPages: [],
        pageMetas: {},
        activePage: 1,
        undoStack: [],
        redoStack: [],
      });
      return;
    }

    const count = doc.numPages;
    const initialOrder = Array.from({ length: count }, (_, i) => i + 1);

    set({
      pdfDoc: doc,
      numPages: count,
      pageOrder: initialOrder,
      rotations: {},
      deletedPages: [],
      pageMetas: metas,
      activePage: 1,
      undoStack: [],
      redoStack: [],
    });
  },

  setScale: (scale: number) => {
    const clamped = Math.min(Math.max(scale, 0.3), 3.0);
    set({ scale: parseFloat(clamped.toFixed(2)) });
  },

  zoomIn: () => {
    const current = get().scale;
    get().setScale(current + 0.15);
  },

  zoomOut: () => {
    const current = get().scale;
    get().setScale(current - 0.15);
  },

  resetZoom: () => set({ scale: 1.0 }),

  setActivePage: (page: number) => set({ activePage: page }),

  setActiveTool: (tool: ToolType) => {
    const prev = get().activeTool;
    if (prev === tool) return;

    // Discard active selection if switching away from select
    if (tool !== 'select') {
      const activeObj = get().selectedObject;
      if (activeObj && activeObj.canvas) {
        activeObj.canvas.discardActiveObject();
        activeObj.canvas.requestRenderAll();
      }
      set({ activeTool: tool, selectedObject: null, selectedObjectInfo: null });
    } else {
      set({ activeTool: tool });
    }

    // Configure drawing mode on canvases
    const canvases = get().canvases;
    Object.values(canvases).forEach((c) => {
      if (c) {
        c.isDrawingMode = tool === 'draw';
        if (c.freeDrawingBrush) {
          c.freeDrawingBrush.color = get().toolProps.stroke;
          c.freeDrawingBrush.width = get().toolProps.strokeWidth;
        }
      }
    });
  },

  setToolProps: (props: Partial<ToolProperties>) => {
    set((state) => {
      const newProps = { ...state.toolProps, ...props };
      return { toolProps: newProps };
    });
    get().applyPropsToSelectedObject(props);

    // Also update current freeDrawingBrush if draw tool active
    const canvases = get().canvases;
    const activeTool = get().activeTool;
    if (activeTool === 'draw') {
      Object.values(canvases).forEach((c) => {
        if (c && c.freeDrawingBrush) {
          if (props.stroke) c.freeDrawingBrush.color = props.stroke;
          if (props.strokeWidth) c.freeDrawingBrush.width = props.strokeWidth;
        }
      });
    }
  },

  applyPropsToSelectedObject: (props: Partial<ToolProperties>) => {
    const obj = get().selectedObject;
    if (!obj) return;

    const canvas = obj.canvas;
    const textObj = obj as unknown as FabricTextLike;
    const shapeObj = obj as unknown as FabricShapeLike;

    if (props.fill !== undefined) {
      if (obj.type === 'textbox' || obj.type === 'text' || obj.type === 'i-text') {
        textObj.fill = props.fill;
      } else if (obj.type === 'rect' || obj.type === 'circle') {
        shapeObj.fill = props.fill;
      }
    }

    if (props.stroke !== undefined) {
      shapeObj.stroke = props.stroke;
    }

    if (props.strokeWidth !== undefined) {
      shapeObj.strokeWidth = props.strokeWidth;
    }

    if (props.fontSize !== undefined) {
      textObj.fontSize = props.fontSize;
    }

    if (props.fontFamily !== undefined) {
      textObj.fontFamily = props.fontFamily;
    }

    if (props.isBold !== undefined) {
      textObj.fontWeight = props.isBold ? 'bold' : 'normal';
    }

    if (props.isItalic !== undefined) {
      textObj.fontStyle = props.isItalic ? 'italic' : 'normal';
    }

    if (props.textAlign !== undefined) {
      textObj.textAlign = props.textAlign;
    }

    if (props.opacity !== undefined) {
      obj.opacity = props.opacity;
    }

    obj.setCoords();
    if (canvas) {
      canvas.requestRenderAll();
    }
    set({ selectedObjectInfo: extractObjectInfo(obj) });
  },

  rotatePage: (pageNumber: number, deltaDegrees = 90) => {
    const state = get();
    const current = state.rotations[pageNumber] || 0;
    const next = (current + deltaDegrees) % 360;

    // Rotar también los objetos existentes en el canvas de Fabric para que sigan
    // rígidamente vinculados a la orientación del contenido del documento PDF
    const canvas = state.canvases[pageNumber];
    if (canvas) {
      const meta = state.pageMetas[pageNumber];
      const nativeRot = meta?.currentRotation || 0;
      const prevTotalRot = (nativeRot + current) % 360;
      const prevIs90or270 = prevTotalRot === 90 || prevTotalRot === 270;
      const origW = meta ? meta.originalWidth : 595;
      const origH = meta ? meta.originalHeight : 842;
      const sceneH = prevIs90or270 ? origW : origH;

      const objects = canvas.getObjects();
      if (objects.length > 0) {
        objects.forEach((obj) => {
          const center = obj.getCenterPoint();
          // Rotación 90° horario del punto central en la escena
          const newCenterX = sceneH - center.y;
          const newCenterY = center.x;
          const newAngle = ((obj.angle || 0) + deltaDegrees) % 360;

          obj.setPositionByOrigin(new fabric.Point(newCenterX, newCenterY), 'center', 'center');
          obj.set({ angle: newAngle });
          obj.setCoords();
        });
        canvas.requestRenderAll();
        get().recordCanvasState(pageNumber);
      }
    }

    set({
      rotations: {
        ...state.rotations,
        [pageNumber]: next,
      },
    });
  },

  deletePage: (pageNumber: number) => {
    // Si el objeto seleccionado está en la página que se elimina, desecharlo
    const selectedObj = get().selectedObject;
    if (selectedObj && selectedObj.canvas === get().canvases[pageNumber]) {
      set({ selectedObject: null, selectedObjectInfo: null });
    }

    // Limpiar canvas y estado serializado
    const canvas = get().canvases[pageNumber];
    if (canvas) {
      try {
        canvas.dispose();
      } catch {
        // ignore
      }
    }
    delete lastCanvasStates[pageNumber];

    set((state) => {
      const nextOrder = state.pageOrder.filter((p) => p !== pageNumber);
      const nextDeleted = [...state.deletedPages, pageNumber];
      let nextActive = state.activePage;
      if (nextActive === pageNumber) {
        nextActive = nextOrder[0] || 1;
      }

      // Limpiar stacks de undo/redo para páginas eliminadas para evitar bloqueos
      const nextUndo = state.undoStack.filter((item) => item.pageNumber !== pageNumber);
      const nextRedo = state.redoStack.filter((item) => item.pageNumber !== pageNumber);

      const copyCanvases = { ...state.canvases };
      delete copyCanvases[pageNumber];

      return {
        pageOrder: nextOrder,
        deletedPages: nextDeleted,
        activePage: nextActive,
        undoStack: nextUndo,
        redoStack: nextRedo,
        canvases: copyCanvases,
      };
    });
    get().addToast(`Página ${pageNumber} eliminada`, 'info');
  },

  movePage: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const order = [...state.pageOrder];
      if (
        fromIndex < 0 ||
        fromIndex >= order.length ||
        toIndex < 0 ||
        toIndex >= order.length
      ) {
        return state;
      }
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      return { pageOrder: order };
    });
  },

  registerCanvas: (pageNumber: number, canvas: fabric.Canvas) => {
    lastCanvasStates[pageNumber] = JSON.stringify(canvas.toJSON());
    set((state) => ({
      canvases: { ...state.canvases, [pageNumber]: canvas },
    }));
  },

  unregisterCanvas: (pageNumber: number) => {
    delete lastCanvasStates[pageNumber];
    set((state) => {
      const copy = { ...state.canvases };
      delete copy[pageNumber];
      return { canvases: copy };
    });
  },

  setSelectedObject: (obj: fabric.FabricObject | null) => {
    set({
      selectedObject: obj,
      selectedObjectInfo: extractObjectInfo(obj),
    });
  },

  recordCanvasState: (pageNumber: number) => {
    if (isRestoringHistory) return;

    const canvas = get().canvases[pageNumber];
    if (!canvas) return;
    try {
      const currentJson = JSON.stringify(canvas.toJSON());
      const prevJson = lastCanvasStates[pageNumber] || JSON.stringify({ version: '6.5.4', objects: [] });

      // Si no hubo cambio real en el JSON del canvas, evitar entradas redundantes
      if (currentJson === prevJson) return;

      lastCanvasStates[pageNumber] = currentJson;

      set((state) => ({
        undoStack: [
          ...state.undoStack.slice(-(MAX_HISTORY_STEPS - 1)),
          { pageNumber, undoState: prevJson, redoState: currentJson },
        ],
        redoStack: [], // Limpiar redo en nueva acción de edición
      }));
    } catch (e) {
      console.warn('Failed to record canvas state:', e);
    }
  },

  undo: () => {
    if (isRestoringHistory) return;

    const { undoStack, redoStack, canvases } = get();
    if (undoStack.length === 0) return;

    // Buscar el último ítem de undo con canvas válido (ignorar páginas eliminadas)
    let targetIndex = undoStack.length - 1;
    let targetItem = undoStack[targetIndex];

    while (targetIndex >= 0 && (!targetItem || !canvases[targetItem.pageNumber])) {
      targetIndex--;
      targetItem = undoStack[targetIndex];
    }

    if (targetIndex < 0 || !targetItem) {
      set({ undoStack: [] });
      return;
    }

    const canvas = canvases[targetItem.pageNumber];
    if (!canvas) return;

    try {
      isRestoringHistory = true;
      const nextUndo = undoStack.slice(0, targetIndex);
      const nextRedo = [
        ...redoStack.slice(-(MAX_HISTORY_STEPS - 1)),
        targetItem,
      ];

      set({
        undoStack: nextUndo,
        redoStack: nextRedo,
        selectedObject: null,
        selectedObjectInfo: null,
        activePage: targetItem.pageNumber,
      });

      lastCanvasStates[targetItem.pageNumber] = targetItem.undoState;

      canvas
        .loadFromJSON(JSON.parse(targetItem.undoState))
        .then(() => {
          canvas.requestRenderAll();
        })
        .catch((err) => {
          console.error('Error during undo loadFromJSON:', err);
        })
        .finally(() => {
          isRestoringHistory = false;
        });
    } catch (e) {
      isRestoringHistory = false;
      console.error('Error during undo:', e);
    }
  },

  redo: () => {
    if (isRestoringHistory) return;

    const { undoStack, redoStack, canvases } = get();
    if (redoStack.length === 0) return;

    let targetIndex = redoStack.length - 1;
    let targetItem = redoStack[targetIndex];

    while (targetIndex >= 0 && (!targetItem || !canvases[targetItem.pageNumber])) {
      targetIndex--;
      targetItem = redoStack[targetIndex];
    }

    if (targetIndex < 0 || !targetItem) {
      set({ redoStack: [] });
      return;
    }

    const canvas = canvases[targetItem.pageNumber];
    if (!canvas) return;

    try {
      isRestoringHistory = true;
      const nextRedo = redoStack.slice(0, targetIndex);
      const nextUndo = [
        ...undoStack.slice(-(MAX_HISTORY_STEPS - 1)),
        targetItem,
      ];

      set({
        undoStack: nextUndo,
        redoStack: nextRedo,
        selectedObject: null,
        selectedObjectInfo: null,
        activePage: targetItem.pageNumber,
      });

      lastCanvasStates[targetItem.pageNumber] = targetItem.redoState;

      canvas
        .loadFromJSON(JSON.parse(targetItem.redoState))
        .then(() => {
          canvas.requestRenderAll();
        })
        .catch((err) => {
          console.error('Error during redo loadFromJSON:', err);
        })
        .finally(() => {
          isRestoringHistory = false;
        });
    } catch (e) {
      isRestoringHistory = false;
      console.error('Error during redo:', e);
    }
  },

  setExporting: (exporting: boolean) => set({ isExporting: exporting }),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  addToast: (message: string, type = 'info') => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 3500);
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  resetAll: () => {
    // Destruir PDF.js proxy document para liberar Web Workers
    const pdfDoc = get().pdfDoc;
    if (pdfDoc) {
      try {
        pdfDoc.destroy();
      } catch {
        // ignore
      }
    }

    // Disponer todas las instancias de Fabric
    Object.values(get().canvases).forEach((c) => {
      try {
        c.dispose();
      } catch {
        // ignore
      }
    });

    Object.keys(lastCanvasStates).forEach((k) => delete lastCanvasStates[Number(k)]);

    set({
      file: null,
      pdfDoc: null,
      numPages: 0,
      pageOrder: [],
      rotations: {},
      deletedPages: [],
      pageMetas: {},
      scale: 1.0,
      activePage: 1,
      activeTool: 'select',
      toolProps: DEFAULT_TOOL_PROPS,
      canvases: {},
      selectedObject: null,
      selectedObjectInfo: null,
      undoStack: [],
      redoStack: [],
      isExporting: false,
    });
  },
}));
