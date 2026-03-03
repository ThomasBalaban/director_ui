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
        <button class="log-clear" (click)="clear.emit()">✕ Clear</button>
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
})
export class LogPanelComponent {
  @Input() title = '';
  @Input() lines: string[] = [];
  @Output() refresh = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  isError = (l: string) => /error|failed|exception|traceback|fatal/i.test(l);
  isWarn  = (l: string) => /warn|warning|⚠/i.test(l);
  isOk    = (l: string) => /✅|healthy|ready|started|online|running/i.test(l);
}