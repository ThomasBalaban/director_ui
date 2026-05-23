import { Injectable, OnDestroy, signal } from '@angular/core';

const POLL_INTERVAL_MS = 10_000;
const REPLY_MODE_URL = '/launcher/reply_mode';

export type ReplyMode = 'off' | 'reply_only' | 'reply_plus_urgent';

interface ReplyModePayload {
  mode: ReplyMode;
}

@Injectable({ providedIn: 'root' })
export class ReplyModeService implements OnDestroy {
  private readonly _mode = signal<ReplyMode>('off');
  readonly mode = this._mode.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async setMode(mode: ReplyMode): Promise<void> {
    // Optimistic — the toggle should feel instant on stream.
    this._mode.set(mode);
    try {
      const res = await fetch(REPLY_MODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as ReplyModePayload;
      if (payload.mode) this._mode.set(payload.mode);
    } catch {
      // Re-sync from server on failure
      this.poll();
    }
  }

  cycle(): Promise<void> {
    const order: ReplyMode[] = ['off', 'reply_only', 'reply_plus_urgent'];
    const next = order[(order.indexOf(this._mode()) + 1) % order.length];
    return this.setMode(next);
  }

  private async poll(): Promise<void> {
    try {
      const res = await fetch(REPLY_MODE_URL);
      if (!res.ok) return;
      const payload = (await res.json()) as ReplyModePayload;
      if (payload.mode) this._mode.set(payload.mode);
    } catch {
      /* leave last value */
    }
  }
}
