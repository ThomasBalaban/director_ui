import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PollingComponent } from '../../shared/polling.component';
import { ServiceStatus  } from '../../shared/interfaces/director.interfaces';

interface ServiceDetail extends ServiceStatus {
  description: string;
  pid: number | null;
  health_check: string;
  cwd?: string;
  logs?: string[];
  logsOpen?: boolean;
  actionPending?: boolean;
}

interface AudioDevice {
  id: number;
  name: string;
  channels: number;
  default_samplerate: number;
  is_active: boolean;
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  online:    { label: 'Online',    color: '#22c55e', icon: '●' },
  offline:   { label: 'Offline',   color: '#4b5563', icon: '○' },
  starting:  { label: 'Starting',  color: '#3b82f6', icon: '◌' },
  stopping:  { label: 'Stopping',  color: '#f59e0b', icon: '◌' },
  unhealthy: { label: 'Unhealthy', color: '#ef4444', icon: '⚠' },
  unknown:   { label: 'Unknown',   color: '#6b7280', icon: '?' },
};

const GUI_SERVICES = new Set(['desktop_monitor']);

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
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

            <!-- TTS Device Picker — shown when tts_service is online -->
            @if (svc.id === 'tts_service' && svc.status === 'online') {
              <div class="device-picker">
                <div class="device-picker-header">
                  <span class="device-picker-label">🔊 Output Device</span>
                  @if (deviceLoading()) {
                    <span class="device-loading">Loading…</span>
                  }
                </div>

                @if (audioDevices().length) {
                  <div class="device-list">
                    @for (dev of audioDevices(); track dev.id) {
                      <button
                        class="device-btn"
                        [class.device-active]="dev.id === activeDeviceId()"
                        (click)="selectDevice(dev.id)"
                        [disabled]="deviceSetting()"
                        [title]="dev.name + ' — ' + dev.channels + 'ch @ ' + dev.default_samplerate + 'Hz'"
                      >
                        <span class="device-check">{{ dev.id === activeDeviceId() ? '✓' : '' }}</span>
                        <span class="device-name">{{ dev.name }}</span>
                        <span class="device-meta">{{ dev.default_samplerate / 1000 | number:'1.0-0' }}kHz</span>
                      </button>
                    }
                  </div>
                } @else if (!deviceLoading()) {
                  <div class="device-empty">No output devices found</div>
                }
              </div>
            }

            @if (isGui(svc.id) && svc.managed) {
              <div class="gui-notice">
                <span>🖥</span>
                <span>This service opens a <strong>desktop window</strong> when started. Close the window to stop it, or use the Stop button below.</span>
              </div>
            }

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

                <!-- VS Code button -->
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

            @if (!svc.managed) {
              <div class="card-unmanaged">
                <span class="unmanaged-icon">ℹ</span>
                Monitored only — start this service manually from its own project.
                @if (svc.cwd) {
                  <button
                    class="btn btn-vscode btn-vscode--sm"
                    (click)="openInVscode(svc)"
                    title="Open project folder in VS Code ({{ svc.cwd }})"
                  >
                    <svg class="vscode-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <path d="M74.5 7.27L51.5 27.79 32.17 11.5 25 15.08v69.84l7.17 3.58L51.5 72.21 74.5 92.73 90 85.5V14.5L74.5 7.27zM74.5 74.08L54.07 50 74.5 25.92V74.08z"/>
                    </svg>
                    VS Code
                  </button>
                }
              </div>
            }

            @if (svc.logsOpen) {
              <div class="log-panel">
                <div class="log-toolbar">
                  <span class="log-title">Stdout — {{ svc.label }}</span>
                  <button class="log-refresh" (click)="refreshLogs(svc)">↻ Refresh</button>
                </div>
                <div class="log-body">
                  @if (svc.logs && svc.logs.length) {
                    @for (line of svc.logs; track $index) {
                      <div
                        class="log-line"
                        [class.log-line--error]="isErrorLine(line)"
                        [class.log-line--ok]="isOkLine(line)"
                        [class.log-line--warn]="isWarnLine(line)"
                      >{{ line }}</div>
                    }
                  } @else {
                    <div class="log-empty">No output captured yet.</div>
                  }
                </div>
              </div>
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

    .back-btn { color: var(--text-dim); text-decoration: none; font-size: 0.875rem; transition: color var(--transition-fast); &:hover { color: white; } }
    .page-title { font-size: 1.5rem; font-weight: 700; color: white; margin: 0; }

    .launcher-badge {
      font-size: 0.75rem; padding: 3px 10px; border-radius: var(--radius-full);
      background: rgba(75, 85, 99, 0.3); color: var(--text-dim); border: 1px solid var(--border-faint);
      &.online { background: rgba(34, 197, 94, 0.1); color: var(--accent-green-light); border-color: rgba(34, 197, 94, 0.3); }
    }

    .last-update { font-size: 0.75rem; color: var(--text-dimmer); }
    .spinning { display: inline-block; animation: spin 0.6s linear infinite; }

    .banner {
      display: flex; align-items: flex-start; gap: 0.75rem;
      margin: 1.25rem 1.5rem 0; padding: 0.875rem 1rem;
      border-radius: var(--radius-md); font-size: 0.875rem;
      code { background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 4px; font-family: monospace; }
    }
    .banner-warn {
      background: rgba(245,158,11,0.1);
      border: 1px solid rgba(245,158,11,0.3);
      color: var(--accent-yellow-light);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
      gap: 1.25rem;
      padding: 1.25rem 1.5rem 2rem;
    }

    .card {
      background: var(--surface-4); border: 1px solid var(--border);
      border-radius: var(--radius-lg); overflow: hidden;
      display: flex; flex-direction: column; transition: border-color var(--transition-normal);
    }
    .card-online    { border-color: rgba(34,197,94,0.4); }
    .card-starting  { border-color: rgba(59,130,246,0.4); }
    .card-stopping  { border-color: rgba(245,158,11,0.4); }
    .card-unhealthy { border-color: rgba(239,68,68,0.4); }

    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 1.25rem; border-bottom: 1px solid var(--border);
    }
    .card-header-left  { display: flex; align-items: flex-start; gap: 12px; }
    .card-header-right { display: flex; align-items: center; gap: 8px; }

    .status-icon { font-size: 1.5rem; line-height: 1; width: 24px; text-align: center; }
    .card-title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .card-title     { font-weight: 700; font-size: 1rem; color: white; }
    .card-desc      { font-size: 0.75rem; color: var(--text-dim); margin-top: 3px; }

    .type-badge {
      font-size: 0.65rem; font-weight: 700; padding: 2px 6px;
      border-radius: 4px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .badge-gui  { background: rgba(139,92,246,0.15); color: var(--accent-purple-light); border-color: rgba(139,92,246,0.3); }
    .badge-http { background: rgba(34,197,94,0.1); color: var(--accent-green-light); border-color: rgba(34,197,94,0.25); }
    .badge-tcp  { background: rgba(59,130,246,0.1); color: var(--accent-blue-light); border-color: rgba(59,130,246,0.25); }

    .port-badge {
      font-size: 0.75rem; font-family: monospace; color: var(--text-dim);
      background: var(--surface-1); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--border-faint);
    }
    .pid-badge { font-size: 0.7rem; font-family: monospace; color: var(--text-dimmer); }

    .status-pill {
      display: flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: var(--radius-full); border: 1px solid;
      font-size: 0.75rem; font-weight: 600;
    }
    .pill-spinner {
      width: 8px; height: 8px; border-radius: 50%;
      border: 1.5px solid transparent; border-top-color: currentColor;
      animation: spin 0.7s linear infinite; flex-shrink: 0;
    }

    /* ── Device Picker ── */
    .device-picker {
      padding: 0.75rem 1.25rem;
      background: rgba(59,130,246,0.05);
      border-bottom: 1px solid rgba(59,130,246,0.15);
    }

    .device-picker-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .device-picker-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent-blue-light);
    }

    .device-loading {
      font-size: 0.7rem;
      color: var(--text-dimmer);
      font-style: italic;
    }

    .device-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 200px;
      overflow-y: auto;
    }

    .device-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      padding: 5px 8px;
      cursor: pointer;
      text-align: left;
      transition: background var(--transition-fast), border-color var(--transition-fast);
      color: var(--text-muted);
      font-size: 0.8rem;

      &:hover:not(:disabled) {
        background: rgba(59,130,246,0.1);
        border-color: rgba(59,130,246,0.3);
        color: white;
      }

      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .device-btn.device-active {
      background: rgba(59,130,246,0.15);
      border-color: rgba(59,130,246,0.4);
      color: var(--accent-blue-light);
    }

    .device-check {
      width: 14px;
      font-size: 0.75rem;
      color: var(--accent-blue-light);
      flex-shrink: 0;
    }

    .device-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .device-meta {
      font-size: 0.7rem;
      color: var(--text-dimmer);
      flex-shrink: 0;
    }

    .device-empty {
      font-size: 0.75rem;
      color: var(--text-dimmer);
      font-style: italic;
      padding: 4px 0;
    }

    /* ── GUI notice ── */
    .gui-notice {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 0.5rem 1.25rem;
      background: rgba(139,92,246,0.07);
      border-bottom: 1px solid rgba(139,92,246,0.15);
      font-size: 0.75rem; color: var(--accent-purple-light); line-height: 1.5;
    }

    .card-controls {
      display: flex; align-items: center; gap: 8px;
      padding: 0.75rem 1.25rem; background: #161616;
    }
    .log-toggle { margin-left: auto; }

    .pending-label {
      display: flex; align-items: center; gap: 8px;
      color: var(--text-dim); font-size: 0.8rem;
    }
    .inline-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid var(--border-faint); border-top-color: var(--text-dim);
      animation: spin 0.7s linear infinite; flex-shrink: 0;
    }

    .card-unmanaged {
      display: flex; align-items: center; gap: 8px;
      padding: 0.625rem 1.25rem; background: #161616;
      font-size: 0.75rem; color: var(--text-dimmer);
    }
    .unmanaged-icon {
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--surface-4); display: flex; align-items: center;
      justify-content: center; font-size: 0.65rem; color: var(--text-dim);
    }

    /* ── VS Code button ── */
    .btn-vscode {
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(0, 122, 204, 0.12);
      border-color: rgba(0, 122, 204, 0.35);
      color: #4fc3f7;

      &:hover:not(:disabled) {
        background: rgba(0, 122, 204, 0.22);
        border-color: rgba(0, 122, 204, 0.6);
        color: #81d4fa;
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }

    .btn-vscode--sm {
      padding: 3px 10px;
      font-size: 0.72rem;
      margin-left: auto;
    }

    .vscode-logo {
      width: 13px;
      height: 13px;
      fill: currentColor;
      flex-shrink: 0;
    }

    .log-panel { display: flex; flex-direction: column; border-top: 1px solid var(--border-dim); }
    .log-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 1rem; background: var(--surface-1);
    }
    .log-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dimmer); font-weight: 700; }
    .log-refresh {
      background: transparent; border: none; color: var(--text-dimmer);
      cursor: pointer; font-size: 0.75rem; transition: color var(--transition-fast);
      &:hover { color: var(--text-muted); }
    }
    .log-body {
      padding: 0.75rem 1rem;
      font-family: 'Courier New', monospace;
      font-size: 0.72rem; line-height: 1.6;
      background: var(--surface-0); max-height: 300px; overflow-y: auto; color: var(--text-muted);
    }
    .log-empty { color: #374151; font-style: italic; }
  `]
})
export class ServicesPageComponent extends PollingComponent {
  protected override pollingInterval = 4000;

  services       = signal<ServiceDetail[]>([]);
  launcherOnline = signal(false);
  loading        = signal(false);
  lastUpdated    = signal('—');

  // TTS device state
  audioDevices   = signal<AudioDevice[]>([]);
  activeDeviceId = signal<number | null>(null);
  deviceLoading  = signal(false);
  deviceSetting  = signal(false);

  statusMeta(status: string) { return STATUS_META[status] ?? STATUS_META['unknown']; }
  isGui(id: string): boolean { return GUI_SERVICES.has(id); }

  isErrorLine(line: string): boolean { return /error|failed|exception|traceback|fatal/i.test(line); }
  isWarnLine(line: string):  boolean { return /warn|warning|⚠/i.test(line); }
  isOkLine(line: string):    boolean { return /✅|healthy|ready|started|online|running/i.test(line); }

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

      // Refresh device list whenever TTS service is online
      const tts = this.services().find(s => s.id === 'tts_service');
      if (tts?.status === 'online') {
        await this.loadDevices();
      } else {
        this.audioDevices.set([]);
        this.activeDeviceId.set(null);
      }
    } catch {
      this.launcherOnline.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDevices() {
    this.deviceLoading.set(true);
    try {
      const res = await fetch('/tts/devices');
      if (!res.ok) return;
      const data = await res.json();
      this.audioDevices.set(data.devices ?? []);
      this.activeDeviceId.set(data.active_device_id ?? null);
    } catch { /* TTS service may not be ready */ }
    finally { this.deviceLoading.set(false); }
  }

  async selectDevice(deviceId: number) {
    if (this.deviceSetting()) return;
    this.deviceSetting.set(true);
    try {
      const res = await fetch('/tts/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        this.activeDeviceId.set(deviceId);
        this.audioDevices.update(devs =>
          devs.map(d => ({ ...d, is_active: d.id === deviceId }))
        );
      }
    } catch { /* silent */ }
    finally { this.deviceSetting.set(false); }
  }

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

  private setActionPending(id: string, pending: boolean) {
    this.services.update(svcs => svcs.map(s => s.id === id ? { ...s, actionPending: pending } : s));
  }
}