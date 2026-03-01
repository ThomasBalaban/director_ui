import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { AudioLogEntry } from '../../shared/interfaces/director.interfaces';

interface TimestampedEntry {
  text: string;
  ts: number;       // unix ms — when this component received it
  isPartial?: boolean;
  sessionId?: string;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

@Component({
  selector: 'app-sensors-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="sensors-page">

      <div class="sensors-header">
        <div class="sensors-header-left">
          <a routerLink="/" class="back-btn">← Dashboard</a>
          <h1 class="sensors-title">
            <span class="title-icon">🔭</span>
            Raw Sensor Feeds
          </h1>
          <span class="live-badge">
            <span class="live-dot"></span>
            LIVE
          </span>
        </div>
        <div class="sensors-header-right">
          <span class="feed-count">{{ totalEntries }} entries captured</span>
        </div>
      </div>

      <div class="feeds-grid">

        <!-- Vision Feed -->
        <div class="feed-card feed-vision">
          <div class="feed-header">
            <div class="feed-header-left">
              <span class="feed-icon">👁️</span>
              <div>
                <div class="feed-title">Vision</div>
                <div class="feed-meta">Gemini 2.5 Flash · 12s window</div>
              </div>
            </div>
            <span class="feed-count-badge">{{ visionLog.length }}</span>
          </div>
          <div class="feed-body" #visionScroll>
            <div *ngFor="let entry of visionLog; let i = index"
                 class="feed-entry feed-entry--vision"
                 [class.feed-entry--latest]="i === visionLog.length - 1">
              <span class="entry-ts">{{ fmt(entry.ts) }}</span>
              <span class="entry-text">{{ entry.text }}</span>
            </div>
            <div *ngIf="!visionLog.length" class="feed-empty">
              <span class="empty-icon">👁️</span>
              Waiting for vision data...
            </div>
          </div>
        </div>

        <!-- Microphone Feed -->
        <div class="feed-card feed-mic">
          <div class="feed-header">
            <div class="feed-header-left">
              <span class="feed-icon">🎤</span>
              <div>
                <div class="feed-title">Microphone</div>
                <div class="feed-meta">Parakeet MLX · 30s window</div>
              </div>
            </div>
            <span class="feed-count-badge">{{ spokenLog.length }}</span>
          </div>
          <div class="feed-body" #micScroll>
            <div *ngFor="let entry of spokenLog; let i = index"
                 class="feed-entry feed-entry--mic"
                 [class.feed-entry--latest]="i === spokenLog.length - 1">
              <span class="entry-ts">{{ fmt(entry.ts) }}</span>
              <span class="entry-text">{{ entry.text }}</span>
            </div>
            <div *ngIf="!spokenLog.length" class="feed-empty">
              <span class="empty-icon">🎤</span>
              Waiting for mic audio...
            </div>
          </div>
        </div>

        <!-- Desktop Audio Feed -->
        <div class="feed-card feed-audio">
          <div class="feed-header">
            <div class="feed-header-left">
              <span class="feed-icon">🖥️</span>
              <div>
                <div class="feed-title">Desktop Audio</div>
                <div class="feed-meta">OpenAI Realtime + GPT-4o · 12s window</div>
              </div>
            </div>
            <span class="feed-count-badge">{{ audioLog.length }}</span>
          </div>
          <div class="feed-body" #audioScroll>
            <div *ngFor="let entry of audioLog; let i = index"
                 class="feed-entry feed-entry--audio"
                 [class.feed-entry--partial]="entry.isPartial"
                 [class.feed-entry--latest]="i === audioLog.length - 1 && !entry.isPartial">
              <span class="entry-ts" [class.entry-ts--partial]="entry.isPartial">{{ fmt(entry.ts) }}</span>
              <span class="partial-tag" *ngIf="entry.isPartial">~</span>
              <span class="entry-text">{{ entry.text }}</span>
            </div>
            <div *ngIf="!audioLog.length" class="feed-empty">
              <span class="empty-icon">🖥️</span>
              Waiting for desktop audio...
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .sensors-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--surface-1);
      padding: 1rem 1.5rem 1.5rem;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* ── Header ── */
    .sensors-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      flex-shrink: 0;
    }

    .sensors-header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .sensors-header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .back-btn {
      color: var(--text-dim);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 4px 10px;
      border: 1px solid var(--border-faint);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);

      &:hover {
        color: white;
        border-color: #555;
        background: var(--surface-4);
      }
    }

    .sensors-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: white;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .title-icon { font-size: 1.25rem; }

    .live-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--accent-green-light);
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: var(--radius-full);
      padding: 3px 10px;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-green);
      animation: pulse-dot 1.5s ease-in-out infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.8); }
    }

    .feed-count {
      font-size: 0.75rem;
      color: var(--text-dimmer);
    }

    /* ── Grid ── */
    .feeds-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
      flex: 1;
      min-height: 0;
    }

    /* ── Feed card ── */
    .feed-card {
      display: flex;
      flex-direction: column;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background: var(--surface-3);
      overflow: hidden;
      min-height: 0;
    }

    .feed-vision { border-color: rgba(99, 226, 183, 0.25); }
    .feed-mic    { border-color: rgba(169, 112, 255, 0.25); }
    .feed-audio  { border-color: rgba(96, 165, 250, 0.25); }

    /* ── Feed header ── */
    .feed-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--border-dim);
      flex-shrink: 0;
    }

    .feed-vision .feed-header { background: rgba(99, 226, 183, 0.05); }
    .feed-mic    .feed-header { background: rgba(169, 112, 255, 0.05); }
    .feed-audio  .feed-header { background: rgba(96, 165, 250, 0.05); }

    .feed-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .feed-icon { font-size: 1.25rem; line-height: 1; }

    .feed-title {
      font-size: 0.875rem;
      font-weight: 700;
      color: white;
    }

    .feed-meta {
      font-size: 0.65rem;
      color: var(--text-dimmer);
      margin-top: 2px;
      font-family: monospace;
    }

    .feed-count-badge {
      font-size: 0.7rem;
      font-weight: 700;
      font-family: monospace;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--surface-1);
      color: var(--text-dim);
      border: 1px solid var(--border-faint);
      min-width: 2rem;
      text-align: center;
    }

    /* ── Feed body ── */
    .feed-body {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 0;
      scroll-behavior: smooth;
    }

    /* ── Feed entries ── */
    .feed-entry {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      line-height: 1.5;
      color: #d1d5db;
      border: 1px solid transparent;
      transition: background var(--transition-fast);
    }

    .feed-entry--vision {
      background: rgba(99, 226, 183, 0.04);
      border-color: rgba(99, 226, 183, 0.08);
    }
    .feed-entry--vision.feed-entry--latest {
      background: rgba(99, 226, 183, 0.1);
      border-color: rgba(99, 226, 183, 0.25);
      color: #a7f3d0;
    }

    .feed-entry--mic {
      background: rgba(169, 112, 255, 0.04);
      border-color: rgba(169, 112, 255, 0.08);
    }
    .feed-entry--mic.feed-entry--latest {
      background: rgba(169, 112, 255, 0.1);
      border-color: rgba(169, 112, 255, 0.25);
      color: #c4b5fd;
    }

    .feed-entry--audio {
      background: rgba(96, 165, 250, 0.04);
      border-color: rgba(96, 165, 250, 0.08);
    }
    .feed-entry--audio.feed-entry--latest {
      background: rgba(96, 165, 250, 0.1);
      border-color: rgba(96, 165, 250, 0.25);
      color: #bfdbfe;
    }

    .feed-entry--partial {
      opacity: 0.6;
      font-style: italic;
      animation: pulse-partial 1s ease-in-out infinite;
    }

    @keyframes pulse-partial {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.9; }
    }

    /* ── Timestamp ── */
    .entry-ts {
      font-size: 0.62rem;
      font-family: monospace;
      color: var(--text-dimmer);
      margin-right: 1rem;
      flex-shrink: 0;
      padding-top: 2px;
      white-space: nowrap;
    }

    .entry-ts--partial {
      color: var(--accent-yellow);
      opacity: 0.7;
    }

    /* Latest entry timestamps get slightly brighter */
    .feed-entry--latest .entry-ts { color: var(--text-dim); }

    .partial-tag {
      font-size: 0.7rem;
      color: var(--accent-yellow);
      font-style: normal;
      flex-shrink: 0;
    }

    .entry-text {
      flex: 1;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* ── Empty state ── */
    .feed-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--text-dimmer);
      font-size: 0.8rem;
      font-style: italic;
    }

    .empty-icon { font-size: 2rem; opacity: 0.3; }
  `]
})
export class SensorsPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  visionLog: TimestampedEntry[] = [];
  spokenLog: TimestampedEntry[] = [];
  audioLog:  TimestampedEntry[] = [];

  private subs = new Subscription();
  private shouldScrollVision = false;
  private shouldScrollMic    = false;
  private shouldScrollAudio  = false;

  // Track previous raw string counts so we only timestamp genuinely new entries
  private prevVisionCount = 0;
  private prevSpokenCount = 0;

  @ViewChildren('visionScroll') visionScrollRef!: QueryList<ElementRef>;
  @ViewChildren('micScroll')    micScrollRef!: QueryList<ElementRef>;
  @ViewChildren('audioScroll')  audioScrollRef!: QueryList<ElementRef>;

  constructor(private directorService: DirectorService) {}

  get totalEntries(): number {
    return this.visionLog.length + this.spokenLog.length + this.audioLog.length;
  }

  fmt = fmtTime;

  ngOnInit(): void {
    this.subs.add(this.directorService.visionLog$.subscribe(log => {
      if (log.length > this.prevVisionCount) {
        // Stamp only the new tail entries (preserves existing timestamps on scroll)
        const newEntries = log.slice(this.prevVisionCount).map(text => ({
          text,
          ts: Date.now(),
        }));
        this.visionLog = [...this.visionLog, ...newEntries];
        this.prevVisionCount = log.length;
      } else if (log.length < this.prevVisionCount) {
        // Log was trimmed / cleared
        this.visionLog = log.map(text => ({ text, ts: Date.now() }));
        this.prevVisionCount = log.length;
      }
      this.shouldScrollVision = true;
    }));

    this.subs.add(this.directorService.spokenLog$.subscribe(log => {
      if (log.length > this.prevSpokenCount) {
        const newEntries = log.slice(this.prevSpokenCount).map(text => ({
          text,
          ts: Date.now(),
        }));
        this.spokenLog = [...this.spokenLog, ...newEntries];
        this.prevSpokenCount = log.length;
      } else if (log.length < this.prevSpokenCount) {
        this.spokenLog = log.map(text => ({ text, ts: Date.now() }));
        this.prevSpokenCount = log.length;
      }
      this.shouldScrollMic = true;
    }));

    this.subs.add(this.directorService.audioLog$.subscribe((log: AudioLogEntry[]) => {
      // AudioLogEntry already has an optional timestamp field from the service
      this.audioLog = log.map(entry => ({
        text:      entry.text,
        ts:        entry.timestamp ?? Date.now(),
        isPartial: entry.isPartial,
        sessionId: entry.sessionId,
      }));
      this.shouldScrollAudio = true;
    }));
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollVision) {
      this.scrollToBottom(this.visionScrollRef);
      this.shouldScrollVision = false;
    }
    if (this.shouldScrollMic) {
      this.scrollToBottom(this.micScrollRef);
      this.shouldScrollMic = false;
    }
    if (this.shouldScrollAudio) {
      this.scrollToBottom(this.audioScrollRef);
      this.shouldScrollAudio = false;
    }
  }

  private scrollToBottom(refs: QueryList<ElementRef>): void {
    const el = refs?.first?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}