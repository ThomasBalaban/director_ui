import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface ServiceStatus {
  id: string;
  label: string;
  port: number;
  managed: boolean;
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'unhealthy' | 'unknown';
}

// Shown when the launcher itself is unreachable
const FALLBACK_SERVICES: ServiceStatus[] = [
  { id: 'prompt_service', label: 'Prompt',   port: 8001, managed: true,  status: 'unknown' },
  { id: 'director',       label: 'Director', port: 8002, managed: false, status: 'unknown' },
  { id: 'nami',           label: 'Nami',     port: 8000, managed: false, status: 'unknown' },
];

@Component({
  selector: 'app-service-status-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a routerLink="/services" class="status-bar" title="Manage services">
      <!-- Launcher dot -->
      <div class="service-dot-group">
        <span
          class="dot"
          [class]="'dot-' + (launcherOnline() ? 'online' : 'offline')"
          title="Launcher (8003)"
        ></span>
        <span class="dot-label">Launcher</span>
      </div>

      <span class="divider">|</span>

      <!-- Per-service dots -->
      @for (svc of services(); track svc.id) {
        <div class="service-dot-group">
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
      border-radius: 8px;
      border: 1px solid #333;
      background: #1a1a1a;
      text-decoration: none;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }

    .status-bar:hover {
      border-color: #555;
      background: #222;
    }

    .service-dot-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .dot {
      position: relative;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Status colours */
    .dot-online    { background: #22c55e; box-shadow: 0 0 4px rgba(34,197,94,0.6); }
    .dot-offline   { background: #374151; }
    .dot-unhealthy { background: #f59e0b; box-shadow: 0 0 4px rgba(245,158,11,0.6); }
    .dot-unknown   { background: #4b5563; border: 1px dashed #6b7280; }
    .dot-starting,
    .dot-stopping  { background: #3b82f6; }

    /* Spinner ring for transitional states */
    .dot-spinner {
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: #93c5fd;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .dot-label {
      font-size: 0.6rem;
      color: #6b7280;
      white-space: nowrap;
      line-height: 1;
    }

    .divider {
      color: #333;
      font-size: 0.75rem;
      align-self: center;
    }

    .manage-hint {
      font-size: 0.7rem;
      color: #4b5563;
      margin-left: 2px;
      white-space: nowrap;
      transition: color 0.2s;
    }

    .status-bar:hover .manage-hint {
      color: #9ca3af;
    }
  `]
})
export class ServiceStatusBarComponent implements OnInit, OnDestroy {
  services   = signal<ServiceStatus[]>(FALLBACK_SERVICES);
  launcherOnline = signal(false);

  private interval?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.poll();
    this.interval = setInterval(() => this.poll(), 3000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async poll() {
    try {
      const res = await fetch('/launcher/services');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ServiceStatus[] = await res.json();
      this.services.set(data);
      this.launcherOnline.set(true);
    } catch {
      this.launcherOnline.set(false);
      this.services.set(FALLBACK_SERVICES);
    }
  }
}