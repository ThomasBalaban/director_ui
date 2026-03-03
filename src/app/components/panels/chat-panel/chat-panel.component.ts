import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotReply } from '../../../shared/interfaces/director.interfaces';
import { BasePanelComponent } from '../base-panel/base-panel.component';

// Define this interface to keep the code clean
interface ChatMsg {
  username: string;
  message: string;
  isNami?: boolean;
  isMention?: boolean;
}

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, BasePanelComponent],
  styleUrl: 'chat-panel.component.scss',
  template: `
    <app-base-panel [title]="title()">
      <div class="chat-scroll">

        <ng-container *ngIf="!isNamiPanel()">
          <div
            *ngFor="let msg of reversedMessages()"
            class="log-line"
            [class.mention-bg]="msg.isMention"
            [class.nami-msg]="msg.isNami"
          >
            <span class="username" [class.nami]="msg.isNami">{{ msg.username }}:</span>
            <span [innerHTML]="highlightMentions(msg.message)"></span>
          </div>
          <div *ngIf="!reversedMessages().length" class="empty">No messages yet...</div>
        </ng-container>

        <ng-container *ngIf="isNamiPanel()">
          <div
            *ngFor="let reply of reversedReplies()"
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
          <div *ngIf="!reversedReplies().length" class="empty">No replies yet...</div>
        </ng-container>

      </div>
    </app-base-panel>
  `,
})
export class ChatPanelComponent {
  // Converted to input signals
  title = input<string>('Chat');
  isNamiPanel = input<boolean>(false);
  
  // Raw inputs
  messages = input<ChatMsg[]>([]);
  namiReplies = input<BotReply[]>([]);

  // Computed signals automatically run only when the array actually changes,
  // making rendering much more efficient!
  reversedMessages = computed(() => [...this.messages()].reverse());
  reversedReplies = computed(() => [...this.namiReplies()].reverse());

  // Converted to output signal
  openDrawer = output<BotReply>();

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