import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Memory } from '../../../shared/interfaces/director.interfaces';
import { BasePanelComponent } from '../base-panel/base-panel.component';

@Component({
  selector: 'app-memory-panel',
  standalone: true,
  imports: [CommonModule, BasePanelComponent],
  styleUrl: 'memory-panel.component.scss',
  template: `
    <app-base-panel title="💾 Memories">
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
    </app-base-panel>
  `,
})
export class MemoryPanelComponent {
  @Input() memories: Memory[] = [];
}