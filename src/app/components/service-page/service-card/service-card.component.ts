import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceDetail, AudioDevice, STATUS_META, GUI_SERVICES } from '../../../shared/interfaces/services.interface';
import { DevicePickerComponent } from '../device-picker/device-picker.component';
import { LogPanelComponent } from '../log-panel/log-panel.component';

@Component({
  selector: 'app-service-card',
  standalone: true,
  imports: [CommonModule, DevicePickerComponent, LogPanelComponent],
  template: `
    <div class="card" [class]="'card-' + svc.status">

      <!-- Header -->
      <div class="card-header">
        <div class="card-header-left">
          <span class="status-icon" [style.color]="meta.color">{{ meta.icon }}</span>
          <div>
            <div class="card-title-row">
              <span class="card-title">{{ svc.label }}</span>
              @if (isGui) {
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
            [style.background]="meta.color + '22'"
            [style.color]="meta.color"
            [style.border-color]="meta.color + '55'"
          >
            @if (svc.status === 'starting' || svc.status === 'stopping') {
              <span class="pill-spinner"></span>
            }
            {{ meta.label }}
          </span>
        </div>
      </div>

      <!-- TTS device picker -->
      @if (svc.id === 'tts_service' && svc.status === 'online') {
        <app-device-picker
          [devices]="audioDevices"
          [activeDeviceId]="activeDeviceId"
          [loading]="deviceLoading"
          [setting]="deviceSetting"
          (selectDevice)="selectDevice.emit($event)"
        />
      }

      <!-- GUI notice -->
      @if (isGui && svc.managed) {
        <div class="gui-notice">
          <span>🖥</span>
          <span>This service opens a <strong>desktop window</strong> when started. Close the window to stop it, or use the Stop button below.</span>
        </div>
      }

      <!-- Controls (managed services) -->
      @if (svc.managed) {
        <div class="card-controls">
          @if (svc.status === 'starting' || svc.status === 'stopping') {
            <div class="pending-label">
              <span class="inline-spinner"></span>
              {{ svc.status === 'starting' ? 'Starting…' : 'Stopping…' }}
            </div>
          } @else {
            @if (svc.status === 'offline' || svc.status === 'unhealthy') {
              <button class="btn btn-start" [disabled]="svc.actionPending || !launcherOnline" (click)="action.emit('start')">
                {{ svc.actionPending ? 'Starting...' : '▶ Start' }}
              </button>
            }
            @if (svc.status === 'online' || svc.status === 'unhealthy') {
              <button class="btn btn-stop" [disabled]="svc.actionPending || !launcherOnline" (click)="action.emit('stop')">
                {{ svc.actionPending ? 'Stopping...' : '■ Stop' }}
              </button>
            }
            @if (svc.status === 'online') {
              <button class="btn btn-restart" [disabled]="svc.actionPending || !launcherOnline" (click)="action.emit('restart')">
                {{ svc.actionPending ? 'Restarting...' : '↺ Restart' }}
              </button>
            }
          }

          <button
            class="btn btn-vscode"
            [disabled]="!svc.cwd"
            [title]="'Open in VS Code: ' + (svc.cwd ?? '')"
            (click)="openVscode()"
          >
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="vscode-logo">
              <path d="M74.5 7.27L51.5 27.79 32.17 11.5 25 15.08v69.84l7.17 3.58L51.5 72.21 74.5 92.73 90 85.5V14.5L74.5 7.27zM74.5 74.08L54.07 50 74.5 25.92V74.08z"/>
            </svg>
            VS Code
          </button>

          <button class="btn btn-ghost log-toggle" (click)="toggleLogs.emit()">
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
            <button class="btn btn-vscode btn-vscode--sm" [title]="'Open in VS Code: ' + svc.cwd" (click)="openVscode()">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="vscode-logo">
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
          (refresh)="refreshLogs.emit()"
        />
      }

    </div>
  `,
  styles: [`
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
    .badge-http { background: rgba(34,197,94,0.1);   color: var(--accent-green-light);  border-color: rgba(34,197,94,0.25); }
    .badge-tcp  { background: rgba(59,130,246,0.1);  color: var(--accent-blue-light);   border-color: rgba(59,130,246,0.25); }

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

    .btn-vscode {
      display: flex; align-items: center; gap: 5px;
      background: rgba(0,122,204,0.12); border-color: rgba(0,122,204,0.35); color: #4fc3f7;
      &:hover:not(:disabled) { background: rgba(0,122,204,0.22); border-color: rgba(0,122,204,0.6); color: #81d4fa; }
      &:disabled { opacity: 0.35; cursor: not-allowed; }
    }
    .btn-vscode--sm { padding: 3px 10px; font-size: 0.72rem; margin-left: auto; }

    .vscode-logo { width: 13px; height: 13px; fill: currentColor; flex-shrink: 0; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ServiceCardComponent {
  @Input({ required: true }) svc!: ServiceDetail;
  @Input() launcherOnline = false;
  @Input() audioDevices: AudioDevice[] = [];
  @Input() activeDeviceId: number | null = null;
  @Input() deviceLoading = false;
  @Input() deviceSetting = false;

  @Output() action      = new EventEmitter<'start' | 'stop' | 'restart'>();
  @Output() toggleLogs  = new EventEmitter<void>();
  @Output() refreshLogs = new EventEmitter<void>();
  @Output() selectDevice = new EventEmitter<number>();

  get meta() { return STATUS_META[this.svc.status] ?? STATUS_META['unknown']; }
  get isGui() { return GUI_SERVICES.has(this.svc.id); }

  openVscode(): void {
    if (this.svc.cwd) window.open(`vscode://file/${this.svc.cwd}`);
  }
}