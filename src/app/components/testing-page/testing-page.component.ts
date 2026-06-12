import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TestingService, ScenarioSummary, ScenarioResult, RunRecord } from '../../shared/services/testing.service';

interface UiScenarioRow extends ScenarioSummary {
  selected: boolean;
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString();
}

function fmtAgo(ts: number | null | undefined): string {
  if (!ts) return '—';
  const sec = Math.max(0, Date.now() / 1000 - ts);
  if (sec < 60) return `${Math.floor(sec)}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

@Component({
  selector: 'app-testing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './testing-page.component.html',
  styleUrl: './testing-page.component.scss',
})
export class TestingPageComponent implements OnInit, OnDestroy {
  private testing = inject(TestingService);

  scenarios = this.testing.scenarios;
  scenariosError = this.testing.scenariosError;
  activeRun = this.testing.activeRun;
  history = this.testing.history;
  selectedRun = this.testing.selectedRun;
  selectedRunId = this.testing.selectedRunId;
  selectedRunError = this.testing.selectedRunError;
  isRunning = this.testing.isRunning;
  startError = this.testing.startError;
  starting = this.testing.starting;

  // Recording state
  recording = this.testing.recording;
  recordingInfo = this.testing.recordingInfo;
  recordings = this.testing.recordings;
  recordError = this.testing.recordError;
  recordBusy = this.testing.recordBusy;
  recordLabel = '';

  // Ticking clock so the elapsed timer updates every second while recording.
  private _now = signal(Date.now());
  recElapsed = computed(() => {
    const info = this.recordingInfo();
    if (!this.recording() || !info?.started_at) return '00:00';
    return this._fmtClock(Math.max(0, this._now() / 1000 - info.started_at));
  });

  // Selection state (which scenario checkboxes are ticked)
  private _selection = signal<Set<string>>(new Set());
  rows = computed<UiScenarioRow[]>(() => {
    const sel = this._selection();
    return this.scenarios().map(s => ({ ...s, selected: sel.has(s.name) }));
  });
  hasSelection = computed(() => this._selection().size > 0);

  // Live log for the currently displayed run (filtered subset of progress_events)
  liveLog = computed(() => {
    const r = this.selectedRun();
    if (!r) return [] as string[];
    const lines: string[] = [];
    for (const e of r.progress_events) {
      lines.push(this._fmtEvent(e));
    }
    return lines.slice(-200); // cap so the DOM doesn't bloat
  });

  fmtTime = fmtTime;
  fmtAgo = fmtAgo;

  private statusPoll?: ReturnType<typeof setInterval>;
  private clockTick?: ReturnType<typeof setInterval>;

  async ngOnInit() {
    await this.testing.loadScenarios();
    await this.testing.loadStatus();
    await this.testing.loadRecordStatus();
    await this.testing.loadRecordings();
    // Cheap poll fallback: if hub disconnect drops a test_event, we still catch up.
    // Also refreshes the recording status + live event count.
    this.statusPoll = setInterval(() => {
      this.testing.loadStatus();
      this.testing.loadRecordStatus();
    }, 5000);
    this.clockTick = setInterval(() => this._now.set(Date.now()), 1000);
  }

  ngOnDestroy() {
    if (this.statusPoll) clearInterval(this.statusPoll);
    if (this.clockTick) clearInterval(this.clockTick);
  }

  // ── Selection ───────────────────────────────────────────────────────────

  toggle(name: string): void {
    this._selection.update(s => {
      const next = new Set(s);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  selectAll(): void {
    this._selection.set(new Set(this.scenarios().map(s => s.name)));
  }

  selectNone(): void {
    this._selection.set(new Set());
  }

  // ── Run controls ────────────────────────────────────────────────────────

  async runSelected() {
    const names = Array.from(this._selection());
    if (!names.length) return;
    await this.testing.startRun(names);
  }

  async runAll() {
    await this.testing.startRun([]);
  }

  async stop() {
    await this.testing.stopRun();
  }

  async pickRun(id: string) {
    await this.testing.selectRun(id);
  }

  // ── Recording controls ──────────────────────────────────────────────────

  async toggleRecording() {
    if (this.recordBusy()) return;
    if (this.recording()) {
      await this.testing.stopRecording();
    } else {
      await this.testing.startRecording(this.recordLabel.trim());
      this.recordLabel = '';
    }
  }

  fmtDuration(seconds: number | null | undefined): string {
    if (seconds == null) return '—';
    return this._fmtClock(seconds);
  }

  private _fmtClock(seconds: number): string {
    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  // ── Display helpers ─────────────────────────────────────────────────────

  verdictClass(v?: string): string {
    if (!v) return 'verdict-none';
    if (v === 'PASS') return 'verdict-pass';
    if (v === 'FAIL') return 'verdict-fail';
    return 'verdict-undet';
  }

  scenarioProgressLabel(r: RunRecord): string {
    const total = r.scenario_names.length;
    const done = r.results.length;
    const cur = r.current_scenario_index;
    if (r.status === 'running') {
      return `Running ${cur !== null && cur !== undefined ? cur + 1 : done + 1} of ${total}`;
    }
    if (r.status === 'cancelling') return `Cancelling… (${done}/${total} done)`;
    return `${done} of ${total} complete`;
  }

  private _fmtEvent(e: any): string {
    const ts = e.started_at ?? e.received_at ?? null;
    const timeStr = ts ? new Date(ts * 1000).toLocaleTimeString() : '';
    const prefix = timeStr ? `[${timeStr}] ` : '';
    switch (e.type) {
      case 'run_started':
        return `${prefix}▶ Run started (${e.total} scenario${e.total === 1 ? '' : 's'})`;
      case 'scenario_start':
        return `${prefix}▶ ${e.scenario_name} — ${e.description}`;
      case 'event_fired':
        if (e.event_type === 'twitch') {
          return `    [t=${e.t.toFixed(2)}] 💬 ${e.user}: ${e.text}`;
        } else {
          return `    [t=${e.t.toFixed(2)}] 🎤 ${e.text}`;
        }
      case 'event_skipped':
        return `    ⚠ skipped: ${e.reason}`;
      case 'waiting_for_reply':
        return `    ⏳ waiting ${e.window_seconds.toFixed(1)}s for reply…`;
      case 'reply_captured':
        return `    ↩ reply: ${(e.text ?? '').slice(0, 140)}`;
      case 'scenario_complete':
        const r = e.result;
        return `    ✓ ${r.scenario}: addr=${r.address?.verdict ?? '—'}  sent=${r.completeness?.verdict ?? '—'}  rt=${r.response_time?.verdict ?? '—'}`;
      case 'run_completed':
        return `${prefix}■ Run ${e.status}`;
      case 'run_error':
        return `${prefix}✗ Error: ${e.error}`;
      default:
        return `${prefix}· ${e.type}`;
    }
  }
}
