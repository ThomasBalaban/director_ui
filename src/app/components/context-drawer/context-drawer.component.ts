import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotReply } from '../../models/director.models';

@Component({
  selector: 'app-context-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="overlay" 
      [class.visible]="isOpen"
      (click)="close.emit()"
    ></div>
    
    <aside class="drawer" [class.open]="isOpen">
      <div class="drawer-header">
        <h3>Nami Prompt Details</h3>
        <button class="close-btn" (click)="close.emit()">✕</button>
      </div>
      
      <div class="drawer-content" *ngIf="data">
        <div class="section">
          <h4>Prompt</h4>
          <pre class="code-block">{{ data.prompt || '(No prompt data available)' }}</pre>
        </div>
        
        <div class="section">
          <h4>Response</h4>
          
          <div *ngIf="data.is_censored" class="censorship-warning">
            <div class="warning-title">⚠️ Safety Filter Triggered</div>
            <div class="warning-row">
              <span class="label">Filtered Word:</span>
              <span class="filtered-word">{{ data.censorship_reason }}</span>
            </div>
            <div class="warning-row" *ngIf="data.filtered_area">
              <span class="label">Filtered Area:</span>
              <span class="filtered-area">{{ data.filtered_area }}</span>
            </div>
            <div class="original-label">Original Response:</div>
          </div>
          
          <pre class="code-block" [class.censored]="data.is_censored">{{ data.reply || '(No reply data available)' }}</pre>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s;
      z-index: 40;
    }
    
    .overlay.visible {
      opacity: 1;
      visibility: visible;
    }
    
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: 100%;
      max-width: 28rem;
      background: #2a2a2a;
      border-left: 1px solid #444;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
      transform: translateX(100%);
      transition: transform 0.2s ease-out;
      z-index: 50;
      display: flex;
      flex-direction: column;
    }
    
    .drawer.open {
      transform: translateX(0);
    }
    
    .drawer-header {
      padding: 0.75rem;
      border-bottom: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .drawer-header h3 {
      font-size: 0.875rem;
      font-weight: 600;
      color: white;
      margin: 0;
    }
    
    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 1.25rem;
      cursor: pointer;
    }
    
    .close-btn:hover {
      color: white;
    }
    
    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }
    
    .section {
      margin-bottom: 1.5rem;
    }
    
    .section h4 {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #9ca3af;
      margin: 0 0 0.5rem 0;
    }
    
    .code-block {
      background: #111;
      padding: 0.75rem;
      font-size: 0.875rem;
      color: #d1d5db;
      white-space: pre-wrap;
      border-radius: 0.25rem;
      border: 1px solid #333;
      max-height: 300px;
      overflow-y: auto;
      margin: 0;
    }
    
    .code-block.censored {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    
    .censorship-warning {
      background: rgba(127, 29, 29, 0.3);
      border: 1px solid #ef4444;
      border-radius: 0.25rem;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
    }
    
    .warning-title {
      color: #f87171;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    
    .warning-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    
    .label {
      font-size: 0.75rem;
      color: #9ca3af;
    }
    
    .filtered-word {
      color: #fecaca;
      font-family: monospace;
      background: rgba(127, 29, 29, 0.5);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
    }
    
    .filtered-area {
      color: #fecaca;
      font-family: monospace;
      font-size: 0.75rem;
    }
    
    .original-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: bold;
      margin-top: 0.5rem;
    }
  `]
})
export class ContextDrawerComponent {
  @Input() isOpen = false;
  @Input() data: BotReply | null = null;
  @Output() close = new EventEmitter<void>();
  
  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isOpen) {
      this.close.emit();
    }
  }
}
