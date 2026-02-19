import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import {
  DirectorState,
  ScoredEvent,
  TwitchMessage,
  BotReply,
  AiContextSuggestion,
  Streamer
} from '../interfaces/director.interfaces'

export interface ChatMessage {
  username: string;
  message: string;
  isNami?: boolean;
  isMention?: boolean;
}

export interface AudioLogEntry {
  text: string;
  sessionId?: string;
  isPartial?: boolean;
}

export interface ScoreEntry {
  score: number;
  source: string;
  text: string;
}

const MAX_LOG = 50;

function trimLog<T>(arr: T[]): T[] {
  return arr.length > MAX_LOG ? arr.slice(arr.length - MAX_LOG) : arr;
}

@Injectable({
  providedIn: 'root'
})
export class DirectorService implements OnDestroy {
  private socket: Socket;

  // === Connection ===
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  // === Accumulated state (BehaviorSubjects — persists across navigation) ===
  private directorStateSubject    = new BehaviorSubject<DirectorState | null>(null);
  private visionLogSubject        = new BehaviorSubject<string[]>([]);
  private spokenLogSubject        = new BehaviorSubject<string[]>([]);
  private audioLogSubject         = new BehaviorSubject<AudioLogEntry[]>([]);
  private chatMessagesSubject     = new BehaviorSubject<ChatMessage[]>([]);
  private namiRepliesSubject      = new BehaviorSubject<BotReply[]>([]);
  private scoreHistorySubject     = new BehaviorSubject<ScoreEntry[]>([]);
  private pendingAiContextSubject = new BehaviorSubject<string | null>(null);

  public directorState$    = this.directorStateSubject.asObservable();
  public visionLog$        = this.visionLogSubject.asObservable();
  public spokenLog$        = this.spokenLogSubject.asObservable();
  public audioLog$         = this.audioLogSubject.asObservable();
  public chatMessages$     = this.chatMessagesSubject.asObservable();
  public namiReplies$      = this.namiRepliesSubject.asObservable();
  public scoreHistory$     = this.scoreHistorySubject.asObservable();
  public pendingAiContext$ = this.pendingAiContextSubject.asObservable();

  // Raw subject kept for any component that needs one-shot AI suggestion events
  private aiSuggestionSubject = new Subject<AiContextSuggestion>();
  public aiSuggestion$ = this.aiSuggestionSubject.asObservable();

  constructor() {
    this.socket = io(environment.socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('connect', () => {
      console.log('[DirectorService] Connected to Director Engine');
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[DirectorService] Disconnected from Director Engine');
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[DirectorService] Connection error:', error);
      this.connectionStatusSubject.next(false);
    });

    // Director state
    this.socket.on('director_state', (data: DirectorState) => {
      this.directorStateSubject.next(data);
    });

    // Vision
    this.socket.on('vision_context', (data: { context: string }) => {
      this.visionLogSubject.next(trimLog([...this.visionLogSubject.value, data.context]));
    });

    // Spoken word
    this.socket.on('spoken_word_context', (data: { context: string }) => {
      this.spokenLogSubject.next(trimLog([...this.spokenLogSubject.value, data.context]));
    });

    // Audio (supports partial/streaming updates)
    this.socket.on('audio_context', (data: { context: string; is_partial: boolean; session_id?: string }) => {
      let log = [...this.audioLogSubject.value];
      if (data.is_partial && data.session_id) {
        const idx = log.findIndex(a => a.sessionId === data.session_id);
        if (idx >= 0) {
          log[idx] = { text: data.context, sessionId: data.session_id, isPartial: true };
        } else {
          log.push({ text: data.context, sessionId: data.session_id, isPartial: true });
        }
      } else {
        log.push({ text: data.context, sessionId: data.session_id, isPartial: false });
      }
      this.audioLogSubject.next(trimLog(log));
    });

    // Twitch chat
    this.socket.on('twitch_message', (data: TwitchMessage) => {
      const isMention = /(nami|peepingnami)/gi.test(data.message);
      this.chatMessagesSubject.next(
        trimLog([...this.chatMessagesSubject.value, { username: data.username, message: data.message, isMention }])
      );
    });

    // Bot reply — goes into both chat and nami replies
    this.socket.on('bot_reply', (data: BotReply) => {
      this.namiRepliesSubject.next(trimLog([...this.namiRepliesSubject.value, data]));
      this.chatMessagesSubject.next(
        trimLog([...this.chatMessagesSubject.value, { username: 'Nami', message: data.reply, isNami: true }])
      );
    });

    // Interest scoring
    this.socket.on('event_scored', (data: ScoredEvent) => {
      const history = [...this.scoreHistorySubject.value, { score: data.score, source: data.source, text: data.text }];
      if (history.length > MAX_LOG) history.shift();
      this.scoreHistorySubject.next(history);
    });

    // AI context suggestions
    this.socket.on('ai_context_suggestion', (data: AiContextSuggestion) => {
      this.aiSuggestionSubject.next(data);
      if (data.context) {
        this.pendingAiContextSubject.next(data.context);
      }
    });
  }

  // === Emit Methods ===

  setStreamer(streamerId: string): void {
    this.socket.emit('set_streamer', { streamer_id: streamerId });
  }

  setManualContext(context: string): void {
    this.socket.emit('set_manual_context', { context });
  }

  setStreamerLock(locked: boolean): void {
    this.socket.emit('set_streamer_lock', { locked });
  }

  setContextLock(locked: boolean): void {
    this.socket.emit('set_context_lock', { locked });
  }

  sendEvent(sourceStr: string, text: string, metadata: Record<string, unknown> = {}, username?: string): void {
    this.socket.emit('event', { source_str: sourceStr, text, metadata, username });
  }

  /** Call after the user accepts or dismisses the pending AI context. */
  clearPendingAiContext(): void {
    this.pendingAiContextSubject.next(null);
  }

  // === HTTP API Methods ===

  async fetchStreamers(): Promise<Streamer[]> {
    try {
      const data = await (await fetch('/assets/streamers.json')).json();
      return data.streamers || [];
    } catch {
      return [{ id: 'peepingotter', display_name: 'PeepingOtter' }];
    }
  }

  async fetchBreadcrumbs(): Promise<{ formatted_context: string }> {
    try {
      return await (await fetch('/breadcrumbs')).json();
    } catch (error) {
      console.error('[DirectorService] Failed to fetch breadcrumbs:', error);
      return { formatted_context: '[Error fetching context]' };
    }
  }

  async fetchSummaryData(): Promise<unknown> {
    try {
      return await (await fetch('/summary_data')).json();
    } catch (error) {
      console.error('[DirectorService] Failed to fetch summary data:', error);
      return null;
    }
  }

  ngOnDestroy(): void {
    if (this.socket) this.socket.disconnect();
  }
}