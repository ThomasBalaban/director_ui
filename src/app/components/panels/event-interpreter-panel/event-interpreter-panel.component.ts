import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../../shared/services/director.service';
import { ClassifiedEvent, AiContextPacket } from '../../../shared/interfaces/director.interfaces';

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
            <span class="sense-pill" [class.fresh]="isFresh(latest.sense_ages.vision)" *ngIf="latest.has_vision">
              👁️ {{ ageStr(latest.sense_ages.vision) }}
            </span>
            <span class="sense-pill" [class.fresh]="isFresh(latest.sense_ages.audio)" *ngIf="latest.has_audio">
              🔊 {{ ageStr(latest.sense_ages.audio) }}
            </span>
            <span class="sense-pill" [class.fresh]="isFresh(latest.sense_ages.mic)" *ngIf="latest.player_speaking">
              🎙️ {{ ageStr(latest.sense_ages.mic) }}
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
  `
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