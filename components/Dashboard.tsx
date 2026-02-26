import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Database, HardDrive, FileText, Search, MoreHorizontal, Activity, Layers } from 'lucide-react';
import { SheetData } from '../types';

interface DashboardProps {
  sheets: SheetData[];
}

export const Dashboard: React.FC<DashboardProps> = ({ sheets }) => {
  
  // Calculate Stats
  const stats = useMemo(() => {
    const totalTables = sheets.length;
    const totalRecords = sheets.reduce((acc, sheet) => acc + sheet.data.length, 0);
    const totalColumns = sheets.reduce((acc, sheet) => acc + sheet.columns.length, 0);
    
    // Simulate storage usage based on character count
    const charCount = sheets.reduce((acc, sheet) => {
        return acc + JSON.stringify(sheet.data).length;
    }, 0);
    const storageUsedMB = (charCount / 1024 / 1024).toFixed(2);
    
    return { totalTables, totalRecords, totalColumns, storageUsedMB };
  }, [sheets]);

  // Chart Data: Records per Table
  const chartData = useMemo(() => {
    return sheets.map(sheet => ({
        name: sheet.name.length > 10 ? sheet.name.substring(0, 10) + '..' : sheet.name,
        full_name: sheet.name,
        records: sheet.data.length
    }));
  }, [sheets]);

  const pieData = [
    { name: 'Healthy', value: 98, color: '#10b981' }, // Green
    { name: 'Warnings', value: 2, color: '#f59e0b' }, // Amber
  ];

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#f8fafc] text-slate-800">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">System Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time database metrics and performance</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search schemas..." 
            className="pl-10 pr-4 py-2.5 bg-white rounded-full border border-slate-200 focus:outline-none focus:border-purple-500 w-64 shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Card 1: Total Records */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Database size={64} className="text-purple-600" />
          </div>
          <div className="flex justify-between items-start">
             <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                <Database size={24} />
             </div>
             <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full">Active</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalRecords.toLocaleString()}</h3>
            <p className="text-slate-500 text-sm font-medium">Total Records</p>
          </div>
        </div>

        {/* Card 2: Total Tables */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start">
             <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                <Layers size={24} />
             </div>
             <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full">{stats.totalColumns} Columns</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalTables}</h3>
            <p className="text-slate-500 text-sm font-medium">Active Schemas</p>
          </div>
        </div>

        {/* Card 3: Storage */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start">
             <div className="p-3 bg-orange-100 rounded-2xl text-orange-600">
                <HardDrive size={24} />
             </div>
             <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Local</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{stats.storageUsedMB} MB</h3>
            <p className="text-slate-500 text-sm font-medium">Storage Utilized</p>
          </div>
        </div>
      </div>

      {/* Middle Row: Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">Record Volume by Table</h3>
            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal /></button>
          </div>
          <div className="h-[250px]">
             {sheets.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} barSize={40}>
                   <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 12}} 
                      dy={10}
                   />
                   <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 12}}
                   />
                   <Tooltip 
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                      formatter={(value: number) => [value, 'Records']}
                   />
                   <Bar dataKey="records" radius={[6, 6, 6, 6]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#7c3aed' : '#8b5cf6'} />
                      ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No tables available to display.
                </div>
             )}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
           <h3 className="text-lg font-bold text-slate-800 mb-6">System Health</h3>
           <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie 
                        data={pieData} 
                        innerRadius={50} 
                        outerRadius={70} 
                        paddingAngle={5} 
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                    >
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                    </Pie>
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-800">98%</span>
                  <span className="text-xs text-slate-500">Uptime</span>
              </div>
           </div>
           <div className="mt-auto space-y-3">
               <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><div className="w-2 h-2 rounded-full bg-green-500"></div> API Latency</span>
                  <span className="font-mono text-slate-800">24ms</span>
               </div>
               <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Memory</span>
                  <span className="font-mono text-slate-800">45%</span>
               </div>
           </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Tables List */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Active Schemas</h3>
              <span className="text-xs text-purple-600 font-medium cursor-pointer">View All</span>
           </div>
           <div className="space-y-1">
              {sheets.length > 0 ? sheets.slice(0, 5).map((sheet, i) => (
                  <div key={sheet.id} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 rounded-xl transition-colors group">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                            <FileText size={16} />
                         </div>
                         <div>
                             <p className="font-semibold text-slate-700">{sheet.name}</p>
                             <p className="text-[10px] text-slate-400">{sheet.columns.length} columns</p>
                         </div>
                      </div>
                      <div className="text-right">
                          <span className="block font-bold text-slate-800">{sheet.data.length}</span>
                          <span className="text-[10px] text-slate-400">Records</span>
                      </div>
                  </div>
              )) : (
                  <div className="text-center py-8 text-slate-400 text-sm">
                      No databases found. Create one to get started.
                  </div>
              )}
           </div>
        </div>

        {/* Logs Preview */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">System Logs</h3>
              <div className="flex gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 <span className="text-xs text-slate-400">Live</span>
              </div>
           </div>
           <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 h-[200px] overflow-hidden relative">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/10 pointer-events-none"></div>
               <div className="space-y-2 opacity-80">
                   <p><span className="text-blue-400">[INFO]</span> System initialized successfully.</p>
                   <p><span className="text-green-400">[CONNECT]</span> Gemini Live API connected securely.</p>
                   <p><span className="text-purple-400">[DB]</span> Indexed {stats.totalRecords} records across {stats.totalTables} tables.</p>
                   <p><span className="text-blue-400">[INFO]</span> Dashboard metrics updated.</p>
                   {sheets.length > 0 && <p><span className="text-yellow-400">[UPDATE]</span> Table "{sheets[sheets.length-1].name}" modified.</p>}
                   <p className="animate-pulse">_</p>
               </div>
           </div>
        </div>

      </div>
    </div>
  );
};