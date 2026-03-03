import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Memory } from '../../shared/interfaces/director.interfaces';

@Component({
  selector: 'app-memory-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">💾 Memories</h2>
      <div class="panel-content">
        <ul *ngIf="memories.length" class="memory-list">
          <li *ngFor="let mem of memories" class="memory-item">
            <div class="memory-header">
              <span class="memory-source">{{ mem.source }}</span>
              <span class="memory-score">{{ mem.score }}</span>
            </div>
            <div class="memory-text">{{ mem.text }}</div>
          </li>
        </ul>

        <p *ngIf="!memories.length" class="empty">No high-impact memories yet.</p>
      </div>
    </div>
  `,
})
export class MemoryPanelComponent {
  @Input() memories: Memory[] = [];
}