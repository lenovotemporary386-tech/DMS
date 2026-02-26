import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SheetView } from './components/SheetView';
import { VoiceOverlay } from './components/VoiceOverlay';
import { AiAssistant } from './components/AiAssistant';
import { AppTab, SheetData, GeneratedContent } from './types';
import { GeminiLiveService, ToolCallbacks } from './services/geminiService';
import {
  checkSupabaseConnection,
  isConnected as isSupabaseConnected,
  loadSheetsFromSupabase,
  initSupabaseSchema,
  syncCreateTable,
  syncDeleteTable,
  syncAddColumn,
  syncDeleteColumn,
  syncRenameColumn,
  syncUpsertRow,
  syncDeleteRow,
  syncUpdateValue,
  saveToLocalStorage,
  syncRenameTable,
} from './services/supabaseData';

// No initial sample data — all tables are loaded from Supabase (or localStorage fallback)

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(AppTab.DASHBOARD);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  // Ref to hold latest sheets state for the voice service callback closure
  const sheetsRef = useRef(sheets);

  useEffect(() => {
    sheetsRef.current = sheets;
  }, [sheets]);

  // ── Supabase: Load on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const connected = await checkSupabaseConnection();
      setDbStatus(connected ? 'online' : 'offline');
      if (connected) {
        await initSupabaseSchema();
      }
      const loaded = await loadSheetsFromSupabase();
      if (loaded !== null) {
        setSheets(loaded);
        if (loaded.length === 0 && activeTab !== AppTab.DASHBOARD) {
          setActiveTab(AppTab.DASHBOARD);
        }
      }
      setIsLoading(false);
    }
    init();
  }, []);

  // ── LocalStorage: Backup on change ──────────────────────────────────────
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(() => {
      saveToLocalStorage(sheets);
    }, 500);
    return () => { if (backupTimer.current) clearTimeout(backupTimer.current); };
  }, [sheets, isLoading]);

  // --- Data Manipulation Logic (Shared) ---

  const createTable = (name: string, cols: string[]) => {
    const newSheet: SheetData = {
      id: `sheet-${Date.now()}`,
      name,
      columns: cols.map(c => c.trim()),
      data: []
    };
    syncCreateTable(newSheet);
    setSheets(prev => [...prev, newSheet]);
    setActiveTab(newSheet.id);
  };

  const addRow = (tableName: string, rowData: any) => {
    const sheet = sheetsRef.current.find(s => s.name.toLowerCase() === tableName.toLowerCase());
    if (!sheet) return;

    const newRow: any = { id: Date.now().toString() };
    sheet.columns.forEach(col => newRow[col] = '');
    Object.keys(rowData).forEach(key => {
      const colMatch = sheet.columns.find(c => c.toLowerCase() === key.toLowerCase());
      if (colMatch) newRow[colMatch] = rowData[key];
      else newRow[key] = rowData[key];
    });

    syncUpsertRow(sheet.id, newRow);
    setSheets(prev => prev.map(s => s.id === sheet.id ? { ...s, data: [...s.data, newRow] } : s));
  };

  const deleteRowByValue = (tableName: string, colName: string, value: string) => {
    const sheet = sheetsRef.current.find(s => s.name.toLowerCase() === tableName.toLowerCase());
    if (!sheet) return;

    const actualColName = sheet.columns.find(c => c.toLowerCase() === colName.toLowerCase()) || colName;
    const rowsToDelete = sheet.data.filter(row => String(row[actualColName] || '').toLowerCase() === value.toLowerCase());
    const newData = sheet.data.filter(row => String(row[actualColName] || '').toLowerCase() !== value.toLowerCase());

    rowsToDelete.forEach(r => syncDeleteRow(sheet.id, String(r.id)));
    setSheets(prev => prev.map(s => s.id === sheet.id ? { ...s, data: newData } : s));
  };

  const addColumn = (tableName: string, columnName: string) => {
    const sheet = sheetsRef.current.find(s => s.name.toLowerCase() === tableName.toLowerCase());
    if (!sheet || sheet.columns.includes(columnName)) return;

    const newCols = [...sheet.columns, columnName];
    syncAddColumn(sheet.id, newCols, columnName);

    setSheets(prev => prev.map(s => {
      if (s.id !== sheet.id) return s;
      return { ...s, columns: newCols, data: s.data.map(r => ({ ...r, [columnName]: '' })) };
    }));
  };

  const deleteColumn = (tableName: string, columnName: string) => {
    const sheet = sheetsRef.current.find(s => s.name.toLowerCase() === tableName.toLowerCase());
    if (!sheet) return;

    const targetCol = sheet.columns.find(c => c.toLowerCase() === columnName.toLowerCase());
    if (!targetCol) return;

    const newCols = sheet.columns.filter(c => c !== targetCol);
    syncDeleteColumn(sheet.id, newCols, targetCol);

    setSheets(prev => prev.map(s => {
      if (s.id !== sheet.id) return s;
      const newData = s.data.map(row => { const r = { ...row }; delete r[targetCol]; return r; });
      return { ...s, columns: newCols, data: newData };
    }));
  };

  const updateValue = (tableName: string, sCol: string, sVal: string, tCol: string, nVal: string) => {
    const sheet = sheetsRef.current.find(s => s.name.toLowerCase() === tableName.toLowerCase());
    if (!sheet) return;

    const actualSCol = sheet.columns.find(c => c.toLowerCase() === sCol.toLowerCase());
    const actualTCol = sheet.columns.find(c => c.toLowerCase() === tCol.toLowerCase());
    if (!actualSCol || !actualTCol) return;

    const dirtyRows: any[] = [];
    const newData = sheet.data.map(row => {
      if (String(row[actualSCol]).toLowerCase() === sVal.toLowerCase()) {
        dirtyRows.push(row);
        return { ...row, [actualTCol]: nVal };
      }
      return row;
    });

    dirtyRows.forEach(r => syncUpdateValue(sheet.id, String(r.id), actualTCol, nVal));
    setSheets(prev => prev.map(s => s.id === sheet.id ? { ...s, data: newData } : s));
  };

  // --- Voice Service Setup ---

  const geminiServiceRef = useRef<GeminiLiveService | null>(null);

  const startVoiceSession = () => {
    setIsVoiceActive(true);
    setTranscript("Initializing secure connection...");

    const callbacks: ToolCallbacks = {
      onContentGenerated: (content) => setGeneratedContent(content),
      onStatusChange: (status) => {
        if (status === "Connected") {
          setTranscript("Apex online. Awaiting your command.");
        } else if (status === "Disconnected" || status === "Error") {
          setIsVoiceActive(false);
        }
      },
      onSheetCreated: createTable,
      onRowAdded: addRow,
      onTranscriptUpdate: (text, isUser) => {
        setTranscript(text);
        setIsUserSpeaking(isUser);
        if (isUser) {
          setTimeout(() => setIsUserSpeaking(false), 2000);
        }
      },
      onDeleteRow: deleteRowByValue,
      onAddColumn: addColumn,
      onDeleteColumn: deleteColumn,
      onUpdateValue: updateValue,
      getAppContext: () => ({ sheets: sheetsRef.current })
    };

    const service = new GeminiLiveService(callbacks);
    geminiServiceRef.current = service;
    service.connect();
  };

  const stopVoiceSession = () => {
    if (geminiServiceRef.current) {
      geminiServiceRef.current.disconnect();
    }
    setIsVoiceActive(false);
    setTranscript("");
  };

  // --- General Tool Action Handler (for Text Chat) ---

  const handleToolAction = (action: string, args: any): any => {
    switch (action) {
      case 'createTable':
        createTable(args.name, (args.columns || '').split(','));
        return { result: `Table '${args.name}' created successfully.` };
      case 'addRowToTable':
        let rowData = {};
        try { rowData = JSON.parse(args.dataJson); } catch (e) { return { error: "Failed to parse row data JSON." }; }
        addRow(args.tableName, rowData);
        return { result: `Successfully added row to table '${args.tableName}'.` };
      case 'deleteRow':
        deleteRowByValue(args.tableName, args.searchColumn, args.searchValue);
        return { result: `Deleted row(s) from '${args.tableName}' where ${args.searchColumn} equals '${args.searchValue}'.` };
      case 'addColumn':
        addColumn(args.tableName, args.columnName);
        return { result: `Added column '${args.columnName}' to table '${args.tableName}'.` };
      case 'deleteColumn':
        deleteColumn(args.tableName, args.columnName);
        return { result: `Deleted column '${args.columnName}' from table '${args.tableName}'.` };
      case 'updateValue':
        updateValue(args.tableName, args.searchColumn, args.searchValue, args.targetColumn, args.newValue);
        return { result: `Updated value in '${args.tableName}': Set ${args.targetColumn} to '${args.newValue}' where ${args.searchColumn} is '${args.searchValue}'.` };
      case 'getDatabaseSummary':
        const summary = sheetsRef.current.map(s =>
          `Table Name: ${s.name}\nColumns: ${s.columns.join(', ')}\nRow Count: ${s.data.length}\nSample Data: ${JSON.stringify(s.data.slice(0, 2))}`
        ).join('\n---\n');
        return { summary: summary || "The database is currently empty." };
      default:
        console.warn("Unknown tool action", action);
        return { error: `Unknown tool action: ${action}` };
    }
  };

  // --- Sheet View Handlers ---

  const handleRenameSheet = (sheetId: string, newName: string) => {
    syncRenameTable(sheetId, newName);
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, name: newName } : s));
  };

  const handleUpdateCell = (sheetId: string, rowId: string, column: string, value: string) => {
    syncUpdateValue(sheetId, rowId, column, value);
    setSheets(prev => prev.map(sheet => {
      if (sheet.id !== sheetId) return sheet;
      const newData = sheet.data.map(row => row.id === rowId ? { ...row, [column]: value } : row);
      return { ...sheet, data: newData };
    }));
  };

  const handleManualAddRow = (sheetId: string) => {
    const sheet = sheetsRef.current.find(s => s.id === sheetId);
    if (!sheet) return;

    const newRow: any = { id: Date.now().toString() };
    sheet.columns.forEach(col => newRow[col] = '');

    syncUpsertRow(sheetId, newRow);
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, data: [...s.data, newRow] } : s));
  };

  const handleDeleteRow = (sheetId: string, rowId: string) => {
    syncDeleteRow(sheetId, rowId);
    setSheets(prev => prev.map(sheet => {
      if (sheet.id !== sheetId) return sheet;
      return { ...sheet, data: sheet.data.filter(row => row.id !== rowId) };
    }));
  };

  const handleManualAddColumn = (sheetId: string) => {
    const sheet = sheetsRef.current.find(s => s.id === sheetId);
    if (!sheet) return;

    const newColName = `Field_${sheet.columns.length + 1}`;
    const newCols = [...sheet.columns, newColName];

    syncAddColumn(sheetId, newCols, newColName);
    setSheets(prev => prev.map(s => {
      if (s.id !== sheetId) return s;
      return { ...s, columns: newCols, data: s.data.map(r => ({ ...r, [newColName]: '' })) };
    }));
  };

  const handleDeleteColumn = (sheetId: string, column: string) => {
    const sheet = sheetsRef.current.find(s => s.id === sheetId);
    if (!sheet) return;

    const newColumns = sheet.columns.filter(c => c !== column);
    syncDeleteColumn(sheetId, newColumns, column);

    setSheets(prev => prev.map(s => {
      if (s.id !== sheetId) return s;
      const newData = s.data.map(row => { const r = { ...row }; delete r[column]; return r; });
      return { ...s, columns: newColumns, data: newData };
    }));
  };

  const handleRenameColumn = (sheetId: string, oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const sheet = sheetsRef.current.find(s => s.id === sheetId);
    if (!sheet) return;

    const newColumns = sheet.columns.map(c => c === oldName ? newName : c);
    syncRenameColumn(sheetId, newColumns, oldName, newName);

    setSheets(prev => prev.map(s => {
      if (s.id !== sheetId) return s;
      const newData = s.data.map(row => { const r: any = { ...row }; r[newName] = r[oldName]; delete r[oldName]; return r; });
      return { ...s, columns: newColumns, data: newData };
    }));
  };

  const handleDeleteSheet = (sheetId: string) => {
    syncDeleteTable(sheetId);
    setSheets(prev => prev.filter(s => s.id !== sheetId));
    if (activeTab === sheetId) setActiveTab(AppTab.DASHBOARD);
  };
  const handleManualAddSheet = () => {
    createTable('Untitled Database', ['Column A', 'Column B']);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-lg">Connecting to database...</p>
          </div>
        </div>
      );
    }
    if (activeTab === AppTab.DASHBOARD) return <Dashboard sheets={sheets} />;
    if (activeTab === AppTab.AI_ASSISTANT) return <AiAssistant sheets={sheets} onToolAction={handleToolAction} />;

    const activeSheet = sheets.find(s => s.id === activeTab);
    if (activeSheet) {
      return (
        <SheetView
          sheet={activeSheet}
          onUpdateCell={handleUpdateCell}
          onAddRow={handleManualAddRow}
          onDeleteRow={handleDeleteRow}
          onAddColumn={handleManualAddColumn}
          onDeleteColumn={handleDeleteColumn}
          onRenameColumn={handleRenameColumn}
          onRenameSheet={handleRenameSheet}
        />
      );
    }
    return <Dashboard sheets={sheets} />;
  };

  return (
    <div className="flex h-screen w-full bg-[#f3f4f6] relative">
      {/* Database connection indicator */}
      <div className={`absolute top-2 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm ${dbStatus === 'online' ? 'bg-emerald-100 text-emerald-700' :
        dbStatus === 'offline' ? 'bg-amber-100 text-amber-700' :
          'bg-blue-100 text-blue-700'
        }`}>
        <span className={`w-2 h-2 rounded-full ${dbStatus === 'online' ? 'bg-emerald-500' :
          dbStatus === 'offline' ? 'bg-amber-500 animate-pulse' :
            'bg-blue-500 animate-pulse'
          }`}></span>
        {dbStatus === 'online' ? 'Supabase Connected' :
          dbStatus === 'offline' ? 'Offline Mode (localStorage)' :
            'Connecting...'}
      </div>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sheets={sheets}
        onStartVoice={startVoiceSession}
        isVoiceActive={isVoiceActive}
        onDeleteSheet={handleDeleteSheet}
        onAddSheet={handleManualAddSheet}
      />

      <main className="flex-1 h-full relative z-10 flex flex-col overflow-hidden">
        {renderContent()}

        <VoiceOverlay
          isOpen={isVoiceActive}
          onClose={stopVoiceSession}
          transcript={transcript}
          isUserSpeaking={isUserSpeaking}
          generatedContent={generatedContent}
        />
      </main>
    </div>
  );
};

export default App;