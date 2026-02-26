import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from './audioUtils';
import { GeneratedContent, SheetData } from '../types';

// Tool Definitions
export const TOOLS: FunctionDeclaration[] = [
  {
    name: 'generateImage',
    description: 'Generates an image based on a text prompt.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'The detailed description of the image to generate.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generateVideo',
    description: 'Generates a video based on a text prompt using the Veo model.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'The description of the video to create.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'draftEmail',
    description: 'Drafts an email to a recipient.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        recipient: { type: Type.STRING, description: 'Name or email of the recipient.' },
        subject: { type: Type.STRING, description: 'Subject line of the email.' },
        body: { type: Type.STRING, description: 'The content of the email.' },
      },
      required: ['recipient', 'subject', 'body'],
    },
  },
  {
    name: 'createTable',
    description: 'Creates a new database table/sheet.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Name of the table.' },
        columns: { type: Type.STRING, description: 'Comma separated list of column headers.' },
      },
      required: ['name', 'columns'],
    },
  },
  {
    name: 'addRowToTable',
    description: 'Adds a new data row to an existing table. Requires table name and a JSON string of column-value pairs.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            tableName: { type: Type.STRING, description: 'The name of the table to add data to.' },
            dataJson: { type: Type.STRING, description: 'JSON string representing the row data (e.g., "{\"Name\": \"John\", \"Age\": 30}").' }
        },
        required: ['tableName', 'dataJson']
    }
  },
  {
      name: 'deleteRow',
      description: 'Deletes a row from a table based on a matching column value.',
      parameters: {
          type: Type.OBJECT,
          properties: {
              tableName: { type: Type.STRING, description: 'The name of the table.' },
              searchColumn: { type: Type.STRING, description: 'The column to search in (e.g., "ID" or "Name").' },
              searchValue: { type: Type.STRING, description: 'The value to match for deletion.' }
          },
          required: ['tableName', 'searchColumn', 'searchValue']
      }
  },
  {
      name: 'addColumn',
      description: 'Adds a new column to a specific table.',
      parameters: {
          type: Type.OBJECT,
          properties: {
              tableName: { type: Type.STRING, description: 'The name of the table.' },
              columnName: { type: Type.STRING, description: 'The name of the new column.' }
          },
          required: ['tableName', 'columnName']
      }
  },
  {
      name: 'deleteColumn',
      description: 'Deletes a column from a specific table.',
      parameters: {
          type: Type.OBJECT,
          properties: {
              tableName: { type: Type.STRING, description: 'The name of the table.' },
              columnName: { type: Type.STRING, description: 'The name of the column to delete.' }
          },
          required: ['tableName', 'columnName']
      }
  },
  {
      name: 'updateValue',
      description: 'Updates a specific cell in the table by finding a row and changing a column value.',
      parameters: {
          type: Type.OBJECT,
          properties: {
              tableName: { type: Type.STRING, description: 'The name of the table.' },
              searchColumn: { type: Type.STRING, description: 'Column to identify the row (e.g., ID).' },
              searchValue: { type: Type.STRING, description: 'Value to identify the row.' },
              targetColumn: { type: Type.STRING, description: 'Column to update.' },
              newValue: { type: Type.STRING, description: 'The new value to insert.' }
          },
          required: ['tableName', 'searchColumn', 'searchValue', 'targetColumn', 'newValue']
      }
  },
  {
      name: 'getDatabaseSummary',
      description: 'Retrieves a list of all current tables and their columns to understand the database structure.',
      parameters: {
          type: Type.OBJECT,
          properties: {},
      }
  }
];

export interface ToolCallbacks {
    onContentGenerated: (content: GeneratedContent) => void;
    onStatusChange: (status: string) => void;
    onSheetCreated: (name: string, cols: string[]) => void;
    onRowAdded: (tableName: string, rowData: any) => void;
    onTranscriptUpdate: (text: string, isUser: boolean) => void;
    onDeleteRow: (tableName: string, col: string, val: string) => void;
    onAddColumn: (tableName: string, col: string) => void;
    onDeleteColumn: (tableName: string, col: string) => void;
    onUpdateValue: (tableName: string, sCol: string, sVal: string, tCol: string, nVal: string) => void;
    getAppContext: () => { sheets: SheetData[] };
}

export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  
  private callbacks: ToolCallbacks;

  constructor(callbacks: ToolCallbacks) {
    this.callbacks = callbacks;
  }

  async connect() {
    if (!process.env.API_KEY) {
      console.error("API Key missing");
      return;
    }

    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Initialize Audio Contexts
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        tools: [{ functionDeclarations: TOOLS }],
        systemInstruction: "You are Apex, a sophisticated AI assistant for a Database Management System (DMS). You have full control to Create, Read, Update, and Delete (CRUD) tables, rows, and columns. You can also analyze data and draft emails/media. Always confirm the schema (getDatabaseSummary) if unsure about column names before performing edits. Be precise and professional.",
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          this.callbacks.onStatusChange("Connected");
          this.startAudioStream(stream);
        },
        onmessage: (msg) => this.handleMessage(msg),
        onclose: () => this.callbacks.onStatusChange("Disconnected"),
        onerror: (err) => {
          console.error(err);
          this.callbacks.onStatusChange("Error");
        }
      }
    });
  }

  private startAudioStream(stream: MediaStream) {
    if (!this.inputAudioContext) return;

    const source = this.inputAudioContext.createMediaStreamSource(stream);
    const processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const blob = createPcmBlob(inputData);
      this.sessionPromise?.then(session => {
        session.sendRealtimeInput({ media: blob });
      });
    };

    source.connect(processor);
    processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // 1. Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audioData && this.outputAudioContext) {
      this.playAudio(audioData);
    }

    // 2. Handle Transcripts
    if (message.serverContent?.inputTranscription?.text) {
        this.callbacks.onTranscriptUpdate(message.serverContent.inputTranscription.text, true);
    }

    // 3. Handle Tool Calls
    if (message.toolCall) {
      for (const call of message.toolCall.functionCalls) {
        console.log(`Tool call: ${call.name}`, call.args);
        let result: any = { result: "Success" };

        try {
          if (call.name === 'generateImage') {
             result = await this.executeGenerateImage(call.args['prompt'] as string);
          } else if (call.name === 'generateVideo') {
             result = await this.executeGenerateVideo(call.args['prompt'] as string);
          } else if (call.name === 'draftEmail') {
             result = this.executeDraftEmail(call.args as any);
          } else if (call.name === 'createTable') {
             this.callbacks.onSheetCreated(call.args['name'] as string, (call.args['columns'] as string).split(','));
             result = { result: `Table ${call.args['name']} created successfully.` };
          } else if (call.name === 'getDatabaseSummary') {
             const context = this.callbacks.getAppContext();
             const summary = context.sheets.map(s => `${s.name} (Columns: ${s.columns.join(', ')})`).join('\n');
             result = { summary: summary || "No tables exist yet." };
          } else if (call.name === 'addRowToTable') {
              const tableName = call.args['tableName'] as string;
              const dataString = call.args['dataJson'] as string;
              let rowData = {};
              try { rowData = JSON.parse(dataString); } catch(e) { console.error("JSON parse error", e); }
              
              if (Object.keys(rowData).length > 0) {
                  this.callbacks.onRowAdded(tableName, rowData);
                  result = { result: `Row added to ${tableName}.` };
              }
          } else if (call.name === 'deleteRow') {
              this.callbacks.onDeleteRow(call.args['tableName'] as string, call.args['searchColumn'] as string, call.args['searchValue'] as string);
              result = { result: "Row deleted." };
          } else if (call.name === 'addColumn') {
              this.callbacks.onAddColumn(call.args['tableName'] as string, call.args['columnName'] as string);
              result = { result: "Column added." };
          } else if (call.name === 'deleteColumn') {
              this.callbacks.onDeleteColumn(call.args['tableName'] as string, call.args['columnName'] as string);
              result = { result: "Column deleted." };
          } else if (call.name === 'updateValue') {
              this.callbacks.onUpdateValue(
                  call.args['tableName'] as string, 
                  call.args['searchColumn'] as string, 
                  call.args['searchValue'] as string, 
                  call.args['targetColumn'] as string, 
                  call.args['newValue'] as string
              );
              result = { result: "Value updated." };
          }
        } catch (e: any) {
          result = { error: e.message };
        }

        // Send Tool Response
        this.sessionPromise?.then(session => {
          session.sendToolResponse({
            functionResponses: {
              id: call.id,
              name: call.name,
              response: result
            }
          });
        });
      }
    }
  }

  private async playAudio(base64: string) {
    if (!this.outputAudioContext) return;
    
    const array = base64ToUint8Array(base64);
    const audioBuffer = await decodeAudioData(array, this.outputAudioContext);
    
    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
    
    const source = this.outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioContext.destination);
    source.start(this.nextStartTime);
    
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
    
    this.nextStartTime += audioBuffer.duration;
  }

  // --- Tool Implementations ---

  private async executeGenerateImage(prompt: string) {
    // Mock response for demo, would realy call generateContent with imagen
    let imageUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt)}/800/600`;
    
    this.callbacks.onContentGenerated({
      type: 'image',
      content: imageUrl,
      metadata: { prompt },
      timestamp: Date.now()
    });

    return { result: "Image generated." };
  }

  private async executeGenerateVideo(prompt: string) {
     const videoPlaceholder = "https://cdn.coverr.co/videos/coverr-surfer-at-sunset-1596/1080p.mp4"; 
     
     this.callbacks.onContentGenerated({
        type: 'video',
        content: videoPlaceholder,
        metadata: { prompt },
        timestamp: Date.now()
     });
     
     return { result: "Video generation started." };
  }

  private executeDraftEmail(args: { recipient: string, subject: string, body: string }) {
    this.callbacks.onContentGenerated({
      type: 'email',
      content: args.body,
      metadata: { recipient: args.recipient, subject: args.subject },
      timestamp: Date.now()
    });
    return { result: "Email drafted." };
  }

  disconnect() {
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    this.sources.forEach(s => s.stop());
  }
}