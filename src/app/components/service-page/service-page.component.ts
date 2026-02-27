import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PollingComponent } from '../../shared/polling.component';
import { ServiceDetail, AudioDevice, STATUS_META, GUI_SERVICES } from '../../shared/interfaces/services.interface';
import { LogPanelComponent } from './log-panel/log-panel.component';

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LogPanelComponent],
  template: `
    <div class="page">

      <!-- Header bar -->
      <div class="page-header">
        <div class="page-header-left">
          <a routerLink="/" class="back-btn">← Dashboard</a>
          <h1 class="page-title">Services</h1>
          <span class="launcher-badge" [class.online]="launcherOnline()">
            {{ launcherOnline() ? '● Launcher connected' : '○ Launcher offline' }}
          </span>
        </div>
        <div class="page-header-right">
          <button class="btn btn-start"
                  [disabled]="!launcherOnline() || bulkActionPending()"
                  (click)="startAll()">
            ▶ Start All
          </button>
          <button class="btn btn-stop"
                  [disabled]="!launcherOnline() || bulkActionPending()"
                  (click)="stopAll()">
            ■ Stop All
          </button>
          <span class="last-update">Updated {{ lastUpdated() }}</span>
          <button class="btn btn-ghost" (click)="poll()" [disabled]="loading()">
            <span [class.spinning]="loading()">↻</span> Refresh
          </button>
        </div>
      </div>

      <!-- Launcher offline warning -->
      @if (!launcherOnline()) {
        <div class="banner banner-warn">
          <span>⚠️</span>
          <div>
            <strong>Launcher not running.</strong>
            Start it with <code>npm start</code> in the <code>director_ui</code> folder.
          </div>
        </div>
      }

      <!-- Cards -->
      <div class="cards">
        @for (svc of services(); track svc.id) {
          <div class="card" [class]="'card-' + svc.status">

            <!-- Header -->
            <div class="card-header">
              <div class="card-header-left">
                <span class="status-icon" [style.color]="statusMeta(svc.status).color">
                  {{ statusMeta(svc.status).icon }}
                </span>
                <div>
                  <div class="card-title-row">
                    <span class="card-title">{{ svc.label }}</span>
                    @if (isGui(svc.id)) {
                      <span class="type-badge badge-gui" title="Opens a desktop GUI window">🖥 GUI App</span>
                    }
                    <span
                      class="type-badge"
                      [class.badge-http]="svc.health_check === 'http'"
                      [class.badge-tcp]="svc.health_check === 'tcp'"
                      [title]="svc.health_check === 'http' ? 'Health: HTTP /health endpoint' : 'Health: TCP port probe'"
                    >{{ svc.health_check === 'http' ? 'HTTP' : 'TCP' }}</span>
                  </div>
                  <div class="card-desc">{{ svc.description }}</div>
                </div>
              </div>

              <div class="card-header-right">
                <span class="port-badge">:{{ svc.port }}</span>
                @if (svc.pid) { <span class="pid-badge">PID {{ svc.pid }}</span> }
                <span
                  class="status-pill"
                  [style.background]="statusMeta(svc.status).color + '22'"
                  [style.color]="statusMeta(svc.status).color"
                  [style.border-color]="statusMeta(svc.status).color + '55'"
                >
                  @if (svc.status === 'starting' || svc.status === 'stopping') {
                    <span class="pill-spinner"></span>
                  }
                  {{ statusMeta(svc.status).label }}
                </span>
              </div>
            </div>

            <!-- TTS output device picker -->
            @if (svc.id === 'tts_service' && svc.status === 'online') {
              <div class="device-picker">
                <div class="device-picker-header">
                  <span class="device-picker-label">🔊 Output Device</span>
                  @if (ttsDeviceLoading()) { <span class="device-loading">Loading…</span> }
                </div>
                @if (ttsDevices().length) {
                  <div class="device-list">
                    @for (dev of ttsDevices(); track dev.id) {
                      <button
                        class="device-btn"
                        [class.device-active]="dev.id === ttsActiveDeviceId()"
                        (click)="selectTtsDevice(dev.id)"
                        [disabled]="ttsDeviceSetting()"
                        [title]="dev.name + ' — ' + dev.channels + 'ch @ ' + dev.default_samplerate + 'Hz'"
                      >
                        <span class="device-check">{{ dev.id === ttsActiveDeviceId() ? '✓' : '' }}</span>
                        <span class="device-name">{{ dev.name }}</span>
                        <span class="device-meta">{{ dev.default_samplerate / 1000 | number:'1.0-0' }}kHz</span>
                      </button>
                    }
                  </div>
                } @else if (!ttsDeviceLoading()) {
                  <div class="device-empty">No output devices found</div>
                }
              </div>
            }

            <!-- Microphone input device picker -->
            @if (svc.id === 'microphone_audio_service' && svc.status === 'online') {
              <div class="device-picker device-picker--input">
                <div class="device-picker-header">
                  <span class="device-picker-label">🎤 Mic Input Device</span>
                  @if (micDeviceLoading()) { <span class="device-loading">Loading…</span> }
                  @if (micSwapMessage()) { <span class="device-swap-msg">{{ micSwapMessage() }}</span> }
                </div>
                @if (micDevices().length) {
                  <div class="device-list">
                    @for (dev of micDevices(); track dev.id) {
                      <button
                        class="device-btn"
                        [class.device-active]="dev.id === micActiveDeviceId()"
                        (click)="selectMicDevice(dev.id)"
                        [disabled]="micDeviceSetting()"
                        [title]="dev.name + ' — ' + dev.channels + 'ch @ ' + dev.default_samplerate + 'Hz'"
                      >
                        <span class="device-check">{{ dev.id === micActiveDeviceId() ? '✓' : '' }}</span>
                        <span class="device-name">[{{ dev.id }}] {{ dev.name }}</span>
                        <span class="device-meta">{{ dev.default_samplerate / 1000 | number:'1.0-0' }}kHz · {{ dev.channels }}ch</span>
                      </button>
                    }
                  </div>
                } @else if (!micDeviceLoading()) {
                  <div class="device-empty">No input devices found</div>
                }
              </div>
            }

            <!-- Desktop audio input device picker -->
            @if (svc.id === 'stream_audio_service' && svc.status === 'online') {
              <div class="device-picker device-picker--input">
                <div class="device-picker-header">
                  <span class="device-picker-label">🖥️ Desktop Audio Input Device</span>
                  @if (streamDeviceLoading()) { <span class="device-loading">Loading…</span> }
                  @if (streamSwapMessage()) { <span class="device-swap-msg">{{ streamSwapMessage() }}</span> }
                </div>
                @if (streamDevices().length) {
                  <div class="device-list">
                    @for (dev of streamDevices(); track dev.id) {
                      <button
                        class="device-btn"
                        [class.device-active]="dev.id === streamActiveDeviceId()"
                        (click)="selectStreamDevice(dev.id)"
                        [disabled]="streamDeviceSetting()"
                        [title]="dev.name + ' — ' + dev.channels + 'ch @ ' + dev.default_samplerate + 'Hz'"
                      >
                        <span class="device-check">{{ dev.id === streamActiveDeviceId() ? '✓' : '' }}</span>
                        <span class="device-name">[{{ dev.id }}] {{ dev.name }}</span>
                        <span class="device-meta">{{ dev.default_samplerate / 1000 | number:'1.0-0' }}kHz · {{ dev.channels }}ch</span>
                      </button>
                    }
                  </div>
                } @else if (!streamDeviceLoading()) {
                  <div class="device-empty">No input devices found</div>
                }
              </div>
            }

            <!-- GUI notice -->
            @if (isGui(svc.id) && svc.managed) {
              <div class="gui-notice">
                <span>🖥</span>
                <span>This service opens a <strong>desktop window</strong> when started. Close the window to stop it, or use the Stop button below.</span>
              </div>
            }

            <!-- Controls (managed) -->
            @if (svc.managed) {
              <div class="card-controls">
                @if (svc.status === 'starting' || svc.status === 'stopping') {
                  <div class="pending-label">
                    <span class="inline-spinner"></span>
                    {{ svc.status === 'starting' ? 'Starting…' : 'Stopping…' }}
                  </div>
                } @else {
                  @if (svc.status === 'offline' || svc.status === 'unhealthy') {
                    <button class="btn btn-start" [disabled]="svc.actionPending || !launcherOnline()" (click)="serviceAction(svc, 'start')">
                      {{ svc.actionPending ? 'Starting...' : '▶ Start' }}
                    </button>
                  }
                  @if (svc.status === 'online' || svc.status === 'unhealthy') {
                    <button class="btn btn-stop" [disabled]="svc.actionPending || !launcherOnline()" (click)="serviceAction(svc, 'stop')">
                      {{ svc.actionPending ? 'Stopping...' : '■ Stop' }}
                    </button>
                  }
                  @if (svc.status === 'online') {
                    <button class="btn btn-restart" [disabled]="svc.actionPending || !launcherOnline()" (click)="serviceAction(svc, 'restart')">
                      {{ svc.actionPending ? 'Restarting...' : '↺ Restart' }}
                    </button>
                  }
                }

                <button
                  class="btn btn-vscode"
                  [disabled]="!svc.cwd"
                  (click)="openInVscode(svc)"
                  title="Open project folder in VS Code ({{ svc.cwd }})"
                >
                  <svg class="vscode-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <path d="M74.5 7.27L51.5 27.79 32.17 11.5 25 15.08v69.84l7.17 3.58L51.5 72.21 74.5 92.73 90 85.5V14.5L74.5 7.27zM74.5 74.08L54.07 50 74.5 25.92V74.08z"/>
                  </svg>
                  VS Code
                </button>

                <button class="btn btn-ghost log-toggle" (click)="toggleLogs(svc)">
                  {{ svc.logsOpen ? '▲ Hide logs' : '▼ Show logs' }}
                </button>
              </div>
            }

            <!-- Unmanaged footer -->
            @if (!svc.managed) {
              <div class="card-unmanaged">
                <span class="unmanaged-icon">ℹ</span>
                Monitored only — start this service manually from its own project.
                @if (svc.cwd) {
                  <button class="btn btn-vscode btn-vscode--sm" (click)="openInVscode(svc)" title="Open project folder in VS Code ({{ svc.cwd }})">
                    <svg class="vscode-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <path d="M74.5 7.27L51.5 27.79 32.17 11.5 25 15.08v69.84l7.17 3.58L51.5 72.21 74.5 92.73 90 85.5V14.5L74.5 7.27zM74.5 74.08L54.07 50 74.5 25.92V74.08z"/>
                    </svg>
                    VS Code
                  </button>
                }
              </div>
            }

            <!-- Log panel -->
            @if (svc.logsOpen) {
              <app-log-panel
                [title]="svc.label"
                [lines]="svc.logs ?? []"
                (refresh)="refreshLogs(svc)"
                (clear)="clearLogs(svc)"
              />
            }

          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page {
      height: 100vh;
      overflow-y: auto;
      background: var(--surface-1);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .page-header-left,
    .page-header-right { display: flex; align-items: center; gap: 1rem; }

    .back-btn {
      color: var(--text-dim);
      text-decoration: none;
      font-size: 0.875rem;
      transition: color var(--transition-fast);
      &:hover { color: white; }
    }

    .page-title { font-size: 1.5rem; font-weight: 700; color: white; margin: 0; }

    .launcher-badge {
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      background: rgba(75, 85, 99, 0.3);
      color: var(--text-dim);
      border: 1px solid var(--border-faint);
      &.online {
        background: rgba(34, 197, 94, 0.1);
        color: var(--accent-green-light);
        border-color: rgba(34, 197, 94, 0.3);
      }
    }

    .last-update { font-size: 0.75rem; color: var(--text-dimmer); }
    .spinning    { display: inline-block; animation: spin 0.6s linear infinite; }

    .banner {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin: 1.25rem 1.5rem 0;
      padding: 0.875rem 1rem;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      code { background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 4px; font-family: monospace; }
    }

    .banner-warn {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--accent-yellow-light);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
      gap: 1.25rem;
      padding: 1.25rem 1.5rem 2rem;
    }

    /* Input device picker accent (green instead of blue) */
    .device-picker--input {
      background: rgba(34, 197, 94, 0.05);
      border-bottom-color: rgba(34, 197, 94, 0.15);

      .device-picker-label { color: var(--accent-green-light); }

      .device-btn:hover:not(:disabled) {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.3);
      }

      .device-btn.device-active {
        background: rgba(34, 197, 94, 0.15);
        border-color: rgba(34, 197, 94, 0.4);
        color: var(--accent-green-light);
      }

      .device-check { color: var(--accent-green-light); }
    }

    .device-swap-msg {
      font-size: 0.7rem;
      color: var(--accent-green-light);
      font-style: italic;
      margin-left: auto;
    }
  `]
})
export class ServicesPageComponent extends PollingComponent {
  protected override pollingInterval = 4000;

  services          = signal<ServiceDetail[]>([]);
  launcherOnline    = signal(false);
  loading           = signal(false);
  lastUpdated       = signal('—');
  bulkActionPending = signal(false);

  // ── TTS (output) ──────────────────────────────────────────────────────────
  ttsDevices        = signal<AudioDevice[]>([]);
  ttsActiveDeviceId = signal<number | null>(null);
  ttsDeviceLoading  = signal(false);
  ttsDeviceSetting  = signal(false);

  // ── Mic (input) ───────────────────────────────────────────────────────────
  micDevices        = signal<AudioDevice[]>([]);
  micActiveDeviceId = signal<number | null>(null);
  micDeviceLoading  = signal(false);
  micDeviceSetting  = signal(false);
  micSwapMessage    = signal('');

  // ── Stream audio (input) ──────────────────────────────────────────────────
  streamDevices        = signal<AudioDevice[]>([]);
  streamActiveDeviceId = signal<number | null>(null);
  streamDeviceLoading  = signal(false);
  streamDeviceSetting  = signal(false);
  streamSwapMessage    = signal('');

  statusMeta(status: string) { return STATUS_META[status] ?? STATUS_META['unknown']; }
  isGui(id: string): boolean { return GUI_SERVICES.has(id); }

  openInVscode(svc: ServiceDetail): void {
    if (!svc.cwd) return;
    window.open(`vscode://file/${svc.cwd}`);
  }

  override async poll() {
    this.loading.set(true);
    try {
      const res = await fetch('/launcher/services');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const fresh: ServiceDetail[] = await res.json();
      this.launcherOnline.set(true);

      const current = this.services();
      this.services.set(fresh.map(s => {
        const existing = current.find(c => c.id === s.id);
        return { ...s, logs: existing?.logs ?? [], logsOpen: existing?.logsOpen ?? false, actionPending: false };
      }));

      this.lastUpdated.set(new Date().toLocaleTimeString());

      for (const svc of this.services()) {
        if (svc.logsOpen) this.refreshLogs(svc);
      }

      // Load device lists based on service status
      const tts    = this.services().find(s => s.id === 'tts_service');
      const mic    = this.services().find(s => s.id === 'microphone_audio_service');
      const stream = this.services().find(s => s.id === 'stream_audio_service');

      if (tts?.status === 'online') {
        await this.loadTtsDevices();
      } else {
        this.ttsDevices.set([]);
        this.ttsActiveDeviceId.set(null);
      }

      if (mic?.status === 'online') {
        await this.loadInputDevices('mic');
      } else {
        this.micDevices.set([]);
        this.micActiveDeviceId.set(null);
      }

      if (stream?.status === 'online') {
        await this.loadInputDevices('stream');
      } else {
        this.streamDevices.set([]);
        this.streamActiveDeviceId.set(null);
      }

    } catch {
      this.launcherOnline.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Device loaders ────────────────────────────────────────────────────────

  async loadTtsDevices() {
    this.ttsDeviceLoading.set(true);
    try {
      const res = await fetch('/tts/devices');
      if (!res.ok) return;
      const data = await res.json();
      this.ttsDevices.set(data.devices ?? []);
      this.ttsActiveDeviceId.set(data.active_device_id ?? null);
    } catch { /* silent */ }
    finally { this.ttsDeviceLoading.set(false); }
  }

  async loadInputDevices(target: 'mic' | 'stream') {
    const url = target === 'mic' ? '/mic-audio/devices' : '/stream-audio/devices';
    if (target === 'mic') this.micDeviceLoading.set(true);
    else this.streamDeviceLoading.set(true);

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      if (target === 'mic') {
        this.micDevices.set(data.devices ?? []);
        this.micActiveDeviceId.set(data.current_device_id ?? null);
      } else {
        this.streamDevices.set(data.devices ?? []);
        this.streamActiveDeviceId.set(data.current_device_id ?? null);
      }
    } catch { /* silent */ }
    finally {
      if (target === 'mic') this.micDeviceLoading.set(false);
      else this.streamDeviceLoading.set(false);
    }
  }

  // ── Device selectors ──────────────────────────────────────────────────────

  async selectTtsDevice(deviceId: number) {
    if (this.ttsDeviceSetting()) return;
    this.ttsDeviceSetting.set(true);
    try {
      const res = await fetch('/tts/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        this.ttsActiveDeviceId.set(deviceId);
        this.ttsDevices.update(devs => devs.map(d => ({ ...d, is_active: d.id === deviceId })));
      }
    } catch { /* silent */ }
    finally { this.ttsDeviceSetting.set(false); }
  }

  async selectMicDevice(deviceId: number) {
    if (this.micDeviceSetting()) return;
    this.micDeviceSetting.set(true);
    try {
      const res = await fetch('/mic-audio/set-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        this.micActiveDeviceId.set(deviceId);
        this.micSwapMessage.set('✓ Device applied');
        setTimeout(() => this.micSwapMessage.set(''), 3000);
      }
    } catch { /* silent */ }
    finally { this.micDeviceSetting.set(false); }
  }

  async selectStreamDevice(deviceId: number) {
    if (this.streamDeviceSetting()) return;
    this.streamDeviceSetting.set(true);
    try {
      const res = await fetch('/stream-audio/set-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        this.streamActiveDeviceId.set(deviceId);
        this.streamSwapMessage.set('✓ Device applied');
        setTimeout(() => this.streamSwapMessage.set(''), 3000);
      }
    } catch { /* silent */ }
    finally { this.streamDeviceSetting.set(false); }
  }

  // ── Service lifecycle ─────────────────────────────────────────────────────

  async serviceAction(svc: ServiceDetail, action: 'start' | 'stop' | 'restart') {
    this.setActionPending(svc.id, true);
    try {
      await fetch(`/launcher/services/${svc.id}/${action}`, { method: 'POST' });
      await this.poll();
      if (action !== 'stop') setTimeout(() => this.poll(), action === 'restart' ? 3000 : 2000);
      if (action === 'start') setTimeout(() => this.poll(), 5000);
    } finally {
      this.setActionPending(svc.id, false);
    }
  }

  async toggleLogs(svc: ServiceDetail) {
    this.services.update(svcs => svcs.map(s => s.id === svc.id ? { ...s, logsOpen: !s.logsOpen } : s));
    const updated = this.services().find(s => s.id === svc.id);
    if (updated?.logsOpen) await this.refreshLogs(svc);
  }

  async refreshLogs(svc: ServiceDetail) {
    try {
      const res = await fetch(`/launcher/services/${svc.id}/logs?last=150`);
      if (!res.ok) return;
      const data = await res.json();
      this.services.update(svcs => svcs.map(s => s.id === svc.id ? { ...s, logs: data.lines } : s));
    } catch { /* silent */ }
  }

  async clearLogs(svc: ServiceDetail) {
    try {
      await fetch(`/launcher/services/${svc.id}/logs`, { method: 'DELETE' });
      this.services.update(svcs => svcs.map(s => s.id === svc.id ? { ...s, logs: [] } : s));
    } catch { /* silent */ }
  }

  async startAll() {
    if (!this.launcherOnline() || this.bulkActionPending()) return;
    const toStart = this.services().filter(s => s.managed && (s.status === 'offline' || s.status === 'unhealthy'));
    if (!toStart.length) return;
    this.bulkActionPending.set(true);
    toStart.forEach(s => this.setActionPending(s.id, true));
    try {
      await Promise.all(toStart.map(svc => fetch(`/launcher/services/${svc.id}/start`, { method: 'POST' })));
      await this.poll();
      setTimeout(() => this.poll(), 5000);
    } finally {
      toStart.forEach(s => this.setActionPending(s.id, false));
      this.bulkActionPending.set(false);
    }
  }

  async stopAll() {
    if (!this.launcherOnline() || this.bulkActionPending()) return;
    const toStop = this.services().filter(s => s.managed && (s.status === 'online' || s.status === 'unhealthy' || s.status === 'starting'));
    if (!toStop.length) return;
    this.bulkActionPending.set(true);
    toStop.forEach(s => this.setActionPending(s.id, true));
    try {
      await Promise.all(toStop.map(svc => fetch(`/launcher/services/${svc.id}/stop`, { method: 'POST' })));
      await this.poll();
      setTimeout(() => this.poll(), 2000);
    } finally {
      toStop.forEach(s => this.setActionPending(s.id, false));
      this.bulkActionPending.set(false);
    }
  }

  private setActionPending(id: string, pending: boolean) {
    this.services.update(svcs => svcs.map(s => s.id === id ? { ...s, actionPending: pending } : s));
  }
}