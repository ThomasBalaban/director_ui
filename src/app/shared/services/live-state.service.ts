import { Injectable, OnDestroy, signal, computed } from '@angular/core';

const POLL_INTERVAL_MS = 15_000;
const LIVE_STATUS_URL = '/twitch/live_status';

interface LiveStatusResponse {
  channel: string;
  is_live: boolean;
  changed_at: number | null;
  ready: boolean;
}

@Injectable({ providedIn: 'root' })
export class LiveStateService implements OnDestroy {
  private readonly _autoLive = signal(false);
  private readonly _manualLive = signal(false);
  private readonly _override = signal(false);
  private readonly _autoReachable = signal(false);

  readonly override = this._override.asReadonly();
  readonly autoReachable = this._autoReachable.asReadonly();
  readonly isLive = computed(() =>
    this._override() ? this._manualLive() : this._autoLive()
  );

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  toggleOverride(): void {
    this._override.update(v => !v);
  }

  toggleManualLive(): void {
    if (this._override()) {
      this._manualLive.update(v => !v);
    }
  }

  setAutoLive(v: boolean): void {
    this._autoLive.set(v);
  }

  private async poll(): Promise<void> {
    try {
      const res = await fetch(LIVE_STATUS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LiveStatusResponse;
      this._autoLive.set(!!data.is_live);
      this._autoReachable.set(!!data.ready);
    } catch {
      this._autoReachable.set(false);
    }
  }
}
