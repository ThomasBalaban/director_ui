import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../services/director.service';
import {
  DirectorState,
  ScoredEvent,
  TwitchMessage,
  BotReply,
  Streamer,
  AiContextSuggestion
} from '../../models/director.models';

// Child Components
import { HeaderComponent } from '../header/header.component';
import { DirectivesPanelComponent } from '../directives-panel/directives-panel.component';
import { SummaryPanelComponent } from '../summary-panel/summary-panel.component';
import { InterestGraphComponent } from '../interest-graph/interest-graph.component';
import { ContextPanelComponent } from '../context-panel/context-panel.component';
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';
import { MetricsPanelComponent } from '../metrics-panel/metrics-panel.component';
import { MemoryPanelComponent } from '../memory-panel/memory-panel.component';
import { UserPanelComponent } from '../user-panel/user-panel.component';
import { ContextDrawerComponent } from '../context-drawer/context-drawer.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    DirectivesPanelComponent,
    SummaryPanelComponent,
    InterestGraphComponent,
    ContextPanelComponent,
    ChatPanelComponent,
    MetricsPanelComponent,
    MemoryPanelComponent,
    UserPanelComponent,
    ContextDrawerComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // State
  directorState: DirectorState | null = null;
  isConnected = false;
  streamers: Streamer[] = [];
  
  // Context logs
  visionLog: string[] = [];
  spokenLog: string[] = [];
  audioLog: { text: string; sessionId?: string; isPartial?: boolean }[] = [];
  
  // Chat logs
  chatMessages: { username: string; message: string; isNami?: boolean; isMention?: boolean }[] = [];
  namiReplies: BotReply[] = [];
  
  // Graph data
  scoreHistory: { score: number; source: string; text: string }[] = [];
  
  // Drawer state
  drawerOpen = false;
  drawerData: BotReply | null = null;
  
  // Lock states
  streamerLocked = false;
  contextLocked = false;
  manualContext = '';
  selectedStreamer = 'peepingotter';
  
  // AI Suggestions
  pendingAiContext: string | null = null;
  
  private subscriptions = new Subscription();
  private readonly MAX_LOG_ITEMS = 50;
  
  constructor(private directorService: DirectorService) {}
  
  ngOnInit(): void {
    this.loadStreamers();
    this.setupSubscriptions();
  }
  
  private async loadStreamers(): Promise<void> {
    this.streamers = await this.directorService.fetchStreamers();
  }
  
  private setupSubscriptions(): void {
    // Connection status
    this.subscriptions.add(
      this.directorService.connectionStatus$.subscribe(connected => {
        this.isConnected = connected;
      })
    );
    
    // Main director state
    this.subscriptions.add(
      this.directorService.directorState$.subscribe(state => {
        if (state) {
          this.directorState = state;
          this.streamerLocked = state.streamer_locked;
          this.contextLocked = state.context_locked;
          this.manualContext = state.manual_context || '';
          this.selectedStreamer = state.current_streamer || 'peepingotter';
        }
      })
    );
    
    // Vision context
    this.subscriptions.add(
      this.directorService.visionContext$.subscribe(data => {
        this.addToLog(this.visionLog, data.context);
      })
    );
    
    // Spoken word context
    this.subscriptions.add(
      this.directorService.spokenWordContext$.subscribe(data => {
        this.addToLog(this.spokenLog, data.context);
      })
    );
    
    // Audio context
    this.subscriptions.add(
      this.directorService.audioContext$.subscribe(data => {
        this.handleAudioContext(data);
      })
    );
    
    // Twitch messages
    this.subscriptions.add(
      this.directorService.twitchMessage$.subscribe(data => {
        this.addChatMessage(data);
      })
    );
    
    // Bot replies
    this.subscriptions.add(
      this.directorService.botReply$.subscribe(data => {
        this.handleBotReply(data);
      })
    );
    
    // Event scores
    this.subscriptions.add(
      this.directorService.eventScored$.subscribe(data => {
        this.addScoreData(data);
      })
    );
    
    // AI suggestions
    this.subscriptions.add(
      this.directorService.aiSuggestion$.subscribe(data => {
        this.handleAiSuggestion(data);
      })
    );
  }
  
  private addToLog(log: string[], item: string): void {
    log.push(item);
    if (log.length > this.MAX_LOG_ITEMS) {
      log.shift();
    }
  }
  
  private handleAudioContext(data: { context: string; is_partial: boolean; session_id?: string }): void {
    if (data.is_partial && data.session_id) {
      const existing = this.audioLog.find(a => a.sessionId === data.session_id);
      if (existing) {
        existing.text = data.context;
        existing.isPartial = true;
      } else {
        this.audioLog.push({ text: data.context, sessionId: data.session_id, isPartial: true });
      }
    } else {
      this.audioLog.push({ text: data.context, sessionId: data.session_id, isPartial: false });
    }
    
    if (this.audioLog.length > this.MAX_LOG_ITEMS) {
      this.audioLog.shift();
    }
  }
  
  private addChatMessage(data: TwitchMessage): void {
    const isMention = /(nami|peepingnami)/gi.test(data.message);
    this.chatMessages.push({
      username: data.username,
      message: data.message,
      isMention
    });
    
    if (this.chatMessages.length > this.MAX_LOG_ITEMS) {
      this.chatMessages.shift();
    }
  }
  
  private handleBotReply(data: BotReply): void {
    this.namiReplies.push(data);
    
    // Also add to chat
    this.chatMessages.push({
      username: 'Nami',
      message: data.reply,
      isNami: true
    });
    
    if (this.namiReplies.length > this.MAX_LOG_ITEMS) {
      this.namiReplies.shift();
    }
    if (this.chatMessages.length > this.MAX_LOG_ITEMS) {
      this.chatMessages.shift();
    }
  }
  
  private addScoreData(data: ScoredEvent): void {
    this.scoreHistory.push({
      score: data.score,
      source: data.source,
      text: data.text
    });
    
    if (this.scoreHistory.length > 50) {
      this.scoreHistory.shift();
    }
  }
  
  private handleAiSuggestion(data: AiContextSuggestion): void {
    if (data.context && !this.contextLocked) {
      // Auto-apply if not locked
      this.manualContext = data.context;
    } else if (data.context && this.contextLocked) {
      // Store pending suggestion
      this.pendingAiContext = data.context;
    }
  }
  
  // === Event Handlers (from child components) ===
  
  onStreamerChange(streamerId: string): void {
    this.selectedStreamer = streamerId;
    this.directorService.setStreamer(streamerId);
  }
  
  onContextSubmit(context: string): void {
    this.manualContext = context;
    this.directorService.setManualContext(context);
  }
  
  onStreamerLockToggle(): void {
    this.streamerLocked = !this.streamerLocked;
    this.directorService.setStreamerLock(this.streamerLocked);
  }
  
  onContextLockToggle(): void {
    this.contextLocked = !this.contextLocked;
    this.directorService.setContextLock(this.contextLocked);
  }
  
  onAcceptAiSuggestion(): void {
    if (this.pendingAiContext) {
      this.manualContext = this.pendingAiContext;
      this.directorService.setManualContext(this.pendingAiContext);
      this.pendingAiContext = null;
    }
  }
  
  onOpenDrawer(reply: BotReply): void {
    this.drawerData = reply;
    this.drawerOpen = true;
  }
  
  onCloseDrawer(): void {
    this.drawerOpen = false;
    this.drawerData = null;
  }
  
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
