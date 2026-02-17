import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Memory } from '../../models/director.models';

@Component({
  selector: 'app-memory-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">💾 Memories</h2>
      <div class="panel-content">
        <ul *ngIf="memories?.length" class="memory-list">
          <li *ngFor="let mem of memories" class="memory-item">
            <div class="memory-header">
              <span class="source">{{ mem.source }}</span>
              <span class="score">{{ mem.score }}</span>
            </div>
            <div class="memory-text">{{ mem.text }}</div>
          </li>
        </ul>
        
        <p *ngIf="!memories?.length" class="empty">
          No high-impact memories yet.
        </p>
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
    
    .panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    
    .panel-content {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
    
    .memory-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .memory-item {
      border-left: 2px solid #a855f7;
      padding-left: 0.75rem;
      background: #2a2a2a;
      padding: 0.5rem 0.5rem 0.5rem 0.75rem;
      border-radius: 0.25rem;
    }
    
    .memory-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.25rem;
    }
    
    .source {
      font-size: 0.75rem;
      font-weight: bold;
      color: #a78bfa;
    }
    
    .score {
      font-size: 0.75rem;
      color: #6b7280;
    }
    
    .memory-text {
      font-size: 0.875rem;
      color: #d1d5db;
      line-height: 1.4;
    }
    
    .empty {
      color: #6b7280;
      font-style: italic;
      text-align: center;
      font-size: 0.875rem;
      margin-top: 1rem;
    }
  `]
})
export class MemoryPanelComponent {
  @Input() memories: Memory[] = [];
}
