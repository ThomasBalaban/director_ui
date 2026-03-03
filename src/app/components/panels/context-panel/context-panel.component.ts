import { Component, Input, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BasePanelComponent } from '../base-panel/base-panel.component';

@Component({
  selector: 'app-context-panel',
  standalone: true,
  imports: [CommonModule, BasePanelComponent],
  styleUrl: 'context-panel.component.scss',
  template: `
    <app-base-panel [title]="title">
      <div #scrollContainer class="ctx-scroll">

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
    </app-base-panel>
  `,
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