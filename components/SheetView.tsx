import React, { useState, useEffect, useCallback } from 'react';
import { SheetData } from '../types';
import { Search, Filter, Download, Plus, MoreHorizontal, Trash2, Columns } from 'lucide-react';

interface SheetViewProps {
  sheet: SheetData;
  onUpdateCell: (sheetId: string, rowId: string, column: string, value: string) => void;
  onAddRow: (sheetId: string) => void;
  onDeleteRow: (sheetId: string, rowIndex: number) => void;
  onAddColumn: (sheetId: string) => void;
  onDeleteColumn: (sheetId: string, colIndex: number) => void;
  onRenameColumn: (sheetId: string, oldName: string, newName: string) => void;
  onRenameSheet: (sheetId: string, newName: string) => void;
}

export const SheetView: React.FC<SheetViewProps> = ({
  sheet,
  onUpdateCell,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  onRenameColumn,
  onRenameSheet
}) => {
  // Resizing state
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [resizingRow, setResizingRow] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [startHeight, setStartHeight] = useState(0);

  const startColResize = (e: React.MouseEvent, col: string) => {
    e.stopPropagation();
    setResizingCol(col);
    setStartX(e.clientX);
    setStartWidth(colWidths[col] || 192); // Default w-48 is approx 192px
  };

  const startRowResize = (e: React.MouseEvent, rowId: string) => {
    e.stopPropagation();
    setResizingRow(rowId);
    setStartY(e.clientY);
    setStartHeight(rowHeights[rowId] || 40); // Approximate default row height
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (resizingCol) {
      const diffX = e.clientX - startX;
      setColWidths(prev => ({
        ...prev,
        [resizingCol]: Math.max(60, startWidth + diffX) // Minimum width 60px
      }));
    } else if (resizingRow) {
      const diffY = e.clientY - startY;
      setRowHeights(prev => ({
        ...prev,
        [resizingRow]: Math.max(30, startHeight + diffY) // Minimum height 30px
      }));
    }
  }, [resizingCol, resizingRow, startX, startY, startWidth, startHeight]);

  const onMouseUp = useCallback(() => {
    setResizingCol(null);
    setResizingRow(null);
  }, []);

  useEffect(() => {
    if (resizingCol !== null || resizingRow !== null) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection during drag
    } else {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
    };
  }, [resizingCol, resizingRow, onMouseMove, onMouseUp]);

  return (
    <div className={`flex flex-col h-full bg-[#f8fafc] overflow-hidden ${resizingCol ? 'cursor-col-resize' : ''} ${resizingRow ? 'cursor-row-resize' : ''}`}>
      {/* Header / Toolbar */}
      <div className="px-8 py-6 sticky top-0 z-10 flex flex-col gap-6 bg-[#f8fafc]">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <input
              type="text"
              value={sheet.name}
              onChange={(e) => onRenameSheet(sheet.id, e.target.value)}
              className="text-3xl font-bold text-slate-800 mb-1 bg-transparent border-none focus:outline-none focus:ring-0 w-full placeholder-slate-400"
              placeholder="Untitled Project"
            />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Live Sync Active
              <span className="text-slate-400">•</span>
              Editable Mode
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl text-sm border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
              <Download size={14} /> Export
            </button>
            <button
              onClick={() => onAddRow(sheet.id)}
              className="flex items-center gap-2 px-4 py-2 bg-[#7c3aed] text-white rounded-xl text-sm font-medium hover:bg-[#6d28d9] shadow-lg shadow-purple-200 transition-all"
            >
              <Plus size={16} /> Add Row
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="relative group">
            <Search size={16} className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
            <input
              type="text"
              placeholder="Search records..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-purple-500 w-72 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAddColumn(sheet.id)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-purple-600 hover:border-purple-200 transition-colors shadow-sm text-sm font-medium"
            >
              <Columns size={16} />
              Add Column
            </button>
            <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-purple-600 hover:border-purple-200 transition-colors shadow-sm">
              <Filter size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8 relative">
        <div className="border border-slate-200 bg-white shadow-sm min-w-max inline-block">
          <table className="text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {/* Empty top-left cell for row numbers */}
                <th className="px-2 py-4 w-12 border-r border-slate-200 bg-slate-50 sticky left-0 z-20"></th>
                {sheet.columns.map((col, idx) => (
                  <th
                    key={col}
                    className="px-6 py-4 relative group border-r border-slate-200 bg-slate-50 z-10"
                    style={{
                      width: colWidths[col] || 192,
                      minWidth: 60
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        defaultValue={col}
                        onBlur={(e) => onRenameColumn(sheet.id, col, e.target.value)}
                        className="bg-transparent text-xs uppercase font-bold text-slate-500 tracking-wider focus:outline-none focus:text-purple-600 w-full"
                      />
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onDeleteColumn(sheet.id, idx);
                        }}
                        className="ml-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-30"
                        title="Delete Column"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {/* Column Resize Handle */}
                    <div
                      className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-400 group-hover:bg-slate-200 transition-colors z-20 ${resizingCol === col ? 'bg-purple-500' : ''}`}
                      onMouseDown={(e) => startColResize(e, col)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sheet.data.length === 0 ? (
                <tr>
                  <td colSpan={sheet.columns.length + 1} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                      <p className="text-sm">No data entries found.</p>
                      <p className="text-xs text-slate-400">Click "Add Row" to start editing.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sheet.data.map((row, rowIdx) => (
                  <tr
                    key={row.id || `row-${rowIdx}`}
                    className="group hover:bg-purple-50/30 transition-colors"
                    style={{
                      height: row.id ? (rowHeights[row.id] || 40) : 40
                    }}
                  >
                    {/* Row Number / Header */}
                    <td className="relative px-2 border-r border-slate-200 bg-slate-50 text-center text-xs text-slate-400 font-medium select-none sticky left-0 z-10 group-hover:bg-purple-100/50 hover:text-purple-600">
                      {rowIdx + 1}
                      {/* Row Resize Handle */}
                      <div
                        className={`absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-purple-400 group-hover:bg-slate-200 transition-colors z-20 ${resizingRow === row.id ? 'bg-purple-500' : ''}`}
                        onMouseDown={(e) => startRowResize(e, row.id)}
                      />
                      {/* Delete Row Button - Shown on hover */}
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onDeleteRow(sheet.id, rowIdx);
                        }}
                        className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 z-30 rounded"
                        title="Delete Row"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>

                    {sheet.columns.map((col, idx) => {
                      const value = row[col] !== undefined ? row[col] : (row[col.toLowerCase().replace(/\s/g, '_')] || '');

                      return (
                        <td
                          key={col}
                          className="px-6 border-r border-transparent hover:border-slate-100"
                          style={{
                            width: colWidths[col] || 192,
                            minWidth: 60
                          }}
                        >
                          <div className="w-full h-full min-h-[inherit] flex items-center">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => onUpdateCell(sheet.id, row.id, col, e.target.value)}
                              className="w-full h-full bg-transparent text-sm text-slate-700 focus:outline-none focus:border-b focus:border-purple-500 placeholder-slate-300 transition-all resize-none overflow-hidden"
                              placeholder="Empty"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};