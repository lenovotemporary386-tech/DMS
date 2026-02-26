import React, { useState } from 'react';
import { SheetData } from '../types';
import { Search, Filter, Download, Plus, MoreHorizontal, Trash2, Columns } from 'lucide-react';

interface SheetViewProps {
  sheet: SheetData;
  onUpdateCell: (sheetId: string, rowId: string, column: string, value: string) => void;
  onAddRow: (sheetId: string) => void;
  onDeleteRow: (sheetId: string, rowId: string) => void;
  onAddColumn: (sheetId: string) => void;
  onDeleteColumn: (sheetId: string, column: string) => void;
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
  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
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
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-sm min-w-max">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        {sheet.columns.map((col, idx) => (
                            <th key={idx} className="px-6 py-4 relative group w-48">
                                <div className="flex items-center justify-between">
                                  <input 
                                    type="text"
                                    defaultValue={col}
                                    onBlur={(e) => onRenameColumn(sheet.id, col, e.target.value)}
                                    className="bg-transparent text-xs uppercase font-bold text-slate-500 tracking-wider focus:outline-none focus:text-purple-600 w-full"
                                  />
                                  <button 
                                    onClick={() => onDeleteColumn(sheet.id, col)}
                                    className="ml-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete Column"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                            </th>
                        ))}
                        <th className="px-6 py-4 w-12 bg-slate-50"></th>
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
                        sheet.data.map((row) => (
                            <tr key={row.id} className="group hover:bg-purple-50/30 transition-colors">
                                {sheet.columns.map((col, idx) => {
                                    // Handle cases where the key might be lowercase/normalized in data
                                    // Ideally, we enforce keys = headers.
                                    const value = row[col] !== undefined ? row[col] : (row[col.toLowerCase().replace(/\s/g, '_')] || '');
                                    
                                    return (
                                      <td key={idx} className="px-6 py-2 border-r border-transparent hover:border-slate-100">
                                          <input 
                                            type="text"
                                            value={value}
                                            onChange={(e) => onUpdateCell(sheet.id, row.id, col, e.target.value)}
                                            className="w-full bg-transparent text-sm text-slate-700 py-2 focus:outline-none focus:border-b focus:border-purple-500 placeholder-slate-300 transition-all"
                                            placeholder="Empty"
                                          />
                                      </td>
                                    );
                                })}
                                <td className="px-4 py-2 text-right">
                                    <button 
                                      onClick={() => onDeleteRow(sheet.id, row.id)}
                                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                      title="Delete Row"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
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