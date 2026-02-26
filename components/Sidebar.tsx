import React from 'react';
import { LayoutDashboard, FileSpreadsheet, Settings, Mic, HelpCircle, Share2, Bot, Database, Activity, Trash2, Plus, Server } from 'lucide-react';
import { AppTab, SheetData } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sheets: SheetData[];
  onStartVoice: () => void;
  isVoiceActive: boolean;
  onDeleteSheet: (id: string) => void;
  onAddSheet: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  sheets, 
  onStartVoice,
  isVoiceActive,
  onDeleteSheet,
  onAddSheet
}) => {
  return (
    <div className="w-64 h-screen flex flex-col justify-between p-4 z-20 relative bg-[#1e1b4b] text-white shadow-2xl">
      <div className="flex flex-col h-full">
        {/* Logo Area */}
        <div className="flex items-center gap-3 mb-10 px-2 mt-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#1e1b4b] font-bold shadow-lg">
            DS
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">DMS</h1>
            <p className="text-[10px] text-indigo-300 font-medium tracking-wider uppercase">Database Management</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
          
          {/* Main Group */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab(AppTab.DASHBOARD)}
              className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === AppTab.DASHBOARD 
                  ? 'bg-[#7c3aed] text-white shadow-lg shadow-purple-900/50' 
                  : 'text-indigo-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium text-sm">System Overview</span>
            </button>
            
            <button
              onClick={() => setActiveTab(AppTab.AI_ASSISTANT)}
              className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === AppTab.AI_ASSISTANT
                  ? 'bg-[#7c3aed] text-white shadow-lg shadow-purple-900/50' 
                  : 'text-indigo-200 hover:text-white hover:bg-white/5'
              }`}
            >
               <Bot size={20} />
               <span className="font-medium text-sm">AI Assistant</span>
            </button>

             <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-200 hover:text-white hover:bg-white/5 transition-colors">
               <Activity size={20} />
               <span className="font-medium text-sm">Logs & Audits</span>
            </button>
          </div>

          {/* Sheets / Projects Group */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-4 mb-2 group">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Databases</p>
                <button 
                    onClick={onAddSheet}
                    className="text-indigo-400 hover:text-white bg-white/5 hover:bg-white/10 p-1 rounded transition-colors"
                    title="Create New Table"
                >
                    <Plus size={12} />
                </button>
            </div>
            {sheets.map(sheet => (
              <div key={sheet.id} className="group relative flex items-center">
                <button
                  onClick={() => setActiveTab(sheet.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 pr-10 ${
                    activeTab === sheet.id 
                      ? 'bg-[#7c3aed] text-white shadow-lg shadow-purple-900/50' 
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Database size={18} />
                  <span className="font-medium text-sm truncate">{sheet.name}</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteSheet(sheet.id); }}
                  className="absolute right-2 p-1.5 text-indigo-400 hover:text-red-400 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Table"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
             <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-200 hover:text-white hover:bg-white/5 transition-colors">
               <Share2 size={20} />
               <span className="font-medium text-sm">Shared Views</span>
            </button>
          </div>

          {/* Bottom Group */}
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-200 hover:text-white hover:bg-white/5 transition-colors">
               <HelpCircle size={20} />
               <span className="font-medium text-sm">Documentation</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-200 hover:text-white hover:bg-white/5 transition-colors">
               <Server size={20} />
               <span className="font-medium text-sm">Server Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Voice Assistant Floater */}
      <div className="mt-4 pt-4 border-t border-indigo-800">
         <button 
            onClick={onStartVoice}
            disabled={isVoiceActive}
            className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
                isVoiceActive 
                ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white'
                : 'bg-white text-indigo-900 hover:bg-indigo-50'
            }`}
          >
            {isVoiceActive ? (
                <>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    Listening...
                </>
            ) : (
                <>
                    <Mic size={18} />
                    Apex Assistant
                </>
            )}
          </button>
      </div>
    </div>
  );
};