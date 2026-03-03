import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Directive } from '../../../shared/interfaces/director.interfaces';
import { BasePanelComponent } from '../base-panel/base-panel.component';

@Component({
  selector: 'app-directives-panel',
  standalone: true,
  imports: [CommonModule, BasePanelComponent],
  styleUrl: 'directives-panel.component.scss',
  template: `
    <app-base-panel title="⚡ Director's Orders" panelClass="directive-panel">

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

      <div class="constraints-box" *ngIf="directive?.constraints?.length">
        <div class="label-caps constraints-label">Constraints</div>
        <div class="constraints-text">{{ directive!.constraints!.join(', ') }}</div>
      </div>

    </app-base-panel>
  `,
})
export class DirectivesPanelComponent {
  @Input() directive: Directive | null = null;
}