import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import {
  DirectorState, ScoredEvent, TwitchMessage, BotReply, AiContextSuggestion,
  Streamer, ChatMessage, AudioLogEntry, ScoreEntry,
  ClassifiedEvent, AiContextPacket
} from '../interfaces/director.interfaces';

const MAX_LOG             = 50;
const MAX_SENSORY_HISTORY = 30;
const MAX_EVENT_HISTORY   = 50;

export interface ContinuousContext {
  type: string;
  context_string: string;
  timestamp: string;
}

export interface HistoryEntry {
  snapshot: ContinuousContext;
  aiResponse: { text: string; timestamp: string } | null;
}

function trimLog<T>(arr: T[], limit: number = MAX_LOG): T[] {
  return arr.length > limit ? arr.slice(arr.length - limit) : arr;
}

@Injectable({ providedIn: 'root' })
export class DirectorService implements OnDestroy {
  private socket: Socket;

  // === Connection ===
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public  connectionStatus$       = this.connectionStatusSubject.asObservable();

  // === Director Core ===
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

  // === Event Interpreter Service ===
  private classifiedEventsSubject = new BehaviorSubject<ClassifiedEvent[]>([]);
  private latestEventSubject      = new BehaviorSubject<ClassifiedEvent | null>(null);
  private latestAiContextSubject  = new BehaviorSubject<AiContextPacket | null>(null);

  public classifiedEvents$      = this.classifiedEventsSubject.asObservable();
  public latestClassifiedEvent$ = this.latestEventSubject.asObservable();
  public latestAiContext$       = this.latestAiContextSubject.asObservable();

  // === Sensory Aggregator pipeline ===
  private sensoryHistorySubject   = new BehaviorSubject<HistoryEntry[]>([]);
  private currentSensorySubject   = new BehaviorSubject<HistoryEntry | null>(null);
  private pendingSnapshotSubject  = new BehaviorSubject<ContinuousContext | null>(null);
  private latestContextSubject    = new BehaviorSubject<any>(null);
  private latestAiResponseSubject = new BehaviorSubject<{text: string; timestamp: string} | null>(null);

  public sensoryHistory$   = this.sensoryHistorySubject.asObservable();
  public currentSensory$   = this.currentSensorySubject.asObservable();
  public pendingSnapshot$  = this.pendingSnapshotSubject.asObservable();
  public latestRawContext$ = this.latestContextSubject.asObservable();
  public latestAiResponse$ = this.latestAiResponseSubject.asObservable();

  private aiSuggestionSubject = new Subject<AiContextSuggestion>();
  public  aiSuggestion$       = this.aiSuggestionSubject.asObservable();

  constructor() {
    this.socket = io(environment.socketUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('connect',       () => { console.log('[DirectorService] Connected'); this.connectionStatusSubject.next(true); });
    this.socket.on('disconnect',    () => { console.log('[DirectorService] Disconnected'); this.connectionStatusSubject.next(false); });
    this.socket.on('connect_error', (err) => { console.error('[DirectorService] Connection error:', err); this.connectionStatusSubject.next(false); });

    this.socket.on('director_state', (data: DirectorState) => this.directorStateSubject.next(data));
    this.socket.on('vision_context', (data: { context: string }) => this.visionLogSubject.next(trimLog([...this.visionLogSubject.value, data.context])));
    this.socket.on('spoken_word_context', (data: { context: string }) => this.spokenLogSubject.next(trimLog([...this.spokenLogSubject.value, data.context])));

    this.socket.on('audio_context', (data: { context: string; is_partial: boolean; session_id?: string }) => {
      let log = [...this.audioLogSubject.value];
      if (data.is_partial && data.session_id) {
        const idx = log.findIndex(a => a.sessionId === data.session_id);
        if (idx >= 0) log[idx] = { text: data.context, sessionId: data.session_id, isPartial: true };
        else          log.push({ text: data.context, sessionId: data.session_id, isPartial: true });
      } else {
        log.push({ text: data.context, sessionId: data.session_id, isPartial: false });
      }
      this.audioLogSubject.next(trimLog(log));
    });

    this.socket.on('twitch_message', (data: TwitchMessage) => {
      const isMention = /(nami|peepingnami)/gi.test(data.message);
      this.chatMessagesSubject.next(trimLog([
        ...this.chatMessagesSubject.value,
        { username: data.username, message: data.message, isMention, timestamp: Date.now() }
      ]));
    });

    this.socket.on('bot_reply', (data: BotReply) => {
      this.namiRepliesSubject.next(trimLog([...this.namiRepliesSubject.value, data]));
      this.chatMessagesSubject.next(trimLog([
        ...this.chatMessagesSubject.value,
        { username: 'Nami', message: data.reply, isNami: true, timestamp: Date.now() }
      ]));
    });

    this.socket.on('event_scored', (data: ScoredEvent) => {
      const history = [...this.scoreHistorySubject.value, { score: data.score, source: data.source, text: data.text, timestamp: Date.now() }];
      this.scoreHistorySubject.next(trimLog(history));
    });

    this.socket.on('ai_context_suggestion', (data: AiContextSuggestion) => {
      this.aiSuggestionSubject.next(data);
      if (data.context) this.pendingAiContextSubject.next(data.context);
    });

    this.socket.on('classified_event', (data: ClassifiedEvent) => {
      this.classifiedEventsSubject.next(trimLog([...this.classifiedEventsSubject.value, data], MAX_EVENT_HISTORY));
      this.latestEventSubject.next(data);
    });

    this.socket.on('ai_context', (data: AiContextPacket) => this.latestAiContextSubject.next(data));

    this.socket.on('continuous_context', (data: any) => {
      this.latestContextSubject.next(data);
      let snapshot: ContinuousContext;
      if (typeof data === 'string') snapshot = { type: 'continuous_context', context_string: data, timestamp: new Date().toISOString() };
      else if (data?.context_string) snapshot = data as ContinuousContext;
      else return;

      const current = this.currentSensorySubject.value;
      if (!current) this.currentSensorySubject.next({ snapshot, aiResponse: null });
      else if (!current.aiResponse) this.pendingSnapshotSubject.next(snapshot);
      else {
        this.sensoryHistorySubject.next(trimLog([...this.sensoryHistorySubject.value, current], MAX_SENSORY_HISTORY));
        this.currentSensorySubject.next({ snapshot, aiResponse: null });
      }
    });

    this.socket.on('ai_response', (data: any) => {
      this.latestAiResponseSubject.next(data);
      const current = this.currentSensorySubject.value;
      if (!current) return;
      const updatedCurrent = { ...current, aiResponse: data };
      this.currentSensorySubject.next(updatedCurrent);
      const pending = this.pendingSnapshotSubject.value;
      if (pending) {
        this.sensoryHistorySubject.next(trimLog([...this.sensoryHistorySubject.value, updatedCurrent], MAX_SENSORY_HISTORY));
        this.currentSensorySubject.next({ snapshot: pending, aiResponse: null });
        this.pendingSnapshotSubject.next(null);
      }
    });
  }

  setStreamer(streamerId: string): void { this.socket.emit('set_streamer', { streamer_id: streamerId }); }
  setManualContext(context: string): void { this.socket.emit('set_manual_context', { context }); }
  setStreamerLock(locked: boolean): void { this.socket.emit('set_streamer_lock', { locked }); }
  setContextLock(locked: boolean): void { this.socket.emit('set_context_lock', { locked }); }
  sendEvent(sourceStr: string, text: string, metadata: Record<string, unknown> = {}, username?: string): void {
    this.socket.emit('event', { source_str: sourceStr, text, metadata, username });
  }
  clearPendingAiContext(): void { this.pendingAiContextSubject.next(null); }

  async fetchStreamers(): Promise<Streamer[]> {
    try { const data = await (await fetch('/assets/streamers.json')).json(); return data.streamers || []; }
    catch { return [{ id: 'peepingotter', display_name: 'PeepingOtter' }]; }
  }
  async fetchBreadcrumbs(): Promise<{ formatted_context: string }> {
    try { return await (await fetch('/breadcrumbs')).json(); }
    catch { return { formatted_context: '[Error fetching context]' }; }
  }
  async fetchSummaryData(): Promise<unknown> {
    try { return await (await fetch('/summary_data')).json(); }
    catch { return null; }
  }

  forceReconnect(): void {
    if (this.socket) {
      console.log('[DirectorService] Forcing socket reconnection...');
      this.socket.disconnect().connect();
    }
  }

  ngOnDestroy(): void { if (this.socket) this.socket.disconnect(); }
}