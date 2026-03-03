import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-base-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'base-panel.component.html',
  styleUrl: 'base-panel.component.scss',
})
export class BasePanelComponent {
  @Input({ required: true }) title!: string;
  @Input() icon?: string;

  /** Extra CSS class(es) applied to the root .panel div (e.g. 'directive-panel') */
  @Input() panelClass?: string;

  /** Extra CSS class(es) applied to .panel-content (e.g. 'graph-content') */
  @Input() contentClass?: string;

  /** Remove padding from the content area (useful for flush lists/charts) */
  @Input() disableBodyPadding = false;
}