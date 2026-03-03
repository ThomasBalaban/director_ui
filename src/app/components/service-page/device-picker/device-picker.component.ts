import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioDevice } from '../../../shared/interfaces/services.interface';

@Component({
  selector: 'app-device-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="device-picker">
      <div class="device-picker-header" (click)="toggleExpanded()" style="cursor: pointer; user-select: none;">
        <span class="device-picker-label">
          {{ isExpanded ? '▼' : '▶' }} {{ label }}
        </span>
        @if (loading) { <span class="device-loading">Loading…</span> }
        @if (!isExpanded && activeDeviceName) { 
           <span class="device-meta" style="margin-left: auto;">{{ activeDeviceName }}</span> 
        }
      </div>

      @if (isExpanded) {
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
      }
    </div>
  `,
})
export class DevicePickerComponent {
  @Input() label = '🔊 Output Device';
  @Input() devices: AudioDevice[] = [];
  @Input() activeDeviceId: number | null = null;
  @Input() loading = false;
  @Input() setting = false;
  @Output() selectDevice = new EventEmitter<number>();

  isExpanded = false;

  get activeDeviceName(): string | null {
    if (this.activeDeviceId === null) return null;
    const device = this.devices.find(d => d.id === this.activeDeviceId);
    return device ? device.name : null;
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }
}