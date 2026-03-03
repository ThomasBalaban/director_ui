import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface AudioDevice {
  id: number;
  name: string;
  channels: number;
  default_sample_rate: number;
}

interface DeviceResponse {
  devices: AudioDevice[];
  current_device_id: number;
}

@Component({
  selector: 'app-audio-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="audio-settings-panel">
      <div class="panel-header">
        <span class="panel-title">🎛️ Audio Devices</span>
        <button class="refresh-btn" (click)="loadAll()" title="Refresh device lists">↻</button>
      </div>

      <div class="device-row">
        <label class="device-label">🎤 Mic Input</label>
        <div class="select-wrap">
          <select
            class="device-select"
            [(ngModel)]="selectedMicDevice"
            (change)="setDevice('mic')"
            [disabled]="micLoading">
            <option *ngIf="micLoading" [value]="null">Loading…</option>
            <option *ngIf="micError" [value]="null">⚠️ Service offline</option>
            <option *ngFor="let d of micDevices" [value]="d.id">
              [{{ d.id }}] {{ d.name }}
            </option>
          </select>
          <span class="status-dot" [class.dot-ok]="micOk" [class.dot-err]="!micOk"></span>
        </div>
      </div>

      <div class="device-row">
        <label class="device-label">🖥️ Desktop Audio</label>
        <div class="select-wrap">
          <select
            class="device-select"
            [(ngModel)]="selectedStreamDevice"
            (change)="setDevice('stream')"
            [disabled]="streamLoading">
            <option *ngIf="streamLoading" [value]="null">Loading…</option>
            <option *ngIf="streamError" [value]="null">⚠️ Service offline</option>
            <option *ngFor="let d of streamDevices" [value]="d.id">
              [{{ d.id }}] {{ d.name }}
            </option>
          </select>
          <span class="status-dot" [class.dot-ok]="streamOk" [class.dot-err]="!streamOk"></span>
        </div>
      </div>

      <div class="swap-status" *ngIf="swapMessage">{{ swapMessage }}</div>
    </div>
  `,
})
export class AudioSettingsPanelComponent implements OnInit {
  private MIC_URL    = 'http://localhost:8014';
  private STREAM_URL = 'http://localhost:8018';

  micDevices: AudioDevice[]    = [];
  streamDevices: AudioDevice[] = [];
  selectedMicDevice: number | null    = null;
  selectedStreamDevice: number | null = null;

  micLoading    = true;
  streamLoading = true;
  micError      = false;
  streamError   = false;
  micOk         = false;
  streamOk      = false;
  swapMessage   = '';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loadDevices('mic');
    this.loadDevices('stream');
  }

  loadDevices(target: 'mic' | 'stream') {
    const url = target === 'mic' ? this.MIC_URL : this.STREAM_URL;
    if (target === 'mic') { this.micLoading = true; this.micError = false; }
    else                  { this.streamLoading = true; this.streamError = false; }

    this.http.get<DeviceResponse>(`${url}/devices`).subscribe({
      next: (res) => {
        if (target === 'mic') {
          this.micDevices        = res.devices;
          this.selectedMicDevice = res.current_device_id;
          this.micLoading        = false;
          this.micOk             = true;
        } else {
          this.streamDevices        = res.devices;
          this.selectedStreamDevice = res.current_device_id;
          this.streamLoading        = false;
          this.streamOk             = true;
        }
      },
      error: () => {
        if (target === 'mic') { this.micLoading = false; this.micError = true; this.micOk = false; }
        else { this.streamLoading = false; this.streamError = true; this.streamOk = false; }
      }
    });
  }

  setDevice(target: 'mic' | 'stream') {
    const url      = target === 'mic' ? this.MIC_URL : this.STREAM_URL;
    const deviceId = target === 'mic' ? this.selectedMicDevice : this.selectedStreamDevice;
    if (deviceId === null) return;

    this.http.post(`${url}/set-device`, { device_id: deviceId }).subscribe({
      next: () => {
        const label = target === 'mic' ? '🎤 Mic' : '🖥️ Desktop';
        this.swapMessage = `${label} → device ${deviceId} applied`;
        setTimeout(() => this.swapMessage = '', 3000);
      },
      error: () => {
        this.swapMessage = '⚠️ Failed to set device';
        setTimeout(() => this.swapMessage = '', 3000);
      }
    });
  }
}