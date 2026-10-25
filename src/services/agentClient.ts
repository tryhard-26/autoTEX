import {
  AgentMessage,
  AgentToolCall,
  AgentFileEdit,
  AgentProjectContext,
} from '../types/agent';

export interface AgentModel {
  id: string; // opencode "provider/model"
  contextWindow?: number;
  ownedBy?: string; // provider
  free?: boolean;
}

export type AgentEventListener = (event: string, data: any) => void;

export class AgentClient {
  private isConnected: boolean = false;
  private eventListeners: Set<AgentEventListener> = new Set();
  private abortController: AbortController | null = null;
  public agentModel = '';

  public async connect(): Promise<boolean> {
    try {
      const res = await fetch('/api/health');
      const health = res.ok ? await res.json() : null;
      this.isConnected = Boolean(health?.agent?.available);
      this.agentModel = health?.agent?.model ?? '';
      this.notifySubscribers('connection_change', { connected: this.isConnected });
      return this.isConnected;
    } catch {
      this.isConnected = false;
      this.notifySubscribers('connection_change', { connected: false });
      return false;
    }
  }

  public disconnect(): void {
    this.cancel();
    this.isConnected = false;
    this.notifySubscribers('connection_change', { connected: false });
  }

  public getStatus(): boolean {
    return this.isConnected;
  }

  public async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    try {
      await fetch('/api/agent/cancel', { method: 'POST' });
    } catch {
      // ignore
    }
    this.notifySubscribers('cancelled', {});
  }

  public async listModels(): Promise<{ default: string; models: AgentModel[] }> {
    try {
      const res = await fetch('/api/agent/models');
      if (res.ok) return await res.json();
    } catch {}
    return { default: this.agentModel, models: [] };
  }

  /** Stored chat transcript for the active project (empty when nothing is stored). */
  public async loadSession(): Promise<AgentMessage[]> {
    try {
      const res = await fetch('/api/agent/session');
      return res.ok ? (await res.json()).messages ?? [] : [];
    } catch {
      return [];
    }
  }

  public async saveSession(messages: AgentMessage[]): Promise<void> {
    await fetch('/api/agent/session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    }).catch(() => {});
  }

  /** Permanently delete this project's saved conversations (manual action only). */
  public async deleteStoredSessions(): Promise<void> {
    const res = await fetch('/api/agent/session', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete saved conversations');
  }

  /** Start a new agent conversation (next message won't continue the previous one). */
  public async reset(): Promise<void> {
    await fetch('/api/agent/reset', { method: 'POST' }).catch(() => {});
  }

  public getProjectContext(
    activeFile?: string,
    cursorLine?: number,
    selectedText?: string,
    selectionRange?: { startLine: number; endLine: number },
    projectTree: string[] = [],
    recentErrors: any[] = []
  ): AgentProjectContext {
    return {
      activeFile,
      cursorLine,
      selectedText,
      selectionRange,
      projectTree,
      recentErrors,
    };
  }

  public subscribeToEvents(listener: AgentEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private notifySubscribers(event: string, data: any) {
    for (const listener of this.eventListeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('Error in agent event listener:', err);
      }
    }
  }

  /**
   * Send a message to the agent and stream its events. If the connection drops mid-run, re-attach to the
   * server-side job (it keeps running) and resume from the last received event.
   */
  public async sendMessage(
    prompt: string,
    context: AgentProjectContext,
    build: { mainFile: string; engine: string; model?: string },
    callbacks?: {
      onToken?: (token: string) => void;
      onThinking?: (text: string) => void;
      onToolStart?: (tool: AgentToolCall) => void;
      onToolFinish?: (tool: AgentToolCall) => void;
      onEdit?: (edit: AgentFileEdit) => void;
      onComplete?: (message: AgentMessage) => void;
      onError?: (err: Error) => void;
    }
  ): Promise<AgentMessage | null> {
    const controller = new AbortController();
    this.abortController = controller;
    let received = 0; // events consumed so far; used to resume
    let finished = false;
    let result: AgentMessage | null = null;

    const dispatch = (eventType: string, parsed: any) => {
      this.notifySubscribers(eventType, parsed);
      if (eventType === 'token') callbacks?.onToken?.(parsed.token);
      else if (eventType === 'thinking') callbacks?.onThinking?.(parsed.text);
      else if (eventType === 'tool_start') callbacks?.onToolStart?.(parsed);
      else if (eventType === 'tool_finish') callbacks?.onToolFinish?.(parsed);
      else if (eventType === 'edit_created') callbacks?.onEdit?.(parsed);
      else if (eventType === 'complete') {
        finished = true;
        result = parsed;
        callbacks?.onComplete?.(parsed);
      } else if (eventType === 'error') {
        finished = true;
        callbacks?.onError?.(new Error(parsed.message || 'Agent error'));
      }
    };

    const consume = async (res: Response) => {
      if (!res.ok || !res.body) throw new Error((await res.text()) || res.statusText);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          let eventType = '';
          let data = '';
          let id = -1;
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) data = line.slice(6);
            else if (line.startsWith('id: ')) id = Number(line.slice(4));
          }
          if (!eventType || !data || id < received) continue; // skip comments and replayed events
          received = id + 1;
          try {
            dispatch(eventType, JSON.parse(data));
          } catch {
            console.warn('Bad SSE event:', data);
          }
        }
      }
    };

    try {
      await consume(
        await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, context, ...build }),
          signal: controller.signal,
        })
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        callbacks?.onError?.(err);
        return null;
      }
      if (received === 0 && !(err instanceof TypeError)) {
        callbacks?.onError?.(err); // server refused the request (busy, bad input)
        return null;
      }
    }

    // Stream ended early (network drop, proxy, HMR): re-attach while the job finishes.
    for (let attempt = 0; !finished && attempt < 30 && !controller.signal.aborted; attempt++) {
      await new Promise((r) => setTimeout(r, Math.min(500 * (attempt + 1), 3000)));
      try {
        await consume(await fetch(`/api/agent/stream?from=${received}`, { signal: controller.signal }));
      } catch (err: any) {
        if (err.name === 'AbortError') break;
      }
    }

    if (this.abortController === controller) this.abortController = null;
    if (!finished && !controller.signal.aborted) {
      callbacks?.onError?.(new Error('Lost connection to the AutoTEX server (is it running on :3001?)'));
    }
    return result;
  }
}

export const agentClient = new AgentClient();
