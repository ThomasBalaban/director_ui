// thomasbalaban/director_ui/src/app/services/director.service.ts
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

// Match Dashboard component expectations
export interface ChatMessage { username: string; message: string; timestamp: number; }
export interface AudioLogEntry { text: string; is_partial: boolean; timestamp: number; }
export interface ScoreEntry { timestamp: number; score: number; }

@Injectable({
  providedIn: 'root'
})
export class DirectorService implements OnDestroy {
  private socket: Socket;

  // === State Subjects ===
  private directorStateSubject = new BehaviorSubject<DirectorState | null>(null);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  
  // === Persistent Logs (For UI Panels) ===
  private visionLogSubject = new BehaviorSubject<string[]>([]);
  private spokenLogSubject = new BehaviorSubject<string[]>([]);
  private audioLogSubject  = new BehaviorSubject<AudioLogEntry[]>([]);
  private chatMessagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private namiRepliesSubject  = new BehaviorSubject<BotReply[]>([]);
  private scoreHistorySubject = new BehaviorSubject<ScoreEntry[]>([]);
  private pendingAiContextSubject = new BehaviorSubject<string | null>(null);

  // === Public Observables ===
  public directorState$ = this.directorStateSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  
  public visionLog$ = this.visionLogSubject.asObservable();
  public spokenLog$ = this.spokenLogSubject.asObservable();
  public audioLog$  = this.audioLogSubject.asObservable();
  public chatMessages$ = this.chatMessagesSubject.asObservable();
  public namiReplies$  = this.namiRepliesSubject.asObservable();
  public scoreHistory$ = this.scoreHistorySubject.asObservable();
  public pendingAiContext$ = this.pendingAiContextSubject.asObservable();

  constructor() {
    this.socket = io(environment.socketUrl || 'http://localhost:8002', {
      transports: ['websocket', 'polling']
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('connect', () => this.connectionStatusSubject.next(true));
    this.socket.on('disconnect', () => this.connectionStatusSubject.next(false));

    // Handle Vision Data
    this.socket.on('vision_context', (data: VisionContext) => {
      const current = this.visionLogSubject.value;
      this.visionLogSubject.next([...current.slice(-49), data.context]);
    });

    // Handle Mic Data (Fixes "nothing from mic" issue)
    this.socket.on('spoken_word_context', (data: SpokenWordContext) => {
      const current = this.spokenLogSubject.value;
      this.spokenLogSubject.next([...current.slice(-49), data.context]);
    });

    // Handle Desktop Audio
    this.socket.on('audio_context', (data: AudioContext) => {
      const current = this.audioLogSubject.value;
      this.audioLogSubject.next([...current.slice(-49), {
        text: data.context,
        is_partial: data.is_partial,
        timestamp: Date.now()
      }]);
    });

    // Handle Chat
    this.socket.on('twitch_message', (data: TwitchMessage) => {
      const current = this.chatMessagesSubject.value;
      this.chatMessagesSubject.next([...current.slice(-99), {
        ...data,
        timestamp: Date.now()
      }]);
    });

    this.socket.on('bot_reply', (data: BotReply) => {
      const current = this.namiRepliesSubject.value;
      this.namiRepliesSubject.next([...current.slice(-49), data]);
    });

    this.socket.on('director_state', (data: DirectorState) => {
      this.directorStateSubject.next(data);
    });
  }

  // === Control Methods ===
  setStreamer(streamer_id: string): void { this.socket.emit('set_streamer', { streamer_id }); }
  setManualContext(context: string): void { this.socket.emit('set_manual_context', { context }); }
  setStreamerLock(locked: boolean): void { this.socket.emit('set_streamer_lock', { locked }); }
  setContextLock(locked: boolean): void { this.socket.emit('set_context_lock', { locked }); }
  clearPendingAiContext(): void { this.pendingAiContextSubject.next(null); }

  async fetchStreamers(): Promise<Streamer[]> {
    return [{ id: 'peepingotter', display_name: 'PeepingOtter' }];
  }

  ngOnDestroy(): void {
    if (this.socket) this.socket.disconnect();
  }
}