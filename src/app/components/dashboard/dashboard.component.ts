import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DirectorService, ChatMessage, AudioLogEntry, ScoreEntry } from '../../shared/services/dashboard.service';
import { DirectorState, BotReply, Streamer } from '../../models/director.models';

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
  styles: [`
    .dashboard-container {
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 1rem 2.5rem;
      box-sizing: border-box;
    }

    .main-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      min-height: 0;
      overflow: hidden;
    }

    @media (max-width: 1400px) {
      .main-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 900px) {
      .main-grid { grid-template-columns: 1fr; }
      .dashboard-container { padding: 0.5rem 1.5rem; overflow-y: auto; }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  // All data comes directly from the service's BehaviorSubjects
  directorState: DirectorState | null = null;
  isConnected = false;
  streamers: Streamer[] = [];

  visionLog:  string[] = [];
  spokenLog:  string[] = [];
  audioLog:   AudioLogEntry[] = [];
  chatMessages: ChatMessage[] = [];
  namiReplies:  BotReply[] = [];
  scoreHistory: ScoreEntry[] = [];

  drawerOpen = false;
  drawerData: BotReply | null = null;

  streamerLocked   = false;
  contextLocked    = false;
  manualContext    = '';
  selectedStreamer = 'peepingotter';
  pendingAiContext: string | null = null;

  private subscriptions = new Subscription();

  constructor(private directorService: DirectorService) {}

  ngOnInit(): void {
    this.loadStreamers();
    this.setupSubscriptions();
  }

  private async loadStreamers(): Promise<void> {
    this.streamers = await this.directorService.fetchStreamers();
  }

  private setupSubscriptions(): void {
    this.subscriptions.add(
      this.directorService.connectionStatus$.subscribe(c => this.isConnected = c)
    );

    this.subscriptions.add(
      this.directorService.directorState$.subscribe(state => {
        if (state) {
          this.directorState    = state;
          this.streamerLocked   = state.streamer_locked;
          this.contextLocked    = state.context_locked;
          this.manualContext    = state.manual_context || '';
          this.selectedStreamer = state.current_streamer || 'peepingotter';
        }
      })
    );

    // Read accumulated logs directly from service — already persisted
    this.subscriptions.add(this.directorService.visionLog$.subscribe(log => this.visionLog = log));
    this.subscriptions.add(this.directorService.spokenLog$.subscribe(log => this.spokenLog = log));
    this.subscriptions.add(this.directorService.audioLog$.subscribe(log => this.audioLog = log));
    this.subscriptions.add(this.directorService.chatMessages$.subscribe(msgs => this.chatMessages = msgs));
    this.subscriptions.add(this.directorService.namiReplies$.subscribe(replies => this.namiReplies = replies));
    this.subscriptions.add(this.directorService.scoreHistory$.subscribe(history => this.scoreHistory = history));

    // Pending AI context
    this.subscriptions.add(
      this.directorService.pendingAiContext$.subscribe(ctx => {
        if (ctx === null) {
          this.pendingAiContext = null;
          return;
        }
        if (!this.contextLocked) {
          // Auto-accept when unlocked
          this.manualContext = ctx;
          this.directorService.clearPendingAiContext();
        } else {
          this.pendingAiContext = ctx;
        }
      })
    );
  }

  // === Child component event handlers ===

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
      this.directorService.clearPendingAiContext();
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