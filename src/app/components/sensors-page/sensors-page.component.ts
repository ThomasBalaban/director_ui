import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewChecked, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { AudioLogEntry } from '../../shared/interfaces/director.interfaces';

interface TimestampedEntry {
  text: string;
  ts: number;
  isPartial?: boolean;
  sessionId?: string;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

@Component({
  selector: 'app-sensor-feed-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'sensor-feed-card.component.html',
  styleUrl: 'sensors-page.component.scss',
})
export class SensorFeedCardComponent implements AfterViewChecked {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) meta!: string;
  @Input({ required: true }) emptyMessage!: string;
  @Input({ required: true }) themeClass!: string;
  @Input({ required: true }) entryClass!: string;
  @Input() entries: TimestampedEntry[] = [];

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  private previousCount = 0;
  fmt = fmtTime;

  ngAfterViewChecked() {
    if (this.entries.length !== this.previousCount) {
      this.scrollToBottom();
      this.previousCount = this.entries.length;
    }
  }

  private scrollToBottom(): void {
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    }
  }
}

@Component({
  selector: 'app-sensors-page',
  standalone: true,
  imports: [CommonModule, RouterLink, SensorFeedCardComponent],
  templateUrl: 'sensors-page.component.html',
  styleUrl: 'sensors-page.component.scss',
})
export class SensorsPageComponent implements OnInit, OnDestroy {
  visionLog: TimestampedEntry[] = [];
  spokenLog: TimestampedEntry[] = [];
  audioLog:  TimestampedEntry[] = [];

  private subs = new Subscription();
  private prevVisionCount = 0;
  private prevSpokenCount = 0;

  constructor(private directorService: DirectorService) {}

  get totalEntries(): number {
    return this.visionLog.length + this.spokenLog.length + this.audioLog.length;
  }

  ngOnInit(): void {
    this.subs.add(this.directorService.visionLog$.subscribe(log => {
      this.visionLog = this.processLog(log, this.visionLog, this.prevVisionCount);
      this.prevVisionCount = log.length;
    }));

    this.subs.add(this.directorService.spokenLog$.subscribe(log => {
      this.spokenLog = this.processLog(log, this.spokenLog, this.prevSpokenCount);
      this.prevSpokenCount = log.length;
    }));

    this.subs.add(this.directorService.audioLog$.subscribe((log: AudioLogEntry[]) => {
      this.audioLog = log.map(entry => ({
        text: entry.text,
        ts: entry.timestamp ?? Date.now(),
        isPartial: entry.isPartial,
        sessionId: entry.sessionId,
      }));
    }));
  }

  private processLog(newLog: string[], currentLog: TimestampedEntry[], prevCount: number): TimestampedEntry[] {
    if (newLog.length > prevCount) {
      const newEntries = newLog.slice(prevCount).map(text => ({ text, ts: Date.now() }));
      return [...currentLog, ...newEntries];
    } else if (newLog.length < prevCount) {
      return newLog.map(text => ({ text, ts: Date.now() }));
    }
    return currentLog;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}