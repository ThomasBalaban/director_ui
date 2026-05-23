import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReplyModeService, ReplyMode } from '../../shared/services/reply-mode.service';

interface ModeMeta {
  label: string;
  icon: string;
  title: string;
  cls: string;
}

const MODE_META: Record<ReplyMode, ModeMeta> = {
  off: {
    label: 'FREE',
    icon: '💬',
    title: 'Reply mode OFF — Nami speaks freely. Click to require direct addresses.',
    cls: 'mode-off',
  },
  reply_only: {
    label: 'REPLY',
    icon: '🎯',
    title: 'Reply-only — Nami only responds when addressed by name. Click to also allow urgent events.',
    cls: 'mode-reply',
  },
  reply_plus_urgent: {
    label: 'REPLY+',
    icon: '⚡',
    title: 'Reply + urgent — direct addresses plus high-urgency interrupts. Click to turn off.',
    cls: 'mode-urgent',
  },
};

@Component({
  selector: 'app-reply-mode-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="pill reply-pill"
      [ngClass]="meta().cls"
      [title]="meta().title"
      (click)="svc.cycle()"
    >
      <span>{{ meta().icon }}</span>
      <span>{{ meta().label }}</span>
    </button>
  `,
  styles: [`
    .reply-pill {
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.05);
      color: #ddd;
      font-weight: 600;
      letter-spacing: 0.04em;
      transition: background-color 120ms, border-color 120ms, color 120ms;
    }
    .reply-pill:hover { background: rgba(255, 255, 255, 0.10); }
    .reply-pill.mode-off    { color: #9aa; }
    .reply-pill.mode-reply  { color: #ffd166; border-color: rgba(255, 209, 102, 0.5); background: rgba(255, 209, 102, 0.10); }
    .reply-pill.mode-urgent { color: #ff7e7e; border-color: rgba(255, 126, 126, 0.5); background: rgba(255, 126, 126, 0.12); }
  `],
})
export class ReplyModeToggleComponent {
  protected readonly svc = inject(ReplyModeService);
  protected readonly meta = computed(() => MODE_META[this.svc.mode()]);
}
