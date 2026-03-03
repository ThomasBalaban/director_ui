import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { ClassifiedEvent, AiContextPacket } from '../../shared/interfaces/director.interfaces';

const EVENT_META: Record<string, { icon: string; color: string; bg: string }> = {
  PLAYER_DEATH:     { icon: '💀', color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
  PLAYER_WIN:       { icon: '🏆', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
  TENSE_MOMENT:     { icon: '😰', color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  JUMPSCARED:       { icon: '😱', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  FUNNY_MOMENT:     { icon: '😂', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  CONFUSION:        { icon: '😵', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  CHAT_INTERACTION: { icon: '💬', color: '#63e2b7', bg: 'rgba(99,226,183,0.12)' },
  PLAYER_SPEAKING:  { icon: '🎙️', color: '#a3e635', bg: 'rgba(163,230,53,0.10)' },
  CONVERSATION:     { icon: '🗣️', color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  CUTSCENE:         { icon: '🎬', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  MENU_SCREEN:      { icon: '📋', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
  BORING_LULL:      { icon: '😴', color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
  IDLE:             { icon: '⏸️', color: '#4b5563', bg: 'rgba(75,85,99,0.08)' },
};

function getMeta(event: string) {
  return EVENT_META[event] ?? { icon: '❓', color: '#9ca3af', bg: 'rgba(156,163,175,0.08)' };
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch { return iso; }
}

function confClass(c: number): string {
  if (c >= 0.85) return 'conf-high';
  if (c >= 0.65) return 'conf-med';
  return 'conf-low';
}

@Component({
  selector: 'app-event-interpreter-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel ei-panel">

      <div class="panel-title ei-header">
        <div class="ei-header-left">
          <span>⚡ Event Interpreter</span>
          <span class="ei-live" [class.ei-live--active]="isLive">
            <span class="live-pip"></span>{{ isLive ? 'LIVE' : 'WAITING' }}
          </span>
        </div>
        <span class="ei-count" *ngIf="events.length">{{ events.length }}</span>
      </div>

      <div class="ei-content">

        <!-- Current event hero -->
        <div class="current-event" *ngIf="latest; else noEvent"
             [style.border-color]="getMeta(latest.event).color + '55'"
             [style.background]="getMeta(latest.event).bg">

          <div class="current-top">
            <span class="event-icon">{{ getMeta(latest.event).icon }}</span>
            <div class="current-info">
              <span class="event-label" [style.color]="getMeta(latest.event).color">{{ latest.event }}</span>
              <span class="event-time">{{ fmtTime(latest.timestamp) }}</span>
            </div>
            <div class="conf-badge" [class]="confClass(latest.confidence)">
              {{ (latest.confidence * 100).toFixed(0) }}%
            </div>
          </div>

          <p class="event-summary">{{ latest.summary }}</p>

          <div class="sense-row">
            <span class="sense-label">Senses</span>
            <span class="sense-pill" [class.fresh]="isFresh(latest.sense_ages?.vision)" *ngIf="latest.has_vision">
              👁️ {{ ageStr(latest.sense_ages?.vision) }}
            </span>
            <span class="sense-pill" [class.fresh]="isFresh(latest.sense_ages?.audio)" *ngIf="latest.has_audio">
              🔊 {{ ageStr(latest.sense_ages?.audio) }}
            </span>
            <span class="sense-pill" [class.fresh]="isFresh(latest.sense_ages?.mic)" *ngIf="latest.player_speaking">
              🎙️ {{ ageStr(latest.sense_ages?.mic) }}
            </span>
          </div>

          <div class="event-flags" *ngIf="latest.player_speaking">
            <span class="flag flag--speaking">🎙️ Player Speaking</span>
          </div>
        </div>

        <!-- AI context block -->
        <div class="ai-ctx-block" *ngIf="latestAiCtx">
          <div class="ai-ctx-header">
            <span class="ai-ctx-label">🤖 AI Context</span>
            <span class="ai-ctx-event">↳ {{ latestAiCtx.event }}</span>
            <span class="ai-ctx-time">{{ fmtTime(latestAiCtx.timestamp) }}</span>
          </div>
          <pre class="ai-ctx-text">{{ latestAiCtx.context }}</pre>
        </div>

        <!-- History feed -->
        <div class="event-history" *ngIf="historySlice.length">
          <div class="history-label">RECENT EVENTS</div>
          <div class="history-scroll" #historyScroll>
            <div *ngFor="let ev of historySlice"
                 class="history-row"
                 [style.border-left-color]="getMeta(ev.event).color + '88'">
              <span class="h-icon">{{ getMeta(ev.event).icon }}</span>
              <div class="h-body">
                <span class="h-event" [style.color]="getMeta(ev.event).color">{{ ev.event }}</span>
                <span class="h-summary">{{ ev.summary }}</span>
              </div>
              <div class="h-right">
                <span class="conf-dot" [class]="confClass(ev.confidence)"
                      [title]="(ev.confidence*100).toFixed(0)+'%'"></span>
                <span class="h-time">{{ fmtTime(ev.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>

        <ng-template #noEvent>
          <div class="ei-empty">
            <span class="ei-empty-icon">⚡</span>
            <span>Waiting for events...</span>
            <span class="ei-empty-hint">Classifies discrete gameplay moments every 2s</span>
          </div>
        </ng-template>

      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }

    .ei-panel { border-color: rgba(251,191,36,0.25); }

    .ei-header { display: flex; justify-content: space-between; align-items: center; }
    .ei-header-left { display: flex; align-items: center; gap: 0.6rem; }

    .ei-live {
      display: flex; align-items: center; gap: 4px;
      font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em;
      color: var(--text-dimmer); background: var(--surface-1);
      border: 1px solid var(--border-faint); border-radius: var(--radius-full);
      padding: 2px 7px;
    }
    .ei-live--active {
      color: var(--accent-yellow-light); background: rgba(245,158,11,0.08);
      border-color: rgba(245,158,11,0.3);
    }
    .live-pip { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
    .ei-live--active .live-pip { animation: pip-pulse 1.5s ease-in-out infinite; }

    .ei-count {
      font-size: 0.62rem; font-family: monospace; color: var(--text-dimmer);
      background: var(--surface-1); border: 1px solid var(--border-faint);
      border-radius: var(--radius-full); padding: 1px 6px;
    }

    .ei-content {
      padding: 0.75rem; overflow-y: auto; flex: 1; min-height: 0;
      display: flex; flex-direction: column; gap: 0.75rem;
    }

    /* Current hero */
    .current-event {
      border: 1px solid; border-radius: var(--radius-md);
      padding: 0.75rem; flex-shrink: 0; transition: all 0.3s ease;
    }
    .current-top { display: flex; align-items: flex-start; gap: 0.6rem; margin-bottom: 0.5rem; }
    .event-icon  { font-size: 1.5rem; line-height: 1; flex-shrink: 0; }
    .current-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .event-label { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .event-time  { font-size: 0.6rem; font-family: monospace; color: var(--text-dimmer); }

    .conf-badge {
      font-size: 0.62rem; font-weight: 700; font-family: monospace;
      padding: 2px 6px; border-radius: var(--radius-full); border: 1px solid; flex-shrink: 0;
    }
    .conf-high { color: #4ade80; border-color: rgba(74,222,128,0.4); background: rgba(74,222,128,0.08); }
    .conf-med  { color: #fbbf24; border-color: rgba(251,191,36,0.4);  background: rgba(251,191,36,0.08); }
    .conf-low  { color: #f87171; border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.08); }

    .event-summary { font-size: 0.75rem; color: #d1d5db; line-height: 1.5; margin: 0 0 0.5rem; }

    .sense-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-bottom: 0.25rem; }
    .sense-label { font-size: 0.58rem; color: var(--text-dimmer); text-transform: uppercase; letter-spacing: 0.06em; }
    .sense-pill {
      font-size: 0.6rem; font-family: monospace; padding: 1px 6px;
      border-radius: var(--radius-full); border: 1px solid var(--border-faint);
      color: var(--text-dim); background: var(--surface-2);
    }
    .sense-pill.fresh { color: var(--accent-green-light); border-color: rgba(74,222,128,0.35); background: rgba(74,222,128,0.06); }

    .event-flags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 0.3rem; }
    .flag { font-size: 0.6rem; padding: 1px 7px; border-radius: var(--radius-full); border: 1px solid; }
    .flag--speaking { color: #a3e635; border-color: rgba(163,230,53,0.35); background: rgba(163,230,53,0.08); }

    /* AI context block */
    .ai-ctx-block {
      background: var(--surface-2); border: 1px solid rgba(99,226,183,0.2);
      border-radius: var(--radius-md); overflow: hidden; flex-shrink: 0;
    }
    .ai-ctx-header {
      display: flex; align-items: center; gap: 8px; padding: 0.28rem 0.75rem;
      background: rgba(99,226,183,0.06); border-bottom: 1px solid rgba(99,226,183,0.15);
    }
    .ai-ctx-label { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em; color: var(--accent-teal); text-transform: uppercase; }
    .ai-ctx-event { font-size: 0.58rem; color: var(--text-dimmer); font-family: monospace; }
    .ai-ctx-time  { margin-left: auto; font-size: 0.58rem; font-family: monospace; color: var(--text-dimmer); }
    .ai-ctx-text  {
      margin: 0; padding: 0.5rem 0.75rem; font-size: 0.68rem; line-height: 1.55;
      color: #a7f3d0; white-space: pre-wrap; word-wrap: break-word;
      max-height: 120px; overflow-y: auto; font-family: 'Courier New', monospace;
    }

    /* History */
    .event-history {
      display: flex; flex-direction: column; flex: 1; min-height: 0;
      background: var(--surface-1); border-radius: var(--radius-md); overflow: hidden;
    }
    .history-label {
      padding: 0.28rem 0.75rem; background: var(--surface-2); border-bottom: 1px solid var(--border-faint);
      font-size: 0.58rem; font-weight: 700; letter-spacing: 0.07em; color: var(--text-dimmer); flex-shrink: 0;
    }
    .history-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column-reverse; }

    .history-row {
      display: flex; align-items: flex-start; gap: 7px; padding: 0.35rem 0.65rem;
      border-bottom: 1px solid var(--border-faint); border-left: 2px solid;
      transition: background var(--transition-fast);
    }
    .history-row:hover { background: var(--surface-2); }

    .h-icon { font-size: 0.85rem; line-height: 1; flex-shrink: 0; padding-top: 1px; }
    .h-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .h-event { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .h-summary { font-size: 0.62rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .h-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
    .conf-dot { width: 5px; height: 5px; border-radius: 50%; }
    .conf-dot.conf-high { background: #4ade80; }
    .conf-dot.conf-med  { background: #fbbf24; }
    .conf-dot.conf-low  { background: #f87171; }
    .h-time { font-size: 0.56rem; font-family: monospace; color: var(--text-dimmer); }

    /* Empty */
    .ei-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.3rem; padding: 2rem 1rem; color: var(--text-dim); font-size: 0.78rem;
      font-style: italic; border: 1px dashed var(--border-faint); border-radius: var(--radius-md);
    }
    .ei-empty-icon { font-size: 1.5rem; opacity: 0.3; margin-bottom: 0.35rem; }
    .ei-empty-hint { font-size: 0.65rem; color: var(--text-dimmer); text-align: center; }

    @keyframes pip-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  `]
})
export class EventInterpreterPanelComponent implements OnInit, OnDestroy, AfterViewChecked {
  events: ClassifiedEvent[]       = [];
  latest: ClassifiedEvent | null  = null;
  latestAiCtx: AiContextPacket | null = null;
  isLive = false;

  private subs         = new Subscription();
  private shouldScroll = false;
  private liveTimeout: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('historyScroll') historyScrollRef!: ElementRef;

  constructor(private directorService: DirectorService) {}

  get historySlice(): ClassifiedEvent[] {
    return this.events.length > 1 ? this.events.slice(0, -1) : [];
  }

  getMeta = getMeta;
  confClass = confClass;
  fmtTime   = fmtTime;

  ageStr(age?: number): string {
    if (age === undefined || age === null) return '?s';
    return age < 1 ? '<1s' : `${age.toFixed(1)}s`;
  }

  isFresh(age?: number): boolean {
    return age !== undefined && age !== null && age < 2.5;
  }

  ngOnInit(): void {
    this.subs.add(
      this.directorService.classifiedEvents$.subscribe(evs => {
        this.events = evs;
        this.latest = evs.length ? evs[evs.length - 1] : null;
        if (evs.length) {
          this.isLive = true;
          if (this.liveTimeout) clearTimeout(this.liveTimeout);
          this.liveTimeout = setTimeout(() => (this.isLive = false), 8000);
        }
        this.shouldScroll = true;
      })
    );
    this.subs.add(
      this.directorService.latestAiContext$.subscribe(ctx => (this.latestAiCtx = ctx))
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.historyScrollRef) {
      this.historyScrollRef.nativeElement.scrollTop = 0;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.liveTimeout) clearTimeout(this.liveTimeout);
  }
}