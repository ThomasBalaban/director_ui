import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DirectorService, ContinuousContext, HistoryEntry } from '../../../shared/services/director.service';
import { ContextDrawerComponent } from '../../context-drawer/context-drawer.component';

@Component({
  selector: 'app-sensory-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, ContextDrawerComponent],
  template: `
    <div class="panel sensory-panel">

      <div class="panel-title sensory-header">
        <div class="sensory-header-left">
          <span>🧠 Sensory Aggregator</span>
          <span class="sensory-live" [class.sensory-live--active]="!!current">
            <span class="live-pip"></span>
            {{ current ? 'STREAMING' : 'WAITING' }}
          </span>
          <span class="queue-badge" *ngIf="pendingSnapshot" title="One snapshot queued, waiting for current evaluation">
            ⏳ 1 queued
          </span>
        </div>
        <div class="header-right">
          <a routerLink="/sensors" class="raw-feeds-link">Raw feeds →</a>
        </div>
      </div>

      <div class="panel-content sensory-content">

        <div class="current-pane" *ngIf="current; else noEvent">

          <div class="pane-label">
            <span class="pulse-icon">⚡</span>
            <span>CURRENT</span>
            <span class="pane-time">{{ formatTime(current.snapshot.timestamp) }}</span>
          </div>

          <div class="current-screen">
            <pre class="current-text">{{ current.snapshot.context_string }}</pre>
          </div>

          <div class="current-footer">
            <span
              class="status-dot"
              [style.background]="getAiDotColor(current)"
              [style.box-shadow]="current.aiResponse && current.aiResponse.text !== '<SILENCE>' ? '0 0 5px #4ade80' : 'none'"
            ></span>
            <span *ngIf="!current.aiResponse" class="footer-text footer-text--waiting">
              Awaiting evaluation...
            </span>
            <span *ngIf="current.aiResponse?.text === '<SILENCE>'" class="footer-text footer-text--silence">
              Silent (decided not to respond)
            </span>
            <span *ngIf="current.aiResponse && current.aiResponse.text !== '<SILENCE>'" class="footer-text footer-text--response">
              🎙️ {{ current.aiResponse.text }}
            </span>
          </div>

        </div>

        <ng-template #noEvent>
          <div class="no-event">
            <span class="no-event-icon">🔭</span>
            <span>Waiting for sensory feed...</span>
            <span class="no-event-hint">Aggregator emits snapshots every 3 seconds</span>
          </div>
        </ng-template>

        <div class="history-pane" *ngIf="history.length > 0">

          <div class="history-pane-label">
            <span>📋 PREVIOUS SNAPSHOTS</span>
            <span class="history-count-inline">{{ history.length }} / {{ maxHistory }}</span>
          </div>

          <div class="history-scroll" #historyScroll>
            <div
              *ngFor="let entry of history.slice().reverse(); let i = index"
              class="history-entry"
              (click)="openDrawer(entry)"
            >
              <div class="history-entry-body">
                <pre class="history-text">{{ entry.snapshot.context_string }}</pre>
              </div>
              <div class="history-entry-bar">
                <span class="history-entry-num">#{{ history.length - i }}</span>
                <span class="history-entry-time">{{ formatTime(entry.snapshot.timestamp) }}</span>
                <span
                  class="history-dot"
                  [style.background]="getAiDotColor(entry)"
                  [title]="getAiDotTitle(entry)"
                ></span>
                <span class="history-ai-text" *ngIf="entry.aiResponse && entry.aiResponse.text !== '<SILENCE>'">
                  {{ entry.aiResponse.text }}
                </span>
                <span class="history-ai-silence" *ngIf="entry.aiResponse?.text === '<SILENCE>'">
                  —
                </span>
              </div>

              

            </div>
          </div>

        </div>

      </div>
    </div>

    <app-context-drawer
      [isOpen]="isDrawerOpen"
      [data]="selectedDrawerEntry"
      title="Sensory Snapshot Details"
      promptLabel="Sensory Context"
      replyLabel="AI Evaluation"
      (close)="isDrawerOpen = false">
    </app-context-drawer>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .sensory-panel {
      background: var(--surface-3);
      border-color: rgba(99, 226, 183, 0.2);
    }

    /* ── Header ── */
    .sensory-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sensory-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sensory-live {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-dimmer);
      background: var(--surface-1);
      border: 1px solid var(--border-faint);
      border-radius: var(--radius-full);
      padding: 2px 7px;
    }

    .sensory-live--active {
      color: var(--accent-green-light);
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.25);
    }

    .live-pip {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
    }

    .sensory-live--active .live-pip {
      animation: pip-pulse 1.5s ease-in-out infinite;
    }

    .queue-badge {
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--accent-yellow-light);
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: var(--radius-full);
      padding: 2px 7px;
    }

    .history-count {
      font-size: 0.65rem;
      color: var(--text-dimmer);
      font-family: monospace;
    }

    .raw-feeds-link {
      font-size: 0.7rem;
      color: var(--text-dimmer);
      text-decoration: none;
      padding: 2px 8px;
      border: 1px solid var(--border-faint);
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);

      &:hover {
        color: var(--accent-teal);
        border-color: rgba(99, 226, 183, 0.4);
        background: rgba(99, 226, 183, 0.05);
      }
    }

    /* ── Panel content ── */
    .sensory-content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      height: 100%;
      padding: 0.75rem;
      overflow: hidden;
    }

    /* ── Current pane ── */
    .current-pane {
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(99, 226, 183, 0.4);
      border-radius: var(--radius-md);
      background: #0a0a0a;
      box-shadow: 0 0 12px rgba(99, 226, 183, 0.06);
      flex-shrink: 0;
    }

    .pane-label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0.35rem 0.75rem;
      background: rgba(99, 226, 183, 0.07);
      border-bottom: 1px solid rgba(99, 226, 183, 0.2);
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #6ee7b7;
    }

    .pulse-icon { font-size: 0.7rem; }

    .pane-time {
      margin-left: auto;
      font-family: monospace;
      color: var(--text-dimmer);
      font-weight: 400;
    }

    .current-screen {
      padding: 0.65rem 0.75rem;
      overflow-y: auto;
      max-height: 260px;
    }

    .current-text {
      margin: 0;
      font-size: 0.72rem;
      line-height: 1.55;
      color: #a7f3d0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', monospace;
    }

    .current-footer {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 0.3rem 0.75rem;
      background: var(--surface-1);
      border-top: 1px solid var(--border-faint);
      min-height: 28px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .footer-text {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.5;
      flex: 1;
    }

    .footer-text--waiting  { color: var(--text-dimmer); font-style: italic; animation: blink 2s infinite; }
    .footer-text--silence  { color: #6b7280; }
    .footer-text--response { color: #4ade80; text-transform: none; font-size: 0.7rem; }

    /* ── History pane ── */
    .history-pane {
      display: flex;
      flex-direction: column;
      background: var(--surface-1);
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .history-pane-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.35rem 0.75rem;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-faint);
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text-dimmer);
      flex-shrink: 0;
    }

    .history-count-inline {
      font-family: monospace;
      font-weight: 400;
    }

    .history-scroll {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background: #1e1e1e;
    }

    /* ── History entries ── */
    .history-entry {
      border: 1px solid var(--border-faint);
      flex-shrink: 0;
      cursor: pointer;
      transition: background-color var(--transition-fast);
      margin-bottom: 1rem;

      &:last-child { border-bottom: none; }

      &:hover .history-entry-bar { background: var(--surface-3); }
      &:hover .history-entry-body { background: #111; }
    }

    .history-entry-bar {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 0.3rem 0.75rem;
      background: var(--surface-2);
      transition: background-color var(--transition-fast);
    }

    .history-entry-num {
      font-size: 0.62rem;
      font-family: monospace;
      color: var(--text-dimmer);
      flex-shrink: 0;
      min-width: 2rem;
    }

    .history-entry-time {
      font-size: 0.62rem;
      font-family: monospace;
      color: var(--text-dimmer);
      flex-shrink: 0;
    }

    .history-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 5px;
    }

    .history-ai-text {
      font-size: 0.68rem;
      color: #63e2b7;
      flex: 1;
      white-space: normal;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .history-ai-silence {
      font-size: 0.68rem;
      color: var(--text-dimmer);
      flex: 1;
    }

    .history-entry-body {
      padding: 0.4rem 0.75rem;
      background: #0a0a0a;
      position: relative;
      transition: background-color var(--transition-fast);

      &::after {
        content: '';
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 20px;
        background: linear-gradient(transparent, #0a0a0a);
        pointer-events: none;
      }
    }

    .history-text {
      margin: 0;
      font-size: 0.65rem;
      line-height: 1.4;
      color: #4a7c6a;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', monospace;
    }

    /* ── No event ── */
    .no-event {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 2.5rem 1.5rem;
      color: var(--text-dim);
      font-size: 0.8rem;
      font-style: italic;
      border: 1px dashed var(--border-faint);
      border-radius: var(--radius-md);
    }

    .no-event-icon { font-size: 1.5rem; opacity: 0.4; margin-bottom: 0.5rem; }
    .no-event-hint { font-size: 0.7rem; color: var(--text-dimmer); }

    @keyframes pip-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `]
})
export class SensoryPanelComponent implements OnInit, OnDestroy, AfterViewChecked {
  current: HistoryEntry | null = null;
  history: HistoryEntry[] = [];
  pendingSnapshot: ContinuousContext | null = null;
  readonly maxHistory = 30;

  // Drawer state
  selectedDrawerEntry: any = null;
  isDrawerOpen = false;

  private subs = new Subscription();
  private shouldScrollHistory = false;
  private lastHistoryLength = 0;

  @ViewChild('historyScroll') historyScrollRef!: ElementRef;

  constructor(private directorService: DirectorService) {}

  ngOnInit(): void {
    this.subs.add(
      this.directorService.currentSensory$.subscribe(curr => this.current = curr)
    );
    this.subs.add(
      this.directorService.pendingSnapshot$.subscribe(pending => this.pendingSnapshot = pending)
    );
    this.subs.add(
      this.directorService.sensoryHistory$.subscribe(hist => {
        this.history = hist;
        if (hist.length > this.lastHistoryLength) {
          this.shouldScrollHistory = true;
        }
        this.lastHistoryLength = hist.length;
      })
    );
  }

  openDrawer(entry: HistoryEntry) {
    this.selectedDrawerEntry = {
      prompt: entry.snapshot.context_string,
      reply: entry.aiResponse?.text === '<SILENCE>' 
        ? 'Silent (decided not to respond)' 
        : (entry.aiResponse?.text || 'No response recorded'),
      is_censored: false
    };
    this.isDrawerOpen = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollHistory && this.historyScrollRef) {
      this.historyScrollRef.nativeElement.scrollTop = 0;
      this.shouldScrollHistory = false;
    }
  }

  getAiDotColor(entry: HistoryEntry): string {
    if (!entry.aiResponse) return '#facc15';
    if (entry.aiResponse.text === '<SILENCE>') return '#6b7280';
    return '#4ade80';
  }

  getAiDotTitle(entry: HistoryEntry): string {
    if (!entry.aiResponse) return 'Awaiting evaluation';
    if (entry.aiResponse.text === '<SILENCE>') return 'Silent';
    return entry.aiResponse.text;
  }

  formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}