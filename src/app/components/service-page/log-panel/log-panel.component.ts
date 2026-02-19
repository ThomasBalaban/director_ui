import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-log-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="log-panel">
      <div class="log-toolbar">
        <span class="log-title">Stdout — {{ title }}</span>
        <button class="log-refresh" (click)="refresh.emit()">↻ Refresh</button>
      </div>
      <div class="log-body">
        @if (lines.length) {
          @for (line of lines; track $index) {
            <div
              class="log-line"
              [class.log-line--error]="isError(line)"
              [class.log-line--ok]="isOk(line)"
              [class.log-line--warn]="isWarn(line)"
            >{{ line }}</div>
          }
        } @else {
          <div class="log-empty">No output captured yet.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .log-panel { display: flex; flex-direction: column; border-top: 1px solid var(--border-dim); }

    .log-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 1rem; background: var(--surface-1);
    }

    .log-title {
      font-size: 0.7rem; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text-dimmer); font-weight: 700;
    }

    .log-refresh {
      background: transparent; border: none; color: var(--text-dimmer);
      cursor: pointer; font-size: 0.75rem; transition: color var(--transition-fast);
      &:hover { color: var(--text-muted); }
    }

    .log-body {
      padding: 0.75rem 1rem; font-family: 'Courier New', monospace;
      font-size: 0.72rem; line-height: 1.6; background: var(--surface-0);
      max-height: 300px; overflow-y: auto; color: var(--text-muted);
    }

    .log-empty { color: #374151; font-style: italic; }
  `]
})
export class LogPanelComponent {
  @Input() title = '';
  @Input() lines: string[] = [];
  @Output() refresh = new EventEmitter<void>();

  isError = (l: string) => /error|failed|exception|traceback|fatal/i.test(l);
  isWarn  = (l: string) => /warn|warning|⚠/i.test(l);
  isOk    = (l: string) => /✅|healthy|ready|started|online|running/i.test(l);
}