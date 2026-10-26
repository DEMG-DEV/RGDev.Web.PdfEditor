import type * as fabric from 'fabric';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type ToolType =
  | 'select'
  | 'text'
  | 'image'
  | 'draw'
  | 'rectangle'
  | 'circle'
  | 'line';

export interface ToolProperties {
  fontSize: number;
  fontFamily: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  isBold: boolean;
  isItalic: boolean;
  textAlign: 'left' | 'center' | 'right';
}

export interface PdfFileInfo {
  name: string;
  size: number;
  arrayBuffer: ArrayBuffer;
}

export interface PageMeta {
  pageNumber: number; // 1-indexed
  originalWidth: number; // in pt (72 DPI)
  originalHeight: number; // in pt (72 DPI)
  currentRotation: number; // 0, 90, 180, 270 degrees
}

export interface SelectedObjectInfo {
  type: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: string;
  opacity?: number;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface HistoryItem {
  pageNumber: number;
  undoState: string;
  redoState: string;
}

export interface PdfStoreState {
  // Document state
  file: PdfFileInfo | null;
  pdfDoc: PDFDocumentProxy | null;
  numPages: number;
  pageOrder: number[]; // Array of 1-indexed page numbers
  rotations: Record<number, number>; // pageNumber -> additional rotation (0, 90, 180, 270)
  deletedPages: number[]; // list of deleted 1-indexed page numbers
  pageMetas: Record<number, PageMeta>;

  // View state
  scale: number;
  activePage: number;
  activeTool: ToolType;
  toolProps: ToolProperties;

  // Fabric canvases per page
  canvases: Record<number, fabric.Canvas>;
  selectedObject: fabric.FabricObject | null;
  selectedObjectInfo: SelectedObjectInfo | null;

  // History (undo/redo)
  undoStack: Array<HistoryItem>;
  redoStack: Array<HistoryItem>;

  // UI state
  isExporting: boolean;
  isSidebarOpen: boolean;
  toasts: ToastNotification[];

  // Actions
  setFile: (file: PdfFileInfo | null) => void;
  setPdfDoc: (doc: PDFDocumentProxy | null, metas: Record<number, PageMeta>) => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setActivePage: (page: number) => void;
  setActiveTool: (tool: ToolType) => void;
  setToolProps: (props: Partial<ToolProperties>) => void;
  applyPropsToSelectedObject: (props: Partial<ToolProperties>) => void;

  // Page management actions
  rotatePage: (pageNumber: number, deltaDegrees?: number) => void;
  deletePage: (pageNumber: number) => void;
  movePage: (fromIndex: number, toIndex: number) => void;

  // Fabric Canvas registration
  registerCanvas: (pageNumber: number, canvas: fabric.Canvas) => void;
  unregisterCanvas: (pageNumber: number) => void;
  setSelectedObject: (obj: fabric.FabricObject | null) => void;

  // Undo / Redo
  recordCanvasState: (pageNumber: number) => void;
  undo: () => void;
  redo: () => void;

  // Export
  setExporting: (exporting: boolean) => void;
  toggleSidebar: () => void;

  // Toasts
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Reset all
  resetAll: () => void;
}
