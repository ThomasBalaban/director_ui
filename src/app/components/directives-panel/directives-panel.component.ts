import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Directive } from '../../shared/interfaces/director.interfaces';

@Component({
  selector: 'app-directives-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel directive-panel">
      <h2 class="panel-title">⚡ Director's Orders</h2>
      <div class="panel-content">

        <div class="field">
          <div class="label-caps">Objective</div>
          <div class="objective">{{ directive?.objective || 'Waiting...' }}</div>
        </div>

        <div class="field">
          <div class="label-caps">Required Tone</div>
          <div class="tone">{{ directive?.tone || 'Waiting...' }}</div>
        </div>

        <div class="field">
          <div class="label-caps">Action</div>
          <div class="action">{{ directive?.suggested_action || 'Waiting...' }}</div>
        </div>

        <div class="constraints-box" *ngIf="directive && directive.constraints && directive.constraints.length > 0">
          <div class="label-caps constraints-label">Constraints</div>
          <div class="constraints-text">{{ directive!.constraints!.join(', ') }}</div>
        </div>

      </div>
    </div>
  `,
})
export class DirectivesPanelComponent {
  @Input() directive: Directive | null = null;
}