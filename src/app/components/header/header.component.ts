import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Streamer } from '../../shared/interfaces/director.interfaces';
import { NamiStatusComponent } from '../nami-status/nami-status.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, NamiStatusComponent],
  template: `
    <header class="header">
      <div class="header-top">
        <h1 class="title">
          Nami :)
          <span class="subtitle">| Context Monitor</span>
          <span class="connection-dot" [class.connected]="isConnected"></span>
        </h1>

        <div class="pills">
          <!-- Nami gate status -->
          <app-nami-status></app-nami-status>

          <div class="pill state-pill" [ngClass]="getStateClass()">
            <span>🗣️</span>
            <span>{{ conversationState }}</span>
          </div>
          <div class="pill mood-pill" [ngClass]="'mood-' + mood">
            <span>🎭</span>
            <span>{{ mood }}</span>
          </div>
        </div>
      </div>

      <div class="controls-bar">
        <!-- Streamer Select -->
        <div class="control-group">
          <button
            class="lock-btn"
            [class.locked]="streamerLocked"
            (click)="streamerLockToggle.emit()"
            title="Lock/Unlock AI auto-fill"
          >
            {{ streamerLocked ? '🔒' : '🔓' }}
          </button>
          <label>📺 Watching:</label>
          <select
            [ngModel]="selectedStreamer"
            (ngModelChange)="streamerChange.emit($event)"
          >
            <option *ngFor="let s of streamers" [value]="s.id">{{ s.display_name }}</option>
          </select>
        </div>

        <!-- Context Input -->
        <div class="control-group flex-1">
          <button
            class="lock-btn"
            [class.locked]="contextLocked"
            (click)="contextLockToggle.emit()"
            title="Lock/Unlock AI auto-fill"
          >
            {{ contextLocked ? '🔒' : '🔓' }}
          </button>
          <label>📝 Context:</label>
          <input
            type="text"
            [ngModel]="manualContext"
            (ngModelChange)="contextValue = $event"
            (keyup.enter)="submitContext()"
            placeholder="e.g., Otter is currently playing Phasmophobia..."
            maxlength="120"
            class="context-input"
          >
          <span class="char-count" [class.at-limit]="contextValue.length >= 120">
            {{ contextValue.length }}/120
          </span>
          <button class="submit-btn" (click)="submitContext()">Set</button>
        </div>

        <!-- AI Suggestion -->
        <div class="ai-suggestion" *ngIf="pendingAiContext">
          <span class="ai-label">🤖 AI:</span>
          <span class="ai-text">{{ pendingAiContext }}</span>
          <button class="accept-btn" (click)="acceptAiSuggestion.emit()">Accept</button>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent implements OnInit, OnChanges {
  @Input() mood = 'Neutral';
  @Input() conversationState = 'IDLE';
  @Input() isConnected = false;
  @Input() streamers: Streamer[] = [];
  @Input() selectedStreamer = 'peepingotter';
  @Input() manualContext = '';
  @Input() streamerLocked = false;
  @Input() contextLocked = false;
  @Input() pendingAiContext: string | null = null;

  @Output() streamerChange = new EventEmitter<string>();
  @Output() contextSubmit = new EventEmitter<string>();
  @Output() streamerLockToggle = new EventEmitter<void>();
  @Output() contextLockToggle = new EventEmitter<void>();
  @Output() acceptAiSuggestion = new EventEmitter<void>();

  contextValue = '';

  ngOnInit() {
    this.contextValue = this.manualContext;
  }

  ngOnChanges() {
    this.contextValue = this.manualContext;
  }

  getStateClass(): string {
    switch (this.conversationState) {
      case 'FRUSTRATED':  return 'frustrated';
      case 'CELEBRATORY': return 'celebratory';
      case 'ENGAGED':     return 'engaged';
      default:            return '';
    }
  }

  submitContext(): void {
    this.contextSubmit.emit(this.contextValue);
  }
}