import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { DirectorState, BotReply, Streamer, ChatMessage } from '../../shared/interfaces/director.interfaces';

// Child Components
import { HeaderComponent } from '../header/header.component';
import { SensoryPanelComponent } from '../panels/sensory-panel/sensory-panel.component';
import { ChatPanelComponent } from '../panels/chat-panel/chat-panel.component';
import { ContextDrawerComponent } from '../context-drawer/context-drawer.component';
import { EventInterpreterPanelComponent } from '../panels/event-interpreter-panel/event-interpreter-panel.component';
import { BasePanelComponent } from '../panels/base-panel/base-panel.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    SensoryPanelComponent,
    EventInterpreterPanelComponent,
    ChatPanelComponent,
    ContextDrawerComponent,
    BasePanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: 'dashboard.component.scss',
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
  // True once we've seeded the operator-control fields from either
  // localStorage or the first director_state push.
  private controlsBootstrapped = false;

  constructor(private directorService: DirectorService) {}

  ngOnInit(): void {
    this.loadStreamers();
    this.bootstrapControlsFromLocalStorage();
    this.setupSubscriptions();
  }

  private bootstrapControlsFromLocalStorage(): void {
    const stored = this.directorService.getStoredControlState();
    let any = false;
    if (stored.streamer !== undefined) { this.selectedStreamer = stored.streamer; any = true; }
    if (stored.context !== undefined) { this.manualContext = stored.context; any = true; }
    if (stored.streamerLocked !== undefined) { this.streamerLocked = stored.streamerLocked; any = true; }
    if (stored.contextLocked !== undefined) { this.contextLocked = stored.contextLocked; any = true; }
    if (any) this.controlsBootstrapped = true;
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
        if (!state) return;
        this.directorState = state;
        // The four operator-control fields are UI-owned once bootstrapped from
        // localStorage. Only adopt the server's values on first sync when we
        // have nothing stored locally — otherwise the periodic director_state
        // emits would overwrite a user's set+lock with stale defaults.
        if (!this.controlsBootstrapped) {
          this.streamerLocked   = state.streamer_locked;
          this.contextLocked    = state.context_locked;
          this.manualContext    = state.manual_context || '';
          this.selectedStreamer = state.current_streamer || 'peepingotter';
          this.controlsBootstrapped = true;
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