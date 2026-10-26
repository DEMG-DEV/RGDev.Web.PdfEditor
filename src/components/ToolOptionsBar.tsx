import React from 'react';
import * as fabric from 'fabric';
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { deleteFabricObject } from '@/utils/coordinateConverter';

const PRESET_COLORS = [
  '#000000',
  '#e5322d',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#ffffff',
];

export const ToolOptionsBar: React.FC = () => {
  const activeTool = usePdfStore((s) => s.activeTool);
  const toolProps = usePdfStore((s) => s.toolProps);
  const setToolProps = usePdfStore((s) => s.setToolProps);
  const selectedObject = usePdfStore((s) => s.selectedObject);
  const selectedObjectInfo = usePdfStore((s) => s.selectedObjectInfo);
  const setSelectedObject = usePdfStore((s) => s.setSelectedObject);
  const activePage = usePdfStore((s) => s.activePage);
  const recordCanvasState = usePdfStore((s) => s.recordCanvasState);
  const addToast = usePdfStore((s) => s.addToast);

  const isTextMode =
    activeTool === 'text' ||
    (selectedObjectInfo?.type === 'textbox' ||
      selectedObjectInfo?.type === 'text' ||
      selectedObjectInfo?.type === 'i-text');

  const isShapeMode =
    activeTool === 'rectangle' ||
    activeTool === 'circle' ||
    activeTool === 'line' ||
    (selectedObjectInfo && ['rect', 'circle', 'line'].includes(selectedObjectInfo.type));

  const isDrawMode = activeTool === 'draw';

  // Duplicate selected object
  const handleDuplicate = async () => {
    if (!selectedObject) return;
    const canvas = selectedObject.canvas;
    if (!canvas) return;

    recordCanvasState(activePage);

    if (selectedObject.type === 'activeselection') {
      const asGroup = selectedObject as fabric.ActiveSelection;
      const clones: fabric.FabricObject[] = [];
      for (const item of asGroup.getObjects()) {
        const c = await item.clone();
        c.set({
          left: (c.left || 0) + 20,
          top: (c.top || 0) + 20,
        });
        canvas.add(c);
        clones.push(c);
      }
      canvas.discardActiveObject();
      const newSel = new fabric.ActiveSelection(clones, { canvas });
      canvas.setActiveObject(newSel);
      setSelectedObject(newSel);
    } else {
      const cloned = await selectedObject.clone();
      cloned.set({
        left: (selectedObject.left || 0) + 20,
        top: (selectedObject.top || 0) + 20,
        evented: true,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      setSelectedObject(cloned);
    }

    canvas.requestRenderAll();
    addToast('Elemento duplicado', 'info');
  };

  // Bring forward / send backward
  const handleBringForward = () => {
    if (!selectedObject) return;
    const canvas = selectedObject.canvas;
    if (!canvas) return;

    recordCanvasState(activePage);
    canvas.bringObjectForward(selectedObject);
    canvas.requestRenderAll();
  };

  const handleSendBackward = () => {
    if (!selectedObject) return;
    const canvas = selectedObject.canvas;
    if (!canvas) return;

    recordCanvasState(activePage);
    canvas.sendObjectBackwards(selectedObject);
    canvas.requestRenderAll();
  };

  const handleDelete = () => {
    if (!selectedObject) return;
    const canvas = selectedObject.canvas;
    if (!canvas) return;

    recordCanvasState(activePage);
    deleteFabricObject(canvas, selectedObject);
    setSelectedObject(null);
    addToast('Elemento eliminado', 'info');
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none shadow-2xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* TEXT OPTIONS */}
        {isTextMode && (
          <div className="flex items-center gap-2">
            {/* Font Family */}
            <select
              value={selectedObjectInfo?.fontFamily || toolProps.fontFamily}
              onChange={(e) => setToolProps({ fontFamily: e.target.value })}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-red-500"
            >
              <option value="Helvetica">Helvetica (Sans)</option>
              <option value="Times-Roman">Times New Roman (Serif)</option>
              <option value="Courier">Courier (Mono)</option>
            </select>

            {/* Font Size */}
            <select
              value={selectedObjectInfo?.fontSize || toolProps.fontSize}
              onChange={(e) => setToolProps({ fontSize: parseInt(e.target.value, 10) })}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-red-500"
            >
              {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>

            {/* Bold / Italic */}
            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setToolProps({
                    isBold: !(selectedObjectInfo?.fontWeight === 'bold' || toolProps.isBold),
                  })
                }
                title="Negrita"
                className={`p-1.5 hover:bg-slate-100 transition-colors ${
                  (selectedObjectInfo?.fontWeight === 'bold' || toolProps.isBold)
                    ? 'bg-slate-200 text-slate-900 font-bold'
                    : 'text-slate-600'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setToolProps({
                    isItalic: !(selectedObjectInfo?.fontStyle === 'italic' || toolProps.isItalic),
                  })
                }
                title="Cursiva"
                className={`p-1.5 hover:bg-slate-100 transition-colors ${
                  (selectedObjectInfo?.fontStyle === 'italic' || toolProps.isItalic)
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-600'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Alignment */}
            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setToolProps({ textAlign: 'left' })}
                title="Alinear a la izquierda"
                className={`p-1.5 hover:bg-slate-100 ${
                  (selectedObjectInfo?.textAlign || toolProps.textAlign) === 'left'
                    ? 'bg-slate-200'
                    : ''
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <button
                type="button"
                onClick={() => setToolProps({ textAlign: 'center' })}
                title="Centrar"
                className={`p-1.5 hover:bg-slate-100 ${
                  (selectedObjectInfo?.textAlign || toolProps.textAlign) === 'center'
                    ? 'bg-slate-200'
                    : ''
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <button
                type="button"
                onClick={() => setToolProps({ textAlign: 'right' })}
                title="Alinear a la derecha"
                className={`p-1.5 hover:bg-slate-100 ${
                  (selectedObjectInfo?.textAlign || toolProps.textAlign) === 'right'
                    ? 'bg-slate-200'
                    : ''
                }`}
              >
                <AlignRight className="w-3.5 h-3.5 text-slate-700" />
              </button>
            </div>

            {/* Text Color */}
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-slate-500 font-medium">Color:</span>
              <div className="flex items-center gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setToolProps({ fill: c })}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full border border-slate-300 shadow-xs transition-transform hover:scale-110 ${
                      (selectedObjectInfo?.fill || toolProps.fill) === c ? 'ring-2 ring-red-500 scale-110' : ''
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={selectedObjectInfo?.fill || toolProps.fill}
                  onChange={(e) => setToolProps({ fill: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-300 ml-1 p-0 bg-transparent"
                  title="Color personalizado"
                />
              </div>
            </div>
          </div>
        )}

        {/* SHAPE & DRAW OPTIONS */}
        {(isShapeMode || isDrawMode) && (
          <div className="flex items-center gap-3">
            {/* Fill color for shapes */}
            {isShapeMode && activeTool !== 'line' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Relleno:</span>
                <button
                  type="button"
                  onClick={() => setToolProps({ fill: 'transparent' })}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    (selectedObjectInfo?.fill || toolProps.fill) === 'transparent'
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  Hueco
                </button>
                <input
                  type="color"
                  value={
                    (selectedObjectInfo?.fill && selectedObjectInfo.fill !== 'transparent'
                      ? selectedObjectInfo.fill
                      : toolProps.fill) || '#ffffff'
                  }
                  onChange={(e) => setToolProps({ fill: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-300 ml-1 p-0 bg-transparent"
                  title="Color de relleno"
                />
              </div>
            )}

            {/* Stroke / Outline color */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">{isDrawMode ? 'Pincel:' : 'Borde:'}</span>
              <div className="flex items-center gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setToolProps({ stroke: c })}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full border border-slate-300 shadow-xs transition-transform hover:scale-110 ${
                      (selectedObjectInfo?.stroke || toolProps.stroke) === c
                        ? 'ring-2 ring-red-500 scale-110'
                        : ''
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={selectedObjectInfo?.stroke || toolProps.stroke}
                  onChange={(e) => setToolProps({ stroke: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-300 ml-1 p-0 bg-transparent"
                  title="Color del borde o trazo"
                />
              </div>
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Grosor:</span>
              <select
                value={selectedObjectInfo?.strokeWidth || toolProps.strokeWidth}
                onChange={(e) => setToolProps({ strokeWidth: parseInt(e.target.value, 10) })}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium"
              >
                {[1, 2, 3, 5, 8, 12, 16, 24].map((w) => (
                  <option key={w} value={w}>
                    {w} px
                  </option>
                ))}
              </select>
            </div>

            {/* Opacity slider */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Opacidad:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={selectedObjectInfo?.opacity ?? toolProps.opacity}
                onChange={(e) => setToolProps({ opacity: parseFloat(e.target.value) })}
                className="w-20 accent-red-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 w-8">
                {Math.round((selectedObjectInfo?.opacity ?? toolProps.opacity) * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* DEFAULT STATE TIP */}
        {!isTextMode && !isShapeMode && !isDrawMode && !selectedObject && (
          <span className="text-slate-600 text-xs italic">
            Selecciona una herramienta o haz clic en cualquier elemento para personalizar sus propiedades.
          </span>
        )}
      </div>

      {/* OBJECT LAYER & ACTION CONTROLS */}
      {selectedObject && (
        <div className="flex items-center gap-1 border-l border-slate-300 pl-3">
          <button
            type="button"
            onClick={handleBringForward}
            title="Traer al frente"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSendBackward}
            title="Enviar al fondo"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            title="Duplicar"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Eliminar"
            className="p-1 rounded text-rose-600 hover:text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
