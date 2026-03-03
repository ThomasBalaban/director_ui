import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PollingComponent } from '../../shared/polling.component';

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
})
export class NamiStatusComponent extends PollingComponent {
  protected override pollingInterval = 1500;

  gateStatus = signal<GateStatus | null>(null);
  offline = signal(false);

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
      ? null
      : (BLOCK_REASON_LABELS[reason] ?? reason);
  });

  override async poll() {
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