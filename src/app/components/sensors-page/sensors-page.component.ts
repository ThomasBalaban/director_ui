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