import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PollingComponent } from '../../shared/polling.component';

interface PromptSection {
  role: string;
  content: string;
}

@Component({
  selector: 'app-prompt-debug',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="prompt-debug">

      <!-- Token size bar -->
      @if (promptSize()) {
        <div class="size-section">
          <div class="size-header">
            <span class="size-label">Prompt Size</span>
            <span class="size-value">{{ promptSize()!.current_tokens | number }} / {{ promptSize()!.max_tokens | number }} tokens</span>
          </div>
          <div class="size-bar-bg">
            <div
              class="size-bar-fill"
              [style.width.%]="sizePercent()"
              [class.warn]="sizePercent() > 75"
              [class.danger]="sizePercent() > 90">
            </div>
          </div>
          <div class="size-percent">{{ sizePercent().toFixed(1) }}% used</div>
        </div>
      }

      <!-- Prompt messages -->
      @if (loading()) {
        <div class="loading">Loading prompt...</div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (messages().length) {
        <div class="messages">
          @for (msg of messages(); track $index) {
            <div class="message" [class]="'role-' + msg.role">
              <div class="role-label">{{ msg.role }}</div>
              <pre class="message-content">{{ msg.content }}</pre>
            </div>
          }
        </div>
      }

      <button class="refresh-btn" (click)="poll()" [disabled]="loading()">
        ↻ Refresh
      </button>
    </div>
  `,
  styles: [`
    .prompt-debug {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .size-section {
      background: #111;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px;
    }

    .size-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .size-label {
      font-size: 0.8rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .size-value {
      font-size: 0.85rem;
      color: #e0e0e0;
      font-family: monospace;
    }

    .size-bar-bg {
      height: 6px;
      background: #2a2a2a;
      border-radius: 3px;
      overflow: hidden;
    }

    .size-bar-fill {
      height: 100%;
      background: #6366f1;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .size-bar-fill.warn { background: #f59e0b; }
    .size-bar-fill.danger { background: #ef4444; }

    .size-percent {
      font-size: 0.75rem;
      color: #666;
      margin-top: 4px;
      text-align: right;
    }

    .loading {
      color: #888;
      font-size: 0.85rem;
    }

    .error {
      color: #f87171;
      font-size: 0.85rem;
    }

    .messages {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .message {
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #333;
    }

    .role-label {
      padding: 4px 10px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .role-system .role-label { background: #1e3a5f; color: #93c5fd; }
    .role-user .role-label { background: #1a3a2a; color: #6ee7b7; }
    .role-assistant .role-label { background: #3a1a4a; color: #d8b4fe; }

    .message-content {
      background: #111;
      margin: 0;
      padding: 10px;
      font-size: 0.75rem;
      color: #ccc;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
      font-family: monospace;
      line-height: 1.5;
    }

    .refresh-btn {
      align-self: flex-start;
      background: #2a2a2a;
      border: 1px solid #444;
      color: #ccc;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .refresh-btn:hover:not(:disabled) { background: #3a3a3a; }
    .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class PromptDebugComponent extends PollingComponent {
  protected override pollingInterval = 5000;

  loading = signal(false);
  error = signal<string | null>(null);
  messages = signal<PromptSection[]>([]);
  promptSize = signal<{ current_tokens: number; max_tokens: number } | null>(null);

  sizePercent(): number {
    const s = this.promptSize();
    if (!s || !s.max_tokens) return 0;
    return (s.current_tokens / s.max_tokens) * 100;
  }

  override async poll() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [debugRes, sizeRes] = await Promise.all([
        fetch('/prompt_debug'),
        fetch('/prompt_size')
      ]);

      if (debugRes.ok) {
        const data = await debugRes.json();
        this.messages.set(Array.isArray(data) ? data : (data.messages ?? []));
      }

      if (sizeRes.ok) {
        this.promptSize.set(await sizeRes.json());
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      this.loading.set(false);
    }
  }
}