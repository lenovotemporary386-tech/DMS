
export interface SheetRow {
  id: string;
  [key: string]: string | number;
}

export interface SheetData {
  id: string;
  name: string;
  columns: string[];
  data: SheetRow[];
}

export interface GeneratedContent {
  type: 'image' | 'video' | 'email';
  content: string; // URL or text body
  metadata?: {
    subject?: string;
    recipient?: string;
    prompt?: string;
  };
  timestamp: number;
}

export enum AppTab {
  DASHBOARD = 'dashboard',
  SHEET = 'sheet',
  AI_ASSISTANT = 'ai_assistant'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
}

// Visualizer types
export interface AudioBarProps {
  amplitude: number;
}
