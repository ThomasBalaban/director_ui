import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveStateService } from '../../shared/services/live-state.service';

@Component({
  selector: 'app-live-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="live-indicator"
      [class.live]="live.isLive()"
      [class.manual]="live.override()"
      [title]="live.override()
        ? 'Manual override — click dot/label to toggle live'
        : 'Auto-detected — check box to override'"
    >
      <button
        type="button"
        class="live-toggle"
        [disabled]="!live.override()"
        (click)="live.toggleManualLive()"
      >
        <span class="live-dot"></span>
        <span class="live-label">{{ live.isLive() ? 'LIVE' : 'OFFLINE' }}</span>
      </button>
      <input
        type="checkbox"
        class="override-box"
        [checked]="live.override()"
        (change)="live.toggleOverride()"
        title="Override automatic live detection"
        aria-label="Override automatic live detection"
      >
    </div>
  `,
})
export class LiveIndicatorComponent {
  protected readonly live = inject(LiveStateService);
}
