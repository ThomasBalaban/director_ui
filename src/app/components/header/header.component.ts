import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Streamer } from '../../models/director.models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="header">
      <div class="header-top">
        <h1 class="title">
          Director Engine 
          <span class="subtitle">| Context Monitor</span>
          <span class="connection-dot" [class.connected]="isConnected"></span>
        </h1>
        
        <div class="pills">
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
  styles: [`
    .header {
      margin-bottom: 1rem;
      flex-shrink: 0;
    }
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    
    .title {
      font-size: 1.875rem;
      font-weight: bold;
      color: white;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .subtitle {
      font-size: 0.875rem;
      font-weight: 500;
      color: #9ca3af;
    }
    
    .connection-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ef4444;
      margin-left: 0.5rem;
    }
    
    .connection-dot.connected {
      background: #22c55e;
    }
    
    .pills {
      display: flex;
      gap: 0.75rem;
    }
    
    .pill {
      padding: 0.5rem 1rem;
      border: 2px solid;
      border-radius: 9999px;
      font-weight: bold;
      font-size: 1.125rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .state-pill {
      border-color: #4b5563;
      background: #1f2937;
      color: #9ca3af;
    }
    
    .state-pill.frustrated {
      border-color: #dc2626;
      background: #7f1d1d;
      color: #fecaca;
    }
    
    .state-pill.celebratory {
      border-color: #eab308;
      background: #713f12;
      color: #fef08a;
    }
    
    .state-pill.engaged {
      border-color: #3b82f6;
      background: #1e3a8a;
      color: #bfdbfe;
    }
    
    .mood-Neutral { color: #63e2b7; border-color: #63e2b7; }
    .mood-Happy { color: #FCD34D; border-color: #FCD34D; }
    .mood-Annoyed { color: #F87171; border-color: #F87171; }
    .mood-Scared { color: #A78BFA; border-color: #A78BFA; }
    .mood-Horny { color: #F472B6; border-color: #F472B6; }
    .mood-Tired { color: #9CA3AF; border-color: #9CA3AF; }
    
    .controls-bar {
      display: flex;
      gap: 1rem;
      align-items: center;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 0.5rem;
      padding: 0.75rem;
    }
    
    .control-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .control-group.flex-1 {
      flex: 1;
    }
    
    .control-group label {
      font-size: 0.875rem;
      color: #9ca3af;
      white-space: nowrap;
    }
    
    .control-group select,
    .context-input {
      background: #1a1a1a;
      border: 1px solid #555;
      border-radius: 0.25rem;
      padding: 0.375rem 0.75rem;
      color: white;
      font-size: 0.875rem;
    }
    
    .context-input {
      flex: 1;
    }
    
    .context-input:focus,
    .control-group select:focus {
      outline: none;
      border-color: #a855f7;
    }
    
    .char-count {
      font-size: 0.75rem;
      color: #6b7280;
      width: 3rem;
      text-align: right;
    }
    
    .char-count.at-limit {
      color: #f87171;
    }
    
    .lock-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a1a;
      border: 1px solid #555;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
    }
    
    .lock-btn:hover {
      background: #2a2a2a;
      border-color: #777;
    }
    
    .lock-btn.locked {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
    }
    
    .submit-btn {
      background: #7c3aed;
      color: white;
      padding: 0.375rem 1rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .submit-btn:hover {
      background: #6d28d9;
    }
    
    .ai-suggestion {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.3);
      border-radius: 6px;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
    
    .ai-label {
      color: #a78bfa;
    }
    
    .ai-text {
      color: #c4b5fd;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .accept-btn {
      background: rgba(124, 58, 237, 0.5);
      color: white;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .accept-btn:hover {
      background: #7c3aed;
    }
  `]
})
export class HeaderComponent {
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
      case 'FRUSTRATED': return 'frustrated';
      case 'CELEBRATORY': return 'celebratory';
      case 'ENGAGED': return 'engaged';
      default: return '';
    }
  }
  
  submitContext(): void {
    this.contextSubmit.emit(this.contextValue);
  }
}
