import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';

// This interface matches the new Python dictionary emitted every 3 seconds
export interface ContinuousContext {
  type: string;
  context_string: string;
  timestamp: string;
}

@Component({
  selector: 'app-sensory-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="panel sensory-panel">

      <div class="panel-title sensory-header">
        <div class="sensory-header-left">
          <span>🧠 Sensory Aggregator</span>
          <span class="sensory-live" [class.sensory-live--active]="!!latestSnapshot">
            <span class="live-pip"></span>
            {{ latestSnapshot ? 'STREAMING' : 'WAITING' }}
          </span>
        </div>
        <a routerLink="/sensors" class="raw-feeds-link" title="View raw sensor feeds">
          Raw feeds →
        </a>
      </div>

      <div class="panel-content sensory-content">

        <div class="monitor-container" *ngIf="latestSnapshot; else noEvent">
          
          <div class="monitor-top-bar">
            <div class="monitor-brand">
              <span class="pulse-icon">⚡</span>
              <span>LIVE OBSERVER FEED</span>
            </div>
            <div class="monitor-time">
              Updated: {{ formatTime(latestSnapshot.timestamp) }}
            </div>
          </div>

          <div class="monitor-screen">
            <pre class="monitor-text">{{ latestSnapshot.context_string }}</pre>
          </div>
          
          <div class="monitor-footer">
            <div class="status-indicator">
              <span class="status-dot" [style.background]="latestAiResponse?.text === '<SILENCE>' ? '#9ca3af' : '#4ade80'" [style.box-shadow]="latestAiResponse?.text === '<SILENCE>' ? 'none' : '0 0 5px #4ade80'"></span>
              <span *ngIf="!latestAiResponse">Awaiting Ollama Evaluation...</span>
              <span *ngIf="latestAiResponse?.text === '<SILENCE>'">Thinking... (Decided to stay silent)</span>
              <span *ngIf="latestAiResponse && latestAiResponse.text !== '<SILENCE>'" style="color: #4ade80;">
                🎙️ {{ latestAiResponse.text }}
              </span>
            </div>
          </div>

        </div>

        <ng-template #noEvent>
          <div class="no-event">
            <span class="no-event-icon">🔭</span>
            <span>Waiting for sensory feed...</span>
            <span class="no-event-hint">Aggregator will emit snapshots every 3 seconds</span>
          </div>
        </ng-template>

      </div>
    </div>
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

    @keyframes pip-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
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
      gap: 0.875rem;
      height: 100%;
    }

    /* ── Live Monitor UI ── */
    .monitor-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      border: 1px solid var(--border-faint);
      border-radius: var(--radius-md);
      overflow: hidden;
      background: #0a0a0a;
      box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
    }

    .monitor-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0.75rem;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-faint);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .monitor-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #6ee7b7;
    }

    .pulse-icon {
      font-size: 0.7rem;
    }

    .monitor-time {
      color: var(--text-dimmer);
      font-family: monospace;
    }

    .monitor-screen {
      flex: 1;
      padding: 0.75rem;
      overflow-y: auto;
      max-height: 300px;
    }

    .monitor-text {
      margin: 0;
      font-size: 0.75rem;
      line-height: 1.6;
      color: #a7f3d0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', monospace;
    }

    .monitor-footer {
      padding: 0.3rem 0.75rem;
      background: var(--surface-1);
      border-top: 1px solid var(--border-faint);
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.65rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      background: #facc15;
      border-radius: 50%;
      box-shadow: 0 0 5px #facc15;
      animation: blink 2s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
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
  `]
})
export class SensoryPanelComponent implements OnInit, OnDestroy {
  latestSnapshot: ContinuousContext | null = null;
  private subs = new Subscription();
  latestAiResponse: {text: string, timestamp: string} | null = null;

  constructor(private directorService: DirectorService) {}

  ngOnInit(): void {
    // We subscribe to the latestAiContext$ from your service.
    this.subs.add(
      this.directorService.latestAiContext$.subscribe((ctx: any) => {
        // This ensures that whether your service passes the full object or just the string, 
        // the UI handles it gracefully.
        if (typeof ctx === 'string') {
          this.latestSnapshot = { 
            type: 'continuous_context', 
            context_string: ctx, 
            timestamp: new Date().toISOString() 
          };
        } else if (ctx && ctx.context_string) {
          this.latestSnapshot = ctx;
        }
      })
    );

    this.subs.add(
      this.directorService.latestAiResponse$.subscribe(res => {
        this.latestAiResponse = res;
      })
    );
  }

  formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { 
      return iso; 
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}