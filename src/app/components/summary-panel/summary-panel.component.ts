import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-summary-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">🧠 Situation Summary</h2>
      <div class="panel-content">
        <div class="summary-text">{{ summary }}</div>
        <div class="raw-context">{{ rawContext }}</div>
      </div>
    </div>
  `,
  styles: [`
    .summary-text {
      font-size: 1rem;
      font-weight: 500;
      color: white;
      line-height: 1.5;
    }
    
    .raw-context {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 1rem;
      border-top: 1px dashed #444;
      padding-top: 0.5rem;
      white-space: pre-wrap;
      max-height: 150px;
      overflow-y: auto;
    }
  `]
})
export class SummaryPanelComponent {
  @Input() summary = 'Waiting for summary...';
  @Input() rawContext = '';
}
