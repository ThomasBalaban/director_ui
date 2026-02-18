import { Component, Input, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-context-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">{{ title }}</h2>
      <div class="panel-content" #scrollContainer>

        <ng-container *ngIf="!isAudioPanel">
          <div *ngFor="let log of logs" class="log-item">{{ log }}</div>
          <div *ngIf="!logs.length" class="empty">Waiting...</div>
        </ng-container>

        <ng-container *ngIf="isAudioPanel">
          <div
            *ngFor="let audio of audioLogs"
            class="audio-item"
            [class.partial]="audio.isPartial"
          >
            {{ audio.text }}
          </div>
          <div *ngIf="!audioLogs.length" class="empty">Waiting...</div>
        </ng-container>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .log-item {
      font-size: 0.75rem;
      color: #d1d5db;
      margin-bottom: 0.5rem;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .audio-item {
      background: rgba(169, 112, 255, 0.15);
      border-left: 3px solid var(--nami-purple);
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);
      margin-bottom: 0.5rem;
      color: #e9d5ff;
      font-weight: 500;
      font-size: 0.75rem;

      &.partial { animation: pulse 1s ease-in-out infinite; }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.7; }
    }
  `]
})
export class ContextPanelComponent implements AfterViewChecked {
  @Input() title = 'Context';
  @Input() logs: string[] = [];
  @Input() audioLogs: { text: string; sessionId?: string; isPartial?: boolean }[] = [];
  @Input() isAudioPanel = false;

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  ngAfterViewChecked(): void {
    if (this.scrollContainer) {
      const el = this.scrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}