import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import {
  DirectorState,
  ScoredEvent,
  VisionContext,
  SpokenWordContext,
  AudioContext,
  TwitchMessage,
  BotReply,
  AiContextSuggestion,
  Streamer
} from '../models/director.models';

@Injectable({
  providedIn: 'root'
})
export class DirectorService implements OnDestroy {
  private socket: Socket;

  // === State Subjects ===
  private directorStateSubject = new BehaviorSubject<DirectorState | null>(null);
  private visionContextSubject = new Subject<VisionContext>();
  private spokenWordContextSubject = new Subject<SpokenWordContext>();
  private audioContextSubject = new Subject<AudioContext>();
  private twitchMessageSubject = new Subject<TwitchMessage>();
  private botReplySubject = new Subject<BotReply>();
  private eventScoredSubject = new Subject<ScoredEvent>();
  private aiSuggestionSubject = new Subject<AiContextSuggestion>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);

  // === Public Observables ===
  public directorState$ = this.directorStateSubject.asObservable();
  public visionContext$ = this.visionContextSubject.asObservable();
  public spokenWordContext$ = this.spokenWordContextSubject.asObservable();
  public audioContext$ = this.audioContextSubject.asObservable();
  public twitchMessage$ = this.twitchMessageSubject.asObservable();
  public botReply$ = this.botReplySubject.asObservable();
  public eventScored$ = this.eventScoredSubject.asObservable();
  public aiSuggestion$ = this.aiSuggestionSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

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
    // Connection events
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

    // Director state updates
    this.socket.on('director_state', (data: DirectorState) => {
      this.directorStateSubject.next(data);
    });

    // Context streams
    this.socket.on('vision_context', (data: VisionContext) => {
      this.visionContextSubject.next(data);
    });

    this.socket.on('spoken_word_context', (data: SpokenWordContext) => {
      this.spokenWordContextSubject.next(data);
    });

    this.socket.on('audio_context', (data: AudioContext) => {
      this.audioContextSubject.next(data);
    });

    // Chat events
    this.socket.on('twitch_message', (data: TwitchMessage) => {
      this.twitchMessageSubject.next(data);
    });

    this.socket.on('bot_reply', (data: BotReply) => {
      this.botReplySubject.next(data);
    });

    // Scoring events
    this.socket.on('event_scored', (data: ScoredEvent) => {
      this.eventScoredSubject.next(data);
    });

    // AI suggestions
    this.socket.on('ai_context_suggestion', (data: AiContextSuggestion) => {
      this.aiSuggestionSubject.next(data);
    });
  }

  // === Emit Methods (Send to Backend) ===

  setStreamer(streamerId: string): void {
    this.socket.emit('set_streamer', { streamer_id: streamerId });
    console.log('[DirectorService] Set streamer:', streamerId);
  }

  setManualContext(context: string): void {
    this.socket.emit('set_manual_context', { context });
    console.log('[DirectorService] Set context:', context);
  }

  setStreamerLock(locked: boolean): void {
    this.socket.emit('set_streamer_lock', { locked });
    console.log('[DirectorService] Streamer lock:', locked);
  }

  setContextLock(locked: boolean): void {
    this.socket.emit('set_context_lock', { locked });
    console.log('[DirectorService] Context lock:', locked);
  }

  sendEvent(sourceStr: string, text: string, metadata: Record<string, unknown> = {}, username?: string): void {
    this.socket.emit('event', {
      source_str: sourceStr,
      text,
      metadata,
      username
    });
  }

  // === HTTP API Methods ===
  async fetchStreamers(): Promise<Streamer[]> {
    try {
      const response = await fetch('/assets/streamers.json');
      const data = await response.json();
      return data.streamers || [];
    } catch {
      return [{ id: 'peepingotter', display_name: 'PeepingOtter' }];
    }
  }

  async fetchBreadcrumbs(): Promise<{ formatted_context: string }> {
    try {
      const response = await fetch(`/breadcrumbs`);
      return await response.json();
    } catch (error) {
      console.error('[DirectorService] Failed to fetch breadcrumbs:', error);
      return { formatted_context: '[Error fetching context]' };
    }
  }

  async fetchSummaryData(): Promise<unknown> {
    try {
      const response = await fetch(`/summary_data`);
      return await response.json();
    } catch (error) {
      console.error('[DirectorService] Failed to fetch summary data:', error);
      return null;
    }
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
