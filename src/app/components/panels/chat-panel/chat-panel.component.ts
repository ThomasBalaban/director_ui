import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotReply } from '../../../shared/interfaces/director.interfaces';
import { BasePanelComponent } from '../base-panel/base-panel.component';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, BasePanelComponent],
  styleUrl: 'chat-panel.component.scss',
  template: `
    <app-base-panel [title]="title">
      <!-- Wrap content in a scroll container so AfterViewChecked can target it -->
      <div #scrollContainer class="chat-scroll">

        <ng-container *ngIf="!isNamiPanel">
          <div
            *ngFor="let msg of messages"
            class="log-line"
            [class.mention-bg]="msg.isMention"
            [class.nami-msg]="msg.isNami"
          >
            <span class="username" [class.nami]="msg.isNami">{{ msg.username }}:</span>
            <span [innerHTML]="highlightMentions(msg.message)"></span>
          </div>
          <div *ngIf="!messages.length" class="empty">No messages yet...</div>
        </ng-container>

        <ng-container *ngIf="isNamiPanel">
          <div
            *ngFor="let reply of namiReplies"
            class="log-line nami-reply"
            [class.censored]="reply.is_censored"
            (click)="openDrawer.emit(reply)"
          >
            <strong>Nami:</strong> {{ reply.reply }}
            <span *ngIf="reply.is_censored" class="censored-indicator">
              🚨 FILTERED ({{ reply.censorship_reason || 'Unknown Policy' }})
            </span>
            <span class="context-hint">📄 Context</span>
          </div>
          <div *ngIf="!namiReplies.length" class="empty">No replies yet...</div>
        </ng-container>

      </div>
    </app-base-panel>
  `,
})
export class ChatPanelComponent implements AfterViewChecked {
  @Input() title = 'Chat';
  @Input() messages: { username: string; message: string; isNami?: boolean; isMention?: boolean }[] = [];
  @Input() namiReplies: BotReply[] = [];
  @Input() isNamiPanel = false;

  @Output() openDrawer = new EventEmitter<BotReply>();

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  ngAfterViewChecked(): void {
    if (this.scrollContainer) {
      const el = this.scrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  highlightMentions(message: string): string {
    const escaped = this.escapeHtml(message);
    return escaped.replace(/(nami|peepingnami)/gi, '<span class="highlight-word">$&</span>');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}