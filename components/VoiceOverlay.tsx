import React from 'react';
import { X, Image as ImageIcon, Video, Mail, Edit3, Loader2, Sparkles, Check, ChevronRight } from 'lucide-react';
import { GeneratedContent } from '../types';

interface VoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: string;
  isUserSpeaking: boolean;
  generatedContent: GeneratedContent | null;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  isOpen,
  onClose,
  transcript,
  isUserSpeaking,
  generatedContent
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-6 pointer-events-none">
      
      {/* Generated Content Card */}
      {generatedContent && (
        <div className="pointer-events-auto glass-panel rounded-2xl p-1 shadow-2xl w-96 animate-in slide-in-from-bottom-10 fade-in duration-500 mb-2 border border-blue-400/20">
            <div className="bg-[#0f172a]/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                             {generatedContent.type === 'image' && <ImageIcon size={16} />}
                             {generatedContent.type === 'video' && <Video size={16} />}
                             {generatedContent.type === 'email' && <Mail size={16} />}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-100 uppercase tracking-wider">Generated Result</p>
                            <p className="text-[10px] text-slate-400">Success • {new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>
                    <div className="bg-green-500/20 p-1 rounded-full">
                        <Check size={14} className="text-green-400" />
                    </div>
                </div>

                <div className="rounded-lg overflow-hidden border border-white/10 mb-4 bg-black/40">
                    {generatedContent.type === 'image' && (
                        <div className="relative group">
                             <img src={generatedContent.content} alt="Generated" className="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-105" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <p className="text-xs text-white truncate w-full">{generatedContent.metadata?.prompt}</p>
                             </div>
                        </div>
                    )}
                    {generatedContent.type === 'video' && (
                        <video src={generatedContent.content} controls className="w-full h-48 bg-black" autoPlay loop muted />
                    )}
                    {generatedContent.type === 'email' && (
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">TO</div>
                                <span className="text-xs text-blue-200">{generatedContent.metadata?.recipient}</span>
                            </div>
                            <div className="text-sm font-bold text-white mb-2">{generatedContent.metadata?.subject}</div>
                            <div className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed opacity-80">
                                {generatedContent.content}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                        <Sparkles size={14} /> Insert to Project
                    </button>
                    <button className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10">
                        <Edit3 size={14} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Voice Status & Transcript */}
      <div className="pointer-events-auto glass-panel rounded-3xl p-6 w-[400px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-xl relative overflow-hidden group">
        
        {/* Animated glow background */}
        <div className={`absolute -top-20 -right-20 w-40 h-40 bg-blue-500 rounded-full blur-[80px] opacity-20 transition-opacity duration-1000 ${isUserSpeaking ? 'opacity-40 scale-125' : ''}`}></div>
        <div className={`absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500 rounded-full blur-[80px] opacity-20 transition-opacity duration-1000 ${!isUserSpeaking ? 'opacity-30' : ''}`}></div>

        <div className="relative z-10">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isUserSpeaking ? 'bg-green-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                        <div className={`absolute inset-0 rounded-full ${isUserSpeaking ? 'bg-green-400' : 'bg-blue-500'} animate-ping opacity-75`}></div>
                    </div>
                    <div>
                         <span className="text-sm font-bold text-white tracking-wide">Apex Live</span>
                         <div className="flex items-center gap-1">
                             <span className="text-[10px] text-slate-400 uppercase font-medium">
                                {isUserSpeaking ? 'Receiving Audio' : 'Processing'}
                             </span>
                         </div>
                    </div>
                </div>
                <button 
                    onClick={onClose} 
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="min-h-[100px] max-h-[140px] overflow-y-auto mb-6 pr-2 custom-scrollbar flex flex-col justify-center">
                {transcript ? (
                    <div className={`transition-all duration-300 ${isUserSpeaking ? 'scale-[1.02]' : ''}`}>
                        <p className={`text-sm leading-relaxed font-medium ${isUserSpeaking ? 'text-white' : 'text-blue-200'}`}>
                        "{transcript}"
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-4 opacity-50">
                        <Loader2 size={24} className="animate-spin text-blue-400" />
                        <span className="text-xs text-slate-400 font-medium">Listening for instructions...</span>
                    </div>
                )}
            </div>

            {/* Visualizer */}
            <div className="flex items-center justify-center gap-1.5 h-12 bg-black/20 rounded-xl">
                {[...Array(12)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-1 rounded-full transition-all duration-75 ${isUserSpeaking ? 'bg-gradient-to-t from-green-400 to-emerald-300' : 'bg-blue-500/30'}`}
                        style={{ 
                            height: isUserSpeaking ? `${Math.max(4, Math.random() * 32 + 4)}px` : '4px',
                            opacity: isUserSpeaking ? 1 : 0.5
                        }}
                    />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};