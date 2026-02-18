import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotReply } from '../../models/director.models';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">{{ title }}</h2>
      <div class="panel-content" #scrollContainer>

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
              🚨 FILTERED ({{ reply.censorship_reason }})
            </span>
            <span class="context-hint">📄 Context</span>
          </div>
          <div *ngIf="!namiReplies.length" class="empty">No replies yet...</div>
        </ng-container>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .username        { color: var(--nami-purple); font-weight: 600; }
    .username.nami   { color: var(--nami-teal); }

    .mention-bg {
      background: rgba(169, 112, 255, 0.1);
      border-left: 3px solid var(--nami-purple);
      border-radius: 4px;
    }

    .nami-msg { background: rgba(99, 226, 183, 0.05); }

    .nami-reply {
      color: var(--nami-teal);
      cursor: pointer;
      position: relative;

      &:hover { background: rgba(99, 226, 183, 0.1); }

      &.censored {
        background: rgba(239, 68, 68, 0.2);
        border-left: 3px solid var(--accent-red);
      }
    }

    .censored-indicator {
      color: var(--accent-red);
      font-weight: 600;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }

    .context-hint {
      opacity: 0;
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-left: 0.5rem;
      transition: opacity var(--transition-normal);
    }

    .nami-reply:hover .context-hint { opacity: 1; }

    :host ::ng-deep .highlight-word {
      color: #d8b4fe;
      font-weight: 600;
      background: rgba(169, 112, 255, 0.2);
      padding: 1px 4px;
      border-radius: 4px;
    }
  `]
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