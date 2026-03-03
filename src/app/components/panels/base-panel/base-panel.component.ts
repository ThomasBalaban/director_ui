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
  
  // Useful if some panels (like a raw list or map) need their content to touch the edges
  @Input() disableBodyPadding = false; 
}