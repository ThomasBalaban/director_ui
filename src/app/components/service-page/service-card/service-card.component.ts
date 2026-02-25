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
  styles: []
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