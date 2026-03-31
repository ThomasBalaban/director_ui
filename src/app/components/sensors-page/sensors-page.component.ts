import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewChecked, input, signal, computed } from '@angular/core';
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
  title = input.required<string>();
  icon = input.required<string>();
  meta = input.required<string>();
  emptyMessage = input.required<string>();
  themeClass = input.required<string>();
  entryClass = input.required<string>();
  entries = input<TimestampedEntry[]>([]);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  private previousCount = 0;
  fmt = fmtTime;

  ngAfterViewChecked() {
    const currentLength = this.entries().length;
    if (currentLength !== this.previousCount) {
      this.scrollToBottom();
      this.previousCount = currentLength;
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
  visionLog = signal<TimestampedEntry[]>([]);
  spokenLog = signal<TimestampedEntry[]>([]);
  audioLog = signal<TimestampedEntry[]>([]);

  totalEntries = computed(() => this.visionLog().length + this.spokenLog().length + this.audioLog().length);

  private subs = new Subscription();
  private prevVisionLast = '';
  private prevSpokenLast = '';

  constructor(private directorService: DirectorService) { }

  ngOnInit(): void {
    this.subs.add(this.directorService.visionLog$.subscribe(log => {
      this.visionLog.update(current => this.processLog(log, current, this.prevVisionLast));
      this.prevVisionLast = log[log.length - 1] ?? '';
    }));

    this.subs.add(this.directorService.spokenLog$.subscribe(log => {
      this.spokenLog.update(current => this.processLog(log, current, this.prevSpokenLast));
      this.prevSpokenLast = log[log.length - 1] ?? '';
    }));

    this.subs.add(this.directorService.audioLog$.subscribe((log: AudioLogEntry[]) => {
      this.audioLog.set(log.map(entry => ({
        text: entry.text,
        ts: entry.timestamp ?? Date.now(),
        isPartial: entry.isPartial,
        sessionId: entry.sessionId,
      })));
    }));
  }

  private processLog(newLog: string[], currentLog: TimestampedEntry[], prevLast: string): TimestampedEntry[] {
    if (!newLog.length) return currentLog;
    const newLast = newLog[newLog.length - 1];
    if (newLast === prevLast) return currentLog;

    const prevIdx = prevLast ? newLog.lastIndexOf(prevLast) : -1;

    if (prevIdx >= 0 && prevIdx < newLog.length - 1) {
      const newEntries = newLog.slice(prevIdx + 1).map(text => ({ text, ts: Date.now() }));
      return [...currentLog, ...newEntries];
    }

    // On first load or when previous tail rotated out — replay the whole buffer
    if (!prevLast) {
      return newLog.map(text => ({ text, ts: Date.now() }));
    }

    return [...currentLog, { text: newLast, ts: Date.now() }];
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}