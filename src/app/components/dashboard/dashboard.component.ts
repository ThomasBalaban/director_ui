import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { DirectorState, BotReply, Streamer, ChatMessage } from '../../shared/interfaces/director.interfaces';

// Child Components
import { HeaderComponent } from '../header/header.component';
import { DirectivesPanelComponent } from '../directives-panel/directives-panel.component';
import { SummaryPanelComponent } from '../summary-panel/summary-panel.component';
import { SensoryPanelComponent } from '../sensory-panel/sensory-panel.component';
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';
import { ContextDrawerComponent } from '../context-drawer/context-drawer.component';
import { EventInterpreterPanelComponent } from '../event-interpreter-panel/event-interpreter-panel.component';
import { MemoryPanelComponent } from '../memory-panel/memory-panel.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    DirectivesPanelComponent,
    SummaryPanelComponent,
    SensoryPanelComponent,
    EventInterpreterPanelComponent,
    ChatPanelComponent,
    ContextDrawerComponent,
    MemoryPanelComponent,
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
  directorState: DirectorState | null = null;
  isConnected = false;
  streamers: Streamer[] = [];

  chatMessages: ChatMessage[] = [];
  namiReplies:  BotReply[] = [];

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

    this.subscriptions.add(this.directorService.chatMessages$.subscribe(msgs => this.chatMessages = msgs));
    this.subscriptions.add(this.directorService.namiReplies$.subscribe(replies => this.namiReplies = replies));

    this.subscriptions.add(
      this.directorService.pendingAiContext$.subscribe(ctx => {
        if (ctx === null) {
          this.pendingAiContext = null;
          return;
        }
        if (!this.contextLocked) {
          this.manualContext = ctx;
          this.directorService.clearPendingAiContext();
        } else {
          this.pendingAiContext = ctx;
        }
      })
    );
  }

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