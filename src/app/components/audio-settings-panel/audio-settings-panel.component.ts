import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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
            <option
              *ngFor="let d of micDevices"
              [value]="d.id">
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
            <option
              *ngFor="let d of streamDevices"
              [value]="d.id">
              [{{ d.id }}] {{ d.name }}
            </option>
          </select>
          <span class="status-dot" [class.dot-ok]="streamOk" [class.dot-err]="!streamOk"></span>
        </div>
      </div>

      <div class="swap-status" *ngIf="swapMessage">{{ swapMessage }}</div>
    </div>
  `,
  styles: [`
    .audio-settings-panel {
      background: #1a1a2e;
      border: 1px solid #2d2d4e;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 10px;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .panel-title {
      font-size: 13px;
      font-weight: 600;
      color: #a0a0c0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .refresh-btn {
      background: none;
      border: 1px solid #3d3d6e;
      border-radius: 4px;
      color: #a0a0c0;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 7px;
    }
    .refresh-btn:hover { background: #2d2d4e; }
    .device-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .device-label {
      font-size: 12px;
      color: #8888aa;
      min-width: 105px;
      white-space: nowrap;
    }
    .select-wrap {
      display: flex;
      align-items: center;
      flex: 1;
      gap: 6px;
    }
    .device-select {
      flex: 1;
      background: #12122a;
      border: 1px solid #3d3d6e;
      border-radius: 5px;
      color: #d0d0f0;
      font-size: 12px;
      padding: 5px 8px;
      cursor: pointer;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .device-select:disabled { opacity: 0.5; cursor: default; }
    .device-select:focus { outline: none; border-color: #6060cc; }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-ok  { background: #44dd88; }
    .dot-err { background: #dd4444; }
    .swap-status {
      font-size: 11px;
      color: #88cc88;
      margin-top: 4px;
      text-align: right;
    }
  `]
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

  ngOnInit() {
    this.loadAll();
  }

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
          this.micDevices          = res.devices;
          this.selectedMicDevice   = res.current_device_id;
          this.micLoading          = false;
          this.micOk               = true;
        } else {
          this.streamDevices          = res.devices;
          this.selectedStreamDevice   = res.current_device_id;
          this.streamLoading          = false;
          this.streamOk               = true;
        }
      },
      error: (err) => {
        if (target === 'mic') { this.micLoading = false; this.micError = true; this.micOk = false; }
        else { this.streamLoading = false; this.streamError = true; this.streamOk = false; }
        console.error(`[AudioSettings] Failed to load ${target} devices`, err);
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
      error: (err) => {
        this.swapMessage = `⚠️ Failed to set device`;
        console.error(`[AudioSettings] set-device failed`, err);
        setTimeout(() => this.swapMessage = '', 3000);
      }
    });
  }
}