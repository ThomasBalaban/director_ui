import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

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
        <h3>{{ title }}</h3>
        <button class="close-btn" (click)="close.emit()">✕</button>
      </div>

      <div class="drawer-content" *ngIf="data">

        <div class="section">
          <div class="section-label-row">
            <h4 class="section-label">{{ promptLabel }}</h4>
            <button
              class="copy-btn"
              [class.copied]="copiedPrompt"
              (click)="copy('prompt')"
              title="Copy prompt"
            >
              {{ copiedPrompt ? '✓ Copied' : '⎘ Copy' }}
            </button>
          </div>
          <pre class="code-block">{{ data.prompt || '(No prompt data available)' }}</pre>
        </div>

        <div class="section">
          <div class="section-label-row">
            <h4 class="section-label">{{ replyLabel }}</h4>
            <button
              class="copy-btn"
              [class.copied]="copiedReply"
              (click)="copy('reply')"
              title="Copy response"
            >
              {{ copiedReply ? '✓ Copied' : '⎘ Copy' }}
            </button>
          </div>

          <div *ngIf="data.is_censored" class="censorship-warning">
            <div class="warning-title">⚠️ Safety Filter Triggered</div>
            <div class="warning-row">
              <span class="warn-label">Filtered Word:</span>
              <span class="filtered-word">{{ data.censorship_reason || 'Unknown Policy' }}</span>
            </div>
            <div class="warning-row" *ngIf="data.filtered_area">
              <span class="warn-label">Filtered Area:</span>
              <span class="filtered-area">{{ data.filtered_area }}</span>
            </div>
            <div class="original-label">Original Response:</div>
          </div>

          <pre class="code-block" [class.code-block--censored]="data.is_censored">{{ data.reply || '(No reply data available)' }}</pre>
        </div>

      </div>
    </aside>
  `,
})
export class ContextDrawerComponent {
  @Input() isOpen = false;
  @Input() data: any | null = null;
  @Output() close = new EventEmitter<void>();

  @Input() title = 'Nami Prompt Details';
  @Input() promptLabel = 'Prompt';
  @Input() replyLabel = 'Response';

  copiedPrompt = false;
  copiedReply  = false;

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isOpen) this.close.emit();
  }

  async copy(field: 'prompt' | 'reply'): Promise<void> {
    if (!this.data) return;
    const text = field === 'prompt' ? this.data.prompt : this.data.reply;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    if (field === 'prompt') {
      this.copiedPrompt = true;
      setTimeout(() => (this.copiedPrompt = false), 2000);
    } else {
      this.copiedReply = true;
      setTimeout(() => (this.copiedReply = false), 2000);
    }
  }
}