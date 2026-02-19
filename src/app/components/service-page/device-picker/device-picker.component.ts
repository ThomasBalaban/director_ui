import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioDevice } from '../../../shared/interfaces/services.interface';

@Component({
  selector: 'app-device-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="device-picker">
      <div class="device-picker-header">
        <span class="device-picker-label">🔊 Output Device</span>
        @if (loading) { <span class="device-loading">Loading…</span> }
      </div>

      @if (devices.length) {
        <div class="device-list">
          @for (dev of devices; track dev.id) {
            <button
              class="device-btn"
              [class.device-active]="dev.id === activeDeviceId"
              [disabled]="setting"
              [title]="dev.name + ' — ' + dev.channels + 'ch @ ' + dev.default_samplerate + 'Hz'"
              (click)="selectDevice.emit(dev.id)"
            >
              <span class="device-check">{{ dev.id === activeDeviceId ? '✓' : '' }}</span>
              <span class="device-name">{{ dev.name }}</span>
              <span class="device-meta">{{ dev.default_samplerate / 1000 | number:'1.0-0' }}kHz</span>
            </button>
          }
        </div>
      } @else if (!loading) {
        <div class="device-empty">No output devices found</div>
      }
    </div>
  `,
  styles: [`
    .device-picker {
      padding: 0.75rem 1.25rem;
      background: rgba(59,130,246,0.05);
      border-bottom: 1px solid rgba(59,130,246,0.15);
    }

    .device-picker-header {
      display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;
    }

    .device-picker-label {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--accent-blue-light);
    }

    .device-loading { font-size: 0.7rem; color: var(--text-dimmer); font-style: italic; }

    .device-list {
      display: flex; flex-direction: column; gap: 3px; max-height: 200px; overflow-y: auto;
    }

    .device-btn {
      display: flex; align-items: center; gap: 8px; width: 100%;
      background: transparent; border: 1px solid transparent;
      border-radius: var(--radius-sm); padding: 5px 8px;
      cursor: pointer; text-align: left; color: var(--text-muted); font-size: 0.8rem;
      transition: background var(--transition-fast), border-color var(--transition-fast);

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

    .device-check { width: 14px; font-size: 0.75rem; color: var(--accent-blue-light); flex-shrink: 0; }
    .device-name  { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .device-meta  { font-size: 0.7rem; color: var(--text-dimmer); flex-shrink: 0; }
    .device-empty { font-size: 0.75rem; color: var(--text-dimmer); font-style: italic; padding: 4px 0; }
  `]
})
export class DevicePickerComponent {
  @Input() devices: AudioDevice[] = [];
  @Input() activeDeviceId: number | null = null;
  @Input() loading = false;
  @Input() setting = false;
  @Output() selectDevice = new EventEmitter<number>();
}