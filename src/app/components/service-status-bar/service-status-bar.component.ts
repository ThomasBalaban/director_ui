import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ServiceStatus } from '../../shared/interfaces/director.interfaces';

// Shown when the launcher itself is unreachable
const FALLBACK_SERVICES: ServiceStatus[] = [
  { id: 'prompt_service',  label: 'Prompt',   port: 8001, managed: true,  status: 'unknown' },
  { id: 'desktop_monitor', label: 'Desktop',  port: 8003, managed: true,  status: 'unknown' },
  { id: 'director',        label: 'Director', port: 8002, managed: false, status: 'unknown' },
  { id: 'nami',            label: 'Nami',     port: 8000, managed: false, status: 'unknown' },
];

@Component({
  selector: 'app-service-status-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a routerLink="/services" class="status-bar" title="Manage services">
      <div class="dot-group">
        <span
          class="dot"
          [class]="'dot-' + (launcherOnline() ? 'online' : 'offline')"
          title="Launcher (8010)"
        ></span>
        <span class="dot-label">Launcher</span>
      </div>

      <span class="divider">|</span>

      @for (svc of services(); track svc.id) {
        <div class="dot-group">
          <span
            class="dot"
            [class]="'dot-' + svc.status"
            [title]="svc.label + ' (' + svc.status + ') :' + svc.port"
          >
            @if (svc.status === 'starting' || svc.status === 'stopping') {
              <span class="dot-spinner"></span>
            }
          </span>
          <span class="dot-label">{{ svc.label }}</span>
        </div>
      }

      <span class="manage-hint">⚙ Manage</span>
    </a>
  `,
  styles: [`
    .status-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-faint);
      background: var(--surface-2);
      text-decoration: none;
      cursor: pointer;
      transition: border-color var(--transition-fast), background var(--transition-fast);

      &:hover {
        border-color: #555;
        background: #222;
      }
    }

    .dot-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .dot {
      position: relative;
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dot-online    { background: var(--accent-green); box-shadow: 0 0 4px rgba(34, 197, 94, 0.6); }
    .dot-offline   { background: #374151; }
    .dot-unhealthy { background: var(--accent-yellow); box-shadow: 0 0 4px rgba(245, 158, 11, 0.6); }
    .dot-unknown   { background: var(--text-dimmer); border: 1px dashed var(--text-dim); }
    .dot-starting,
    .dot-stopping  { background: var(--accent-blue); }

    .dot-spinner {
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: #93c5fd;
      animation: spin 0.8s linear infinite;
    }

    .dot-label {
      font-size: 0.6rem;
      color: var(--text-dim);
      white-space: nowrap;
      line-height: 1;
    }

    .divider { color: var(--border-faint); font-size: 0.75rem; align-self: center; }

    .manage-hint {
      font-size: 0.7rem;
      color: var(--text-dimmer);
      margin-left: 2px;
      white-space: nowrap;
      transition: color var(--transition-fast);
    }

    .status-bar:hover .manage-hint { color: var(--text-muted); }
  `]
})
export class ServiceStatusBarComponent implements OnInit, OnDestroy {
  services       = signal<ServiceStatus[]>(FALLBACK_SERVICES);
  launcherOnline = signal(false);

  private interval?: ReturnType<typeof setInterval>;

  ngOnInit()  { this.poll(); this.interval = setInterval(() => this.poll(), 3000); }
  ngOnDestroy() { if (this.interval) clearInterval(this.interval); }

  private async poll() {
    try {
      const res = await fetch('/launcher/services');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.services.set(await res.json());
      this.launcherOnline.set(true);
    } catch {
      this.launcherOnline.set(false);
      this.services.set(FALLBACK_SERVICES);
    }
  }
}