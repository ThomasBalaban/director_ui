import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DirectorService } from './director.service';

export interface ScenarioSummary {
  name: string;
  description: string;
  events: number;
  expect: {
    addresses?: string;
    complete_sentence?: boolean;
    max_response_seconds?: number;
    no_reply?: boolean;
  };
  known_users: string[];
  reply_window_seconds: number;
  source_path?: string;
}

export interface ScenarioResult {
  scenario: string;
  description: string;
  events_fired: number;
  last_event_at: number | null;
  replies: { text: string; received_at: number }[];
  address: { verdict: string; detail: string } | null;
  completeness: { verdict: string; detail: string } | null;
  response_time: { verdict: string; detail: string } | null;
  started_at: number | null;
  finished_at: number | null;
}

export interface RunRecord {
  id: string;
  started_at: number;
  finished_at: number | null;
  status: string; // running | completed | cancelled | failed | cancelling
  scenario_names: string[];
  results: ScenarioResult[];
  current_scenario_index: number | null;
  progress_events: any[];
  error: string | null;
}

export interface RunSummary {
  id: string;
  started_at: number;
  finished_at: number | null;
  status: string;
  scenario_count: number;
  result_count: number;
  active?: boolean;
}

export interface RecordingInfo {
  id: string;
  label?: string;
  path: string;
  started_at?: number;
  finished_at?: number | null;
  duration_seconds?: number | null;
  event_count?: number;
  by_event?: Record<string, number>;
  status: string; // recording | stopped | partial | failed
  error?: string | null;
  size_bytes?: number | null;
}

@Injectable({ providedIn: 'root' })
export class TestingService {
  private directorService = inject(DirectorService);

  scenarios = signal<ScenarioSummary[]>([]);
  scenariosError = signal<string | null>(null);
  scenariosLoading = signal(false);

  activeRun = signal<RunRecord | null>(null);
  history = signal<RunSummary[]>([]);
  // The currently-displayed run in the UI. Either the active one, or a
  // historical one the user pinned. New runs auto-select unless the user
  // has explicitly picked a different one.
  selectedRunId = signal<string | null>(null);
  selectedRun = signal<RunRecord | null>(null);
  selectedRunError = signal<string | null>(null);

  startError = signal<string | null>(null);
  starting = signal(false);

  isRunning = computed(() => {
    const r = this.activeRun();
    return !!r && (r.status === 'running' || r.status === 'cancelling');
  });

  constructor() {
    // Live progress: append each test_event into activeRun (if any)
    this.directorService.testEvent$.subscribe(evt => this.onTestEvent(evt));
  }

  // ── HTTP ────────────────────────────────────────────────────────────────

  async loadScenarios(): Promise<void> {
    this.scenariosLoading.set(true);
    this.scenariosError.set(null);
    try {
      const r = await fetch('/testing-api/scenarios');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.scenarios.set(await r.json());
    } catch (e: any) {
      this.scenariosError.set(e?.message ?? String(e));
      this.scenarios.set([]);
    } finally {
      this.scenariosLoading.set(false);
    }
  }

  async loadStatus(): Promise<void> {
    try {
      const r = await fetch('/testing-api/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      this.activeRun.set(data.active);
      // history is a small index; expand by querying /runs for fuller info
      await this.loadHistory();
      // Auto-select active run if user hasn't picked anything yet
      if (data.active && !this.selectedRunId()) {
        this.selectRun(data.active.id);
      } else if (!data.active && !this.selectedRunId() && this.history().length > 0) {
        this.selectRun(this.history()[0].id);
      }
    } catch {
      this.activeRun.set(null);
    }
  }

  async loadHistory(): Promise<void> {
    try {
      const r = await fetch('/testing-api/runs');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.history.set(await r.json());
    } catch {
      this.history.set([]);
    }
  }

  async selectRun(runId: string | null): Promise<void> {
    this.selectedRunId.set(runId);
    if (!runId) {
      this.selectedRun.set(null);
      return;
    }
    // If it's the active run, we already have it
    const active = this.activeRun();
    if (active && active.id === runId) {
      this.selectedRun.set(active);
      this.selectedRunError.set(null);
      return;
    }
    try {
      const r = await fetch(`/testing-api/runs/${runId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.selectedRun.set(await r.json());
      this.selectedRunError.set(null);
    } catch (e: any) {
      this.selectedRunError.set(e?.message ?? String(e));
      this.selectedRun.set(null);
    }
  }

  async startRun(names: string[]): Promise<void> {
    this.startError.set(null);
    this.starting.set(true);
    try {
      const r = await fetch('/testing-api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 409) {
        this.startError.set('A run is already in progress');
        return;
      }
      if (!r.ok) {
        this.startError.set(body?.error ?? body?.detail ?? `HTTP ${r.status}`);
        return;
      }
      // Reload status; live events will flesh out the activeRun
      await this.loadStatus();
      if (body?.run_id) this.selectRun(body.run_id);
    } catch (e: any) {
      this.startError.set(e?.message ?? String(e));
    } finally {
      this.starting.set(false);
    }
  }

  async stopRun(): Promise<void> {
    try {
      await fetch('/testing-api/stop', { method: 'POST' });
    } catch { /* silent */ }
  }

  // ── Recording (capture a full live stream to a tape) ──────────────────────

  recording = signal(false);
  recordingInfo = signal<RecordingInfo | null>(null);
  recordings = signal<RecordingInfo[]>([]);
  recordError = signal<string | null>(null);
  recordBusy = signal(false);

  async loadRecordStatus(): Promise<void> {
    try {
      const r = await fetch('/testing-api/record/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      this.recording.set(!!data.recording);
      this.recordingInfo.set(data.recording ? data : null);
    } catch {
      this.recording.set(false);
    }
  }

  async loadRecordings(): Promise<void> {
    try {
      const r = await fetch('/testing-api/recordings');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.recordings.set(await r.json());
    } catch {
      this.recordings.set([]);
    }
  }

  async startRecording(label: string): Promise<void> {
    this.recordError.set(null);
    this.recordBusy.set(true);
    try {
      const r = await fetch('/testing-api/record/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 409) {
        this.recordError.set('A recording is already in progress');
        await this.loadRecordStatus();
        return;
      }
      if (!r.ok) {
        this.recordError.set(body?.error ?? body?.detail ?? `HTTP ${r.status}`);
        return;
      }
      this.recording.set(true);
      this.recordingInfo.set(body);
    } catch (e: any) {
      this.recordError.set(e?.message ?? String(e));
    } finally {
      this.recordBusy.set(false);
    }
  }

  async stopRecording(): Promise<void> {
    this.recordError.set(null);
    this.recordBusy.set(true);
    try {
      await fetch('/testing-api/record/stop', { method: 'POST' });
    } catch (e: any) {
      this.recordError.set(e?.message ?? String(e));
    } finally {
      this.recording.set(false);
      this.recordingInfo.set(null);
      this.recordBusy.set(false);
      await this.loadRecordings();
    }
  }

  // ── Live event handling ─────────────────────────────────────────────────

  private onTestEvent(evt: any): void {
    if (!evt || !evt.type) return;
    const runId = evt.run_id;

    // If this is a new run we haven't tracked, refresh status
    const active = this.activeRun();
    if (!active || active.id !== runId) {
      this.loadStatus();
      return;
    }

    // Append to progress
    const next: RunRecord = {
      ...active,
      progress_events: [...active.progress_events, evt],
    };

    if (evt.type === 'scenario_start') {
      next.current_scenario_index = evt.scenario_index;
    }
    if (evt.type === 'scenario_complete' && evt.result) {
      next.results = [...next.results, evt.result];
    }
    if (evt.type === 'run_completed') {
      next.status = evt.status ?? 'completed';
      next.finished_at = evt.finished_at ?? Date.now() / 1000;
      // Move to history on next refresh
      this.loadStatus();
    }
    if (evt.type === 'run_error') {
      next.status = 'failed';
      next.error = evt.error ?? null;
      this.loadStatus();
    }

    this.activeRun.set(next);
    // Mirror into selectedRun if the user is viewing this run
    if (this.selectedRunId() === runId) {
      this.selectedRun.set(next);
    }
  }
}
