import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ServiceStatus } from '../service-status-bar/service-status-bar.component';

interface ServiceDetail extends ServiceStatus {
  description: string;
  pid: number | null;
  health_check: string;   // 'http' | 'tcp'
  logs?: string[];
  logsOpen?: boolean;
  actionPending?: boolean;
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  online:    { label: 'Online',    color: '#22c55e', icon: '●' },
  offline:   { label: 'Offline',   color: '#4b5563', icon: '○' },
  starting:  { label: 'Starting',  color: '#3b82f6', icon: '◌' },
  stopping:  { label: 'Stopping',  color: '#f59e0b', icon: '◌' },
  unhealthy: { label: 'Unhealthy', color: '#ef4444', icon: '⚠' },
  unknown:   { label: 'Unknown',   color: '#6b7280', icon: '?' },
};

// Services that launch a visible GUI window
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
          <button class="refresh-btn" (click)="poll()" [disabled]="loading()">
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

            <!-- Card header -->
            <div class="card-header">
              <div class="card-header-left">
                <span class="status-icon" [style.color]="statusMeta(svc.status).color">
                  {{ statusMeta(svc.status).icon }}
                </span>
                <div>
                  <div class="card-title-row">
                    <span class="card-title">{{ svc.label }}</span>
                    <!-- GUI badge -->
                    @if (isGui(svc.id)) {
                      <span class="type-badge badge-gui" title="Opens a desktop GUI window">🖥 GUI App</span>
                    }
                    <!-- Health check method -->
                    <span
                      class="type-badge"
                      [class.badge-http]="svc.health_check === 'http'"
                      [class.badge-tcp]="svc.health_check === 'tcp'"
                      [title]="svc.health_check === 'http' ? 'Health: HTTP /health endpoint' : 'Health: TCP port probe'"
                    >
                      {{ svc.health_check === 'http' ? 'HTTP' : 'TCP' }}
                    </span>
                  </div>
                  <div class="card-desc">{{ svc.description }}</div>
                </div>
              </div>

              <div class="card-header-right">
                <span class="port-badge">:{{ svc.port }}</span>
                @if (svc.pid) {
                  <span class="pid-badge">PID {{ svc.pid }}</span>
                }
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

            <!-- GUI notice -->
            @if (isGui(svc.id) && svc.managed) {
              <div class="gui-notice">
                <span>🖥</span>
                <span>This service opens a <strong>desktop window</strong> when started. Close the window to stop it, or use the Stop button below.</span>
              </div>
            }

            <!-- Managed controls -->
            @if (svc.managed) {
              <div class="card-controls">
                @if (svc.status === 'starting' || svc.status === 'stopping') {
                  <div class="btn-placeholder">
                    <span class="inline-spinner"></span>
                    {{ svc.status === 'starting' ? 'Starting…' : 'Stopping…' }}
                  </div>
                } @else {
                  @if (svc.status === 'offline' || svc.status === 'unhealthy') {
                    <button
                      class="btn btn-start"
                      [disabled]="svc.actionPending || !launcherOnline()"
                      (click)="startService(svc)"
                    >
                      {{ svc.actionPending ? 'Starting...' : '▶ Start' }}
                    </button>
                  }
                  @if (svc.status === 'online' || svc.status === 'unhealthy') {
                    <button
                      class="btn btn-stop"
                      [disabled]="svc.actionPending || !launcherOnline()"
                      (click)="stopService(svc)"
                    >
                      {{ svc.actionPending ? 'Stopping...' : '■ Stop' }}
                    </button>
                  }
                  @if (svc.status === 'online') {
                    <button
                      class="btn btn-restart"
                      [disabled]="svc.actionPending || !launcherOnline()"
                      (click)="restartService(svc)"
                    >
                      {{ svc.actionPending ? 'Restarting...' : '↺ Restart' }}
                    </button>
                  }
                }

                <!-- Logs toggle (managed only — most useful for GUI apps) -->
                <button class="btn btn-logs" (click)="toggleLogs(svc)">
                  {{ svc.logsOpen ? '▲ Hide logs' : '▼ Show logs' }}
                </button>
              </div>
            }

            <!-- Unmanaged note -->
            @if (!svc.managed) {
              <div class="card-unmanaged">
                <span class="unmanaged-icon">ℹ</span>
                Monitored only — start this service manually from its own project.
              </div>
            }

            <!-- Log panel -->
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
                        [class.log-error]="isErrorLine(line)"
                        [class.log-ok]="isOkLine(line)"
                        [class.log-warn]="isWarnLine(line)"
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
    /* ── Page shell ─────────────────────────── */
    .page {
      height: 100vh;
      overflow-y: auto;
      background: #111;
      color: #e0e0e0;
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ─────────────────────────────── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: #1a1a1a;
      border-bottom: 1px solid #2a2a2a;
      flex-shrink: 0;
    }
    .page-header-left, .page-header-right {
      display: flex; align-items: center; gap: 1rem;
    }
    .back-btn {
      color: #6b7280; text-decoration: none; font-size: 0.875rem;
      transition: color 0.15s;
    }
    .back-btn:hover { color: white; }
    .page-title {
      font-size: 1.5rem; font-weight: 700; color: white; margin: 0;
    }
    .launcher-badge {
      font-size: 0.75rem; padding: 3px 10px; border-radius: 999px;
      background: rgba(75,85,99,0.3); color: #6b7280; border: 1px solid #333;
    }
    .launcher-badge.online {
      background: rgba(34,197,94,0.1); color: #4ade80;
      border-color: rgba(34,197,94,0.3);
    }
    .last-update { font-size: 0.75rem; color: #4b5563; }
    .refresh-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; background: #2a2a2a; border: 1px solid #444;
      color: #ccc; border-radius: 6px; cursor: pointer; font-size: 0.8rem;
      transition: background 0.15s;
    }
    .refresh-btn:hover:not(:disabled) { background: #333; }
    .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .spinning { display: inline-block; animation: spin 0.6s linear infinite; }

    /* ── Banner ──────────────────────────────── */
    .banner {
      display: flex; align-items: flex-start; gap: 0.75rem;
      margin: 1.25rem 1.5rem 0; padding: 0.875rem 1rem;
      border-radius: 8px; font-size: 0.875rem;
    }
    .banner-warn {
      background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);
      color: #fbbf24;
    }
    .banner code {
      background: rgba(0,0,0,0.3); padding: 1px 6px;
      border-radius: 4px; font-family: monospace;
    }

    /* ── Cards grid ──────────────────────────── */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
      gap: 1.25rem;
      padding: 1.25rem 1.5rem 2rem;
    }

    /* ── Card ───────────────────────────────── */
    .card {
      background: #1e1e1e; border: 1px solid #2a2a2a;
      border-radius: 12px; overflow: hidden;
      display: flex; flex-direction: column; transition: border-color 0.2s;
    }
    .card-online    { border-color: rgba(34,197,94,0.25); }
    .card-starting  { border-color: rgba(59,130,246,0.25); }
    .card-stopping  { border-color: rgba(245,158,11,0.25); }
    .card-unhealthy { border-color: rgba(239,68,68,0.25); }

    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 1.25rem; border-bottom: 1px solid #2a2a2a;
    }
    .card-header-left {
      display: flex; align-items: flex-start; gap: 12px;
    }
    .status-icon { font-size: 1.5rem; line-height: 1; width: 24px; text-align: center; }

    .card-title-row {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .card-title { font-weight: 700; font-size: 1rem; color: white; }
    .card-desc { font-size: 0.75rem; color: #6b7280; margin-top: 3px; }

    /* ── Type badges ─────────────────────────── */
    .type-badge {
      font-size: 0.65rem; font-weight: 700; padding: 2px 6px;
      border-radius: 4px; border: 1px solid; text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-gui  { background: rgba(139,92,246,0.15); color: #a78bfa; border-color: rgba(139,92,246,0.3); }
    .badge-http { background: rgba(34,197,94,0.1);   color: #4ade80; border-color: rgba(34,197,94,0.25); }
    .badge-tcp  { background: rgba(59,130,246,0.1);  color: #60a5fa; border-color: rgba(59,130,246,0.25); }

    /* ── GUI notice ──────────────────────────── */
    .gui-notice {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 0.5rem 1.25rem;
      background: rgba(139,92,246,0.07);
      border-bottom: 1px solid rgba(139,92,246,0.15);
      font-size: 0.75rem; color: #a78bfa; line-height: 1.5;
    }

    .card-header-right {
      display: flex; align-items: center; gap: 8px;
    }
    .port-badge {
      font-size: 0.75rem; font-family: monospace; color: #6b7280;
      background: #111; padding: 2px 7px; border-radius: 4px; border: 1px solid #333;
    }
    .pid-badge { font-size: 0.7rem; font-family: monospace; color: #4b5563; }

    .status-pill {
      display: flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 999px; border: 1px solid;
      font-size: 0.75rem; font-weight: 600;
    }
    .pill-spinner {
      width: 8px; height: 8px; border-radius: 50%;
      border: 1.5px solid transparent; border-top-color: currentColor;
      animation: spin 0.7s linear infinite; flex-shrink: 0;
    }

    /* ── Controls ────────────────────────────── */
    .card-controls {
      display: flex; align-items: center; gap: 8px;
      padding: 0.75rem 1.25rem; background: #161616;
    }
    .btn {
      padding: 6px 16px; border-radius: 6px; font-size: 0.8rem;
      font-weight: 600; border: 1px solid; cursor: pointer; transition: all 0.15s;
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-start   { background: rgba(34,197,94,0.15);  border-color: rgba(34,197,94,0.4);  color: #4ade80; }
    .btn-stop    { background: rgba(239,68,68,0.15);  border-color: rgba(239,68,68,0.4);  color: #f87171; }
    .btn-restart { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.35); color: #fbbf24; }
    .btn-logs    { background: transparent; border-color: #333; color: #6b7280; margin-left: auto; }

    .btn-start:hover:not(:disabled)   { background: rgba(34,197,94,0.25); }
    .btn-stop:hover:not(:disabled)    { background: rgba(239,68,68,0.25); }
    .btn-restart:hover:not(:disabled) { background: rgba(245,158,11,0.22); }
    .btn-logs:hover { border-color: #555; color: #9ca3af; }

    .btn-placeholder {
      display: flex; align-items: center; gap: 8px;
      color: #6b7280; font-size: 0.8rem;
    }
    .inline-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid #333; border-top-color: #6b7280;
      animation: spin 0.7s linear infinite; flex-shrink: 0;
    }

    /* ── Unmanaged ───────────────────────────── */
    .card-unmanaged {
      display: flex; align-items: center; gap: 8px;
      padding: 0.625rem 1.25rem; background: #161616;
      font-size: 0.75rem; color: #4b5563;
    }
    .unmanaged-icon {
      width: 16px; height: 16px; border-radius: 50%;
      background: #2a2a2a; display: flex; align-items: center;
      justify-content: center; font-size: 0.65rem; color: #6b7280;
    }

    /* ── Log panel ───────────────────────────── */
    .log-panel {
      display: flex; flex-direction: column; border-top: 1px solid #2a2a2a;
    }
    .log-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 1rem; background: #111;
    }
    .log-title {
      font-size: 0.7rem; text-transform: uppercase;
      letter-spacing: 0.08em; color: #4b5563; font-weight: 700;
    }
    .log-refresh {
      background: transparent; border: none; color: #4b5563;
      cursor: pointer; font-size: 0.75rem; transition: color 0.15s;
    }
    .log-refresh:hover { color: #9ca3af; }
    .log-body {
      padding: 0.75rem 1rem; font-family: 'Courier New', monospace;
      font-size: 0.72rem; line-height: 1.6; background: #0d0d0d;
      max-height: 300px; overflow-y: auto; color: #9ca3af;
    }
    .log-line  { padding: 1px 0; }
    .log-error { color: #f87171; }
    .log-warn  { color: #fbbf24; }
    .log-ok    { color: #4ade80; }
    .log-empty { color: #374151; font-style: italic; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ServicesPageComponent implements OnInit, OnDestroy {
  services       = signal<ServiceDetail[]>([]);
  launcherOnline = signal(false);
  loading        = signal(false);
  lastUpdated    = signal('—');

  private interval?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.poll();
    this.interval = setInterval(() => this.poll(), 4000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  statusMeta(status: string) {
    return STATUS_META[status] ?? STATUS_META['unknown'];
  }

  isGui(id: string): boolean {
    return GUI_SERVICES.has(id);
  }

  isErrorLine(line: string): boolean {
    return /error|failed|exception|traceback|fatal/i.test(line);
  }

  isWarnLine(line: string): boolean {
    return /warn|warning|⚠/i.test(line);
  }

  isOkLine(line: string): boolean {
    return /✅|healthy|ready|started|online|running/i.test(line);
  }

  async poll() {
    this.loading.set(true);
    try {
      const res = await fetch('/launcher/services');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const fresh: ServiceDetail[] = await res.json();
      this.launcherOnline.set(true);

      const current = this.services();
      const merged = fresh.map(s => {
        const existing = current.find(c => c.id === s.id);
        return {
          ...s,
          logs:          existing?.logs ?? [],
          logsOpen:      existing?.logsOpen ?? false,
          actionPending: false,
        };
      });

      this.services.set(merged);
      this.lastUpdated.set(new Date().toLocaleTimeString());

      // Refresh open log panels
      for (const svc of merged) {
        if (svc.logsOpen) this.refreshLogs(svc);
      }
    } catch {
      this.launcherOnline.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async startService(svc: ServiceDetail) {
    this.setActionPending(svc.id, true);
    try {
      await fetch(`/launcher/services/${svc.id}/start`, { method: 'POST' });
      // Poll more frequently while starting
      await this.poll();
      setTimeout(() => this.poll(), 2000);
      setTimeout(() => this.poll(), 5000);
    } finally {
      this.setActionPending(svc.id, false);
    }
  }

  async stopService(svc: ServiceDetail) {
    this.setActionPending(svc.id, true);
    try {
      await fetch(`/launcher/services/${svc.id}/stop`, { method: 'POST' });
      await this.poll();
    } finally {
      this.setActionPending(svc.id, false);
    }
  }

  async restartService(svc: ServiceDetail) {
    this.setActionPending(svc.id, true);
    try {
      await fetch(`/launcher/services/${svc.id}/restart`, { method: 'POST' });
      await this.poll();
      setTimeout(() => this.poll(), 3000);
    } finally {
      this.setActionPending(svc.id, false);
    }
  }

  async toggleLogs(svc: ServiceDetail) {
    this.services.update(svcs =>
      svcs.map(s => s.id === svc.id ? { ...s, logsOpen: !s.logsOpen } : s)
    );
    const updated = this.services().find(s => s.id === svc.id);
    if (updated?.logsOpen) await this.refreshLogs(svc);
  }

  async refreshLogs(svc: ServiceDetail) {
    try {
      const res = await fetch(`/launcher/services/${svc.id}/logs?last=150`);
      if (!res.ok) return;
      const data = await res.json();
      this.services.update(svcs =>
        svcs.map(s => s.id === svc.id ? { ...s, logs: data.lines } : s)
      );
    } catch { /* silent */ }
  }

  private setActionPending(id: string, pending: boolean) {
    this.services.update(svcs =>
      svcs.map(s => s.id === id ? { ...s, actionPending: pending } : s)
    );
  }
}