import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-summary-panel',
  standalone: true,
  imports: [CommonModule],
  styleUrl: 'summary-panel.component.scss',
  template: `
    <div class="panel">
      <h2 class="panel-title">🧠 Situation Summary</h2>
      <div class="panel-content">
        <div class="summary-text">{{ summary }}</div>
        <div class="raw-context">{{ rawContext }}</div>
      </div>
    </div>
  `,
})
export class SummaryPanelComponent {
  @Input() summary = 'Waiting for summary...';
  @Input() rawContext = '';
}