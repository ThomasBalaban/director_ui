import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PollingComponent } from '../../shared/polling.component';

interface ThreadStats {
  [key: string]: unknown;
}

@Component({
  selector: 'app-thread-stats',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="thread-stats">
      @if (loading()) {
        <div class="loading">Loading thread stats...</div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (stats()) {
        <pre class="stats-json">{{ stats() | json }}</pre>
      }

      <button class="refresh-btn" (click)="poll()" [disabled]="loading()">
        ↻ Refresh
      </button>
    </div>
  `,
  styles: [`
    .thread-stats {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .loading {
      color: #888;
      font-size: 0.85rem;
    }

    .error {
      color: #f87171;
      font-size: 0.85rem;
    }

    .stats-json {
      background: #111;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 12px;
      font-size: 0.78rem;
      color: #a5f3a0;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
    }

    .refresh-btn {
      align-self: flex-start;
      background: #2a2a2a;
      border: 1px solid #444;
      color: #ccc;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .refresh-btn:hover:not(:disabled) {
      background: #3a3a3a;
    }

    .refresh-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class ThreadStatsComponent extends PollingComponent {
  protected override pollingInterval = 5000;

  loading = signal(false);
  error = signal<string | null>(null);
  stats = signal<ThreadStats | null>(null);

  override async poll() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await fetch('/thread_stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.stats.set(await res.json());
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      this.loading.set(false);
    }
  }
}