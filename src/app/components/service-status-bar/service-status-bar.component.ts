import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PollingComponent } from '../../shared/polling.component';
import { ServiceStatus } from '../../shared/interfaces/director.interfaces';

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
})
export class ServiceStatusBarComponent extends PollingComponent {
  protected override pollingInterval = 3000;

  services       = signal<ServiceStatus[]>(FALLBACK_SERVICES);
  launcherOnline = signal(false);

  override async poll() {
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