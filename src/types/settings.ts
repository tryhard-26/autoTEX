import { CompilerEngine } from './compiler';

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off';
  lineNumbers: 'on' | 'off';
  autoSave: boolean;
  autoSaveDelayMs: number;
}

export interface CompilerSettings {
  engine: CompilerEngine;
  customArgs: string;
  autoCompileOnSave: boolean;
  synctex: boolean;
  buildDir: string;
}

export interface AgentSettings {
  model: string; // opencode "provider/model"; '' = server default (OPENCODE_MODEL)
  showThinking: boolean; // show the model's reasoning stream in chat
  highlightChanges: boolean; // green/red highlight of agent edits in the editor
}

export interface AppSettings {
  editor: EditorSettings;
  compiler: CompilerSettings;
  agent: AgentSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  editor: {
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    tabSize: 2,
    wordWrap: 'on',
    lineNumbers: 'on',
    autoSave: false,
    autoSaveDelayMs: 1500,
  },
  compiler: {
    engine: 'tectonic',
    customArgs: '',
    autoCompileOnSave: false,
    synctex: true,
    buildDir: '.build',
  },
  agent: {
    model: '',
    showThinking: true,
    highlightChanges: true,
  },
};
