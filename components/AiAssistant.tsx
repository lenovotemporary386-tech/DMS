import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Terminal } from 'lucide-react';
import { GoogleGenAI, Content, Part } from "@google/genai";
import { SheetData, ChatMessage } from '../types';
import { TOOLS } from '../services/geminiService';

interface AiAssistantProps {
  sheets: SheetData[];
  onToolAction: (action: string, args: any) => any;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ sheets, onToolAction }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am Apex, your AI Database Manager. I can help you query data, modify tables, or generate insights. How can I assist you today?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Store full conversation history for the AI
  const [history, setHistory] = useState<Content[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || !process.env.API_KEY) return;

    const userText = input;
    const userMsg: ChatMessage = { role: 'user', text: userText, timestamp: Date.now() };
    
    // Update UI
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Construct system instruction based on current schema
      const schemaSummary = sheets.map(s => 
        `Table: ${s.name}\nColumns: ${s.columns.join(', ')}`
      ).join('\n\n');
      
      const systemInstruction = `You are Apex, a database assistant. 
      You are managing the following databases:\n${schemaSummary}\n\n
      You have access to tools to modify the database. 
      If a user asks to modify data, use the appropriate tools.
      Always check the schema if you are unsure about column names.
      Be concise and helpful.`;

      // Append user message to history
      const currentTurnContent: Content = { role: 'user', parts: [{ text: userText }] };
      let currentHistory = [...history, currentTurnContent];

      // Interaction Loop for Multi-turn Tool use
      let finalResponseText = '';
      
      while (true) {
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: currentHistory,
            config: {
                tools: [{ functionDeclarations: TOOLS }],
                systemInstruction: systemInstruction,
            }
          });

          // Add model response to history
          const responseContent = response.candidates?.[0]?.content;
          
          if (!responseContent) {
              finalResponseText = "I'm having trouble connecting to the model.";
              break;
          }

          currentHistory.push(responseContent);

          const functionCalls = response.functionCalls;
          
          if (functionCalls && functionCalls.length > 0) {
              const toolResponseParts: Part[] = [];
              
              for (const call of functionCalls) {
                  // Execute tool
                  console.log(`[AI] Executing tool: ${call.name}`, call.args);
                  let result;
                  try {
                    result = onToolAction(call.name, call.args);
                  } catch (e: any) {
                    result = { error: e.message };
                  }
                  
                  toolResponseParts.push({
                      functionResponse: {
                          name: call.name,
                          response: result
                      }
                  });
              }

              // Add tool output to history
              currentHistory.push({ role: 'user', parts: toolResponseParts });
              // Continue loop to let model interpret results
          } else {
              // No function calls, just text response. We are done.
              finalResponseText = response.text || "";
              break;
          }
      }

      // Update state
      setHistory(currentHistory);
      const modelMsg: ChatMessage = { role: 'model', text: finalResponseText, timestamp: Date.now() };
      setMessages(prev => [...prev, modelMsg]);

    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = { role: 'model', text: "Sorry, I encountered an error processing your request.", timestamp: Date.now(), isError: true };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 border-b border-slate-200 bg-white">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bot className="text-purple-600" /> 
            AI Assistant
        </h2>
        <p className="text-slate-500 text-sm">Ask questions about your data or command changes.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[80%] gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-purple-600 text-white'}`}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-white text-slate-800 rounded-tr-none' 
                  : msg.isError 
                    ? 'bg-red-50 text-red-600 border border-red-100 rounded-tl-none' 
                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
              }`}>
                {msg.text.split('\n').map((line, i) => (
                    <p key={i} className="mb-1 last:mb-0 min-h-[1.2em]">{line}</p>
                ))}
                <span className="text-[10px] opacity-50 block mt-2 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="flex gap-4">
                     <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                        <Bot size={20} />
                     </div>
                     <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2 text-slate-500 text-sm">
                        <Sparkles size={16} className="animate-spin text-purple-500" />
                        Thinking...
                     </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-white border-t border-slate-200">
        <div className="relative">
             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a command (e.g., 'Add a priority column to Users' or 'Show summary')..." 
                className="w-full pl-6 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-slate-700 placeholder-slate-400"
                disabled={isLoading}
             />
             <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-2 p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
             >
                <Send size={20} />
             </button>
        </div>
        <div className="flex gap-4 mt-3 px-2">
            <p className="text-xs text-slate-400 flex items-center gap-1">
                <Terminal size={12} />
                Apex executes commands directly on your data.
            </p>
        </div>
      </div>
    </div>
  );
};