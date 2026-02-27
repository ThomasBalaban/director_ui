import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PollingComponent } from '../../shared/polling.component';
import { ServiceDetail, AudioDevice, STATUS_META, GUI_SERVICES } from '../../shared/interfaces/services.interface';
import { LogPanelComponent } from './log-panel/log-panel.component';

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LogPanelComponent],
  templateUrl: './service-page.component.html',
  styleUrl: './service-page.component.scss',
})
export class ServicesPageComponent extends PollingComponent {
  protected override pollingInterval = 4000;

  services          = signal<ServiceDetail[]>([]);
  launcherOnline    = signal(false);
  loading           = signal(false);
  lastUpdated       = signal('—');
  bulkActionPending = signal(false);

  // ── TTS (output) ──────────────────────────────────────────────────────────
  ttsDevices        = signal<AudioDevice[]>([]);
  ttsActiveDeviceId = signal<number | null>(null);
  ttsDeviceLoading  = signal(false);
  ttsDeviceSetting  = signal(false);

  // ── Mic (input) ───────────────────────────────────────────────────────────
  micDevices        = signal<AudioDevice[]>([]);
  micActiveDeviceId = signal<number | null>(null);
  micDeviceLoading  = signal(false);
  micDeviceSetting  = signal(false);
  micSwapMessage    = signal('');
  private micSwapAt = 0;

  // ── Stream audio (input) ──────────────────────────────────────────────────
  streamDevices        = signal<AudioDevice[]>([]);
  streamActiveDeviceId = signal<number | null>(null);
  streamDeviceLoading  = signal(false);
  streamDeviceSetting  = signal(false);
  streamSwapMessage    = signal('');
  private streamSwapAt = 0;

  // ── Helpers ───────────────────────────────────────────────────────────────

  statusMeta(status: string) { return STATUS_META[status] ?? STATUS_META['unknown']; }
  isGui(id: string): boolean { return GUI_SERVICES.has(id); }

  openInVscode(svc: ServiceDetail): void {
    if (!svc.cwd) return;
    window.open(`vscode://file/${svc.cwd}`);
  }

  // ── Poll ──────────────────────────────────────────────────────────────────

  override async poll() {
    this.loading.set(true);
    try {
      const res = await fetch('/launcher/services');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const fresh: ServiceDetail[] = await res.json();
      this.launcherOnline.set(true);

      const current = this.services();
      this.services.set(fresh.map(s => {
        const existing = current.find(c => c.id === s.id);
        return { ...s, logs: existing?.logs ?? [], logsOpen: existing?.logsOpen ?? false, actionPending: false };
      }));

      this.lastUpdated.set(new Date().toLocaleTimeString());

      for (const svc of this.services()) {
        if (svc.logsOpen) this.refreshLogs(svc);
      }

      const tts    = this.services().find(s => s.id === 'tts_service');
      const mic    = this.services().find(s => s.id === 'microphone_audio_service');
      const stream = this.services().find(s => s.id === 'stream_audio_service');

      if (tts?.status === 'online') {
        await this.loadTtsDevices();
      } else {
        this.ttsDevices.set([]);
        this.ttsActiveDeviceId.set(null);
      }

      if (mic?.status === 'online') {
        await this.loadInputDevices('mic');
      } else {
        this.micDevices.set([]);
        this.micActiveDeviceId.set(null);
      }

      if (stream?.status === 'online') {
        await this.loadInputDevices('stream');
      } else {
        this.streamDevices.set([]);
        this.streamActiveDeviceId.set(null);
      }

    } catch {
      this.launcherOnline.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Device loaders ────────────────────────────────────────────────────────

  async loadTtsDevices() {
    this.ttsDeviceLoading.set(true);
    try {
      const res = await fetch('/tts/devices');
      if (!res.ok) return;
      const data = await res.json();
      this.ttsDevices.set(data.devices ?? []);
      this.ttsActiveDeviceId.set(data.active_device_id ?? null);
    } catch { /* silent */ }
    finally { this.ttsDeviceLoading.set(false); }
  }

  async loadInputDevices(target: 'mic' | 'stream') {
    const url = target === 'mic' ? '/mic-audio/devices' : '/stream-audio/devices';
    if (target === 'mic') this.micDeviceLoading.set(true);
    else this.streamDeviceLoading.set(true);

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      const now = Date.now();
      if (target === 'mic') {
        this.micDevices.set(data.devices ?? []);
        if (now - this.micSwapAt > 6000) {
          this.micActiveDeviceId.set(data.current_device_id ?? null);
        }
      } else {
        this.streamDevices.set(data.devices ?? []);
        if (now - this.streamSwapAt > 6000) {
          this.streamActiveDeviceId.set(data.current_device_id ?? null);
        }
      }
    } catch { /* silent */ }
    finally {
      if (target === 'mic') this.micDeviceLoading.set(false);
      else this.streamDeviceLoading.set(false);
    }
  }

  // ── Device selectors ──────────────────────────────────────────────────────

  async selectTtsDevice(deviceId: number) {
    if (this.ttsDeviceSetting()) return;
    this.ttsDeviceSetting.set(true);
    try {
      const res = await fetch('/tts/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        this.ttsActiveDeviceId.set(deviceId);
        this.ttsDevices.update(devs => devs.map(d => ({ ...d, is_active: d.id === deviceId })));
      }
    } catch { /* silent */ }
    finally { this.ttsDeviceSetting.set(false); }
  }

  async selectMicDevice(deviceId: number) {
    if (this.micDeviceSetting()) return;
    this.micDeviceSetting.set(true);
    try {
      const res = await fetch('/mic-audio/set-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        this.micSwapAt = Date.now();
        this.micActiveDeviceId.set(deviceId);
        this.micSwapMessage.set('✓ Device applied');
        setTimeout(() => this.micSwapMessage.set(''), 3000);
      }
    } catch { /* silent */ }
    finally { this.micDeviceSetting.set(false); }
  }

  async selectStreamDevice(deviceId: number) {
    if (this.streamDeviceSetting()) return;
    this.streamDeviceSetting.set(true);
    try {
      const res = await fetch('/stream-audio/set-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        this.streamSwapAt = Date.now();
        this.streamActiveDeviceId.set(deviceId);
        this.streamSwapMessage.set('✓ Device applied');
        setTimeout(() => this.streamSwapMessage.set(''), 3000);
      }
    } catch { /* silent */ }
    finally { this.streamDeviceSetting.set(false); }
  }

  // ── Service lifecycle ─────────────────────────────────────────────────────

  async serviceAction(svc: ServiceDetail, action: 'start' | 'stop' | 'restart') {
    this.setActionPending(svc.id, true);
    try {
      await fetch(`/launcher/services/${svc.id}/${action}`, { method: 'POST' });
      await this.poll();
      if (action !== 'stop') setTimeout(() => this.poll(), action === 'restart' ? 3000 : 2000);
      if (action === 'start') setTimeout(() => this.poll(), 5000);
    } finally {
      this.setActionPending(svc.id, false);
    }
  }

  async toggleLogs(svc: ServiceDetail) {
    this.services.update(svcs => svcs.map(s => s.id === svc.id ? { ...s, logsOpen: !s.logsOpen } : s));
    const updated = this.services().find(s => s.id === svc.id);
    if (updated?.logsOpen) await this.refreshLogs(svc);
  }

  async refreshLogs(svc: ServiceDetail) {
    try {
      const res = await fetch(`/launcher/services/${svc.id}/logs?last=150`);
      if (!res.ok) return;
      const data = await res.json();
      this.services.update(svcs => svcs.map(s => s.id === svc.id ? { ...s, logs: data.lines } : s));
    } catch { /* silent */ }
  }

  async clearLogs(svc: ServiceDetail) {
    try {
      await fetch(`/launcher/services/${svc.id}/logs`, { method: 'DELETE' });
      this.services.update(svcs => svcs.map(s => s.id === svc.id ? { ...s, logs: [] } : s));
    } catch { /* silent */ }
  }

  async startAll() {
    if (!this.launcherOnline() || this.bulkActionPending()) return;
    const toStart = this.services().filter(s => s.managed && (s.status === 'offline' || s.status === 'unhealthy'));
    if (!toStart.length) return;
    this.bulkActionPending.set(true);
    toStart.forEach(s => this.setActionPending(s.id, true));
    try {
      await Promise.all(toStart.map(svc => fetch(`/launcher/services/${svc.id}/start`, { method: 'POST' })));
      await this.poll();
      setTimeout(() => this.poll(), 5000);
    } finally {
      toStart.forEach(s => this.setActionPending(s.id, false));
      this.bulkActionPending.set(false);
    }
  }

  async stopAll() {
    if (!this.launcherOnline() || this.bulkActionPending()) return;
    const toStop = this.services().filter(s => s.managed && (s.status === 'online' || s.status === 'unhealthy' || s.status === 'starting'));
    if (!toStop.length) return;
    this.bulkActionPending.set(true);
    toStop.forEach(s => this.setActionPending(s.id, true));
    try {
      await Promise.all(toStop.map(svc => fetch(`/launcher/services/${svc.id}/stop`, { method: 'POST' })));
      await this.poll();
      setTimeout(() => this.poll(), 2000);
    } finally {
      toStop.forEach(s => this.setActionPending(s.id, false));
      this.bulkActionPending.set(false);
    }
  }

  private setActionPending(id: string, pending: boolean) {
    this.services.update(svcs => svcs.map(s => s.id === id ? { ...s, actionPending: pending } : s));
  }
}