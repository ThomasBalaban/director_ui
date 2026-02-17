import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

interface GateStatus {
  nami_speaking: boolean;
  awaiting_user_response: boolean;
  in_cooldown: boolean;
  total_interrupts: number;
  last_interrupt_time: number | null;
  seconds_since_interrupt: number | null;
  last_dispatch_time: number;
  speech_source: string | null;
  can_speak: boolean;
  block_reason: string | null;
}

type StatusMode = 'ready' | 'speaking' | 'cooldown' | 'blocked' | 'offline';

const INTERRUPTIBLE_REASONS = new Set(['nami_speaking']);
const BLOCK_REASON_LABELS: Record<string, string> = {
  nami_speaking:           'Speaking',
  post_speech_cooldown:    'Cooling down',
  min_interval:            'Min interval',
  post_response_cooldown:  'Post-response hold',
  already_reacted:         'Already reacted',
};

@Component({
  selector: 'app-nami-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="nami-status" [class]="'status-' + mode()">

      <!-- Animated pulse ring when speaking -->
      @if (mode() === 'speaking') {
        <span class="ring"></span>
      }

      <!-- Dot -->
      <span class="dot"></span>

      <!-- Label -->
      <span class="label">{{ statusLabel() }}</span>

      <!-- Interrupt badge -->
      @if (isInterruptible()) {
        <span class="badge interrupt">⚡ Interruptible</span>
      } @else if (!gateStatus()?.can_speak && mode() !== 'offline') {
        <span class="badge locked">🔒 Not interruptible</span>
      }

      <!-- Reason chip -->
      @if (blockReasonLabel()) {
        <span class="reason">{{ blockReasonLabel() }}</span>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; align-items: center; }

    .nami-status {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      border: 1.5px solid;
      font-size: 0.78rem;
      font-weight: 600;
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    /* ---- MODES ---- */
    .status-ready {
      border-color: #22c55e;
      background: rgba(34, 197, 94, 0.1);
      color: #4ade80;
    }
    .status-speaking {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
    }
    .status-cooldown {
      border-color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      color: #fbbf24;
    }
    .status-blocked {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
    }
    .status-offline {
      border-color: #4b5563;
      background: rgba(75, 85, 99, 0.1);
      color: #6b7280;
    }

    /* ---- DOT ---- */
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-ready    .dot { background: #22c55e; }
    .status-speaking .dot { background: #3b82f6; animation: blink 1s ease-in-out infinite; }
    .status-cooldown .dot { background: #f59e0b; }
    .status-blocked  .dot { background: #ef4444; }
    .status-offline  .dot { background: #6b7280; }

    /* ---- PULSE RING ---- */
    .ring {
      position: absolute;
      left: 7px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.4);
      animation: pulse-ring 1.2s ease-out infinite;
      pointer-events: none;
    }

    @keyframes pulse-ring {
      0%   { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }

    /* ---- BADGES ---- */
    .badge {
      padding: 1px 7px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .badge.interrupt {
      background: rgba(250, 204, 21, 0.2);
      color: #fde047;
      border: 1px solid rgba(250, 204, 21, 0.4);
    }
    .badge.locked {
      background: rgba(107, 114, 128, 0.2);
      color: #9ca3af;
      border: 1px solid #374151;
    }

    /* ---- REASON ---- */
    .reason {
      font-size: 0.7rem;
      font-weight: 400;
      opacity: 0.75;
    }
  `]
})
export class NamiStatusComponent implements OnInit, OnDestroy {
  gateStatus = signal<GateStatus | null>(null);
  offline = signal(false);

  private interval?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.poll();
    this.interval = setInterval(() => this.poll(), 1500);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  mode = computed<StatusMode>(() => {
    if (this.offline()) return 'offline';
    const s = this.gateStatus();
    if (!s) return 'offline';
    if (s.nami_speaking)    return 'speaking';
    if (s.in_cooldown)      return 'cooldown';
    if (!s.can_speak)       return 'blocked';
    return 'ready';
  });

  statusLabel = computed(() => {
    switch (this.mode()) {
      case 'ready':    return 'Nami Ready';
      case 'speaking': return 'Nami Speaking';
      case 'cooldown': return 'Nami Cooling';
      case 'blocked':  return 'Nami Blocked';
      case 'offline':  return 'Prompt Svc Offline';
    }
  });

  isInterruptible = computed(() => {
    const s = this.gateStatus();
    if (!s) return false;
    return !s.can_speak && INTERRUPTIBLE_REASONS.has(s.block_reason ?? '');
  });

  blockReasonLabel = computed(() => {
    const s = this.gateStatus();
    if (!s || s.can_speak) return null;
    const reason = s.block_reason ?? '';
    return INTERRUPTIBLE_REASONS.has(reason)
      ? null  // covered by the badge already
      : (BLOCK_REASON_LABELS[reason] ?? reason);
  });

  private async poll() {
    try {
      const res = await fetch('/gate_status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.gateStatus.set(await res.json());
      this.offline.set(false);
    } catch {
      this.offline.set(true);
    }
  }
}