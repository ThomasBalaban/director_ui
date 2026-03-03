import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BasePanelComponent } from '../base-panel/base-panel.component';

@Component({
  selector: 'app-summary-panel',
  standalone: true,
  imports: [CommonModule, BasePanelComponent],
  styleUrl: 'summary-panel.component.scss',
  template: `
    <app-base-panel title="🧠 Situation Summary">
      <div class="summary-text">{{ summary }}</div>
      <div class="raw-context">{{ rawContext }}</div>
    </app-base-panel>
  `,
})
export class SummaryPanelComponent {
  @Input() summary = 'Waiting for summary...';
  @Input() rawContext = '';
}