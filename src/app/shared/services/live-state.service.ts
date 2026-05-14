import { Injectable, OnDestroy, signal, computed } from '@angular/core';

const POLL_INTERVAL_MS = 5_000;
const LIVE_STATE_URL = '/launcher/live_state';

interface LiveStatePayload {
  auto_live: boolean;
  auto_reachable: boolean;
  override: boolean;
  manual_live: boolean;
  effective_live: boolean;
  driven_service: string;
}

@Injectable({ providedIn: 'root' })
export class LiveStateService implements OnDestroy {
  private readonly _autoLive      = signal(false);
  private readonly _manualLive    = signal(false);
  private readonly _override      = signal(false);
  private readonly _autoReachable = signal(false);

  readonly override      = this._override.asReadonly();
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

  async toggleOverride(): Promise<void> {
    await this.patch({ override: !this._override() });
  }

  async toggleManualLive(): Promise<void> {
    if (this._override()) {
      await this.patch({ manual_live: !this._manualLive() });
    }
  }

  setAutoLive(v: boolean): void {
    this._autoLive.set(v);
  }

  private async poll(): Promise<void> {
    try {
      const res = await fetch(LIVE_STATE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.apply((await res.json()) as LiveStatePayload);
    } catch {
      this._autoReachable.set(false);
    }
  }

  private async patch(body: Partial<Pick<LiveStatePayload, 'override' | 'manual_live'>>): Promise<void> {
    try {
      const res = await fetch(LIVE_STATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.apply((await res.json()) as LiveStatePayload);
    } catch {
      this._autoReachable.set(false);
    }
  }

  private apply(p: LiveStatePayload): void {
    this._autoLive.set(p.auto_live);
    this._manualLive.set(p.manual_live);
    this._override.set(p.override);
    this._autoReachable.set(p.auto_reachable);
  }
}
