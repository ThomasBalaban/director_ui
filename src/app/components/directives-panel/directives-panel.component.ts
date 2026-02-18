import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Directive } from '../../models/director.models';

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
  styles: [`
    .directive-panel {
      background: linear-gradient(to bottom, var(--surface-4), #202020);
      border-color: rgba(88, 28, 135, 0.5);

      .panel-title {
        color: var(--accent-purple-pale);
        border-bottom-color: rgba(88, 28, 135, 0.3);
      }
    }

    .field { margin-bottom: 0.75rem; }

    .objective {
      font-size: 1.125rem;
      font-weight: bold;
      color: var(--text-white);
      line-height: 1.25;
    }

    .tone   { font-size: 0.875rem; color: var(--accent-purple-pale); }
    .action { font-size: 0.875rem; color: #d1d5db; font-style: italic; }

    .constraints-box {
      padding: 0.5rem;
      background: rgba(127, 29, 29, 0.2);
      border: 1px solid rgba(127, 29, 29, 0.5);
      border-radius: var(--radius-sm);
      margin-top: 0.5rem;
    }

    .constraints-label { color: var(--accent-red-light); }
    .constraints-text  { font-size: 0.75rem; color: var(--accent-red-pale); }
  `]
})
export class DirectivesPanelComponent {
  @Input() directive: Directive | null = null;
}