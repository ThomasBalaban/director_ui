import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThreadStatsComponent } from '../thread-stats/thread-stats.component';
import { PromptDebugComponent } from '../prompt-debug/prompt-debug.component';

type DrawerPanel = 'thread-stats' | 'prompt-debug' | null;

@Component({
  selector: 'app-debug-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ThreadStatsComponent, PromptDebugComponent],
  template: `
    <!-- Left nav bar -->
    <div class="debug-nav">

      <!-- Home -->
      <a
        routerLink="/"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        class="nav-btn nav-link"
        title="Dashboard">
        🏠
      </a>

      <!-- Services -->
      <a
        routerLink="/services"
        routerLinkActive="active"
        class="nav-btn nav-link"
        title="Manage Services">
        ⚙
      </a>

      <div class="nav-divider"></div>

      <!-- Panel toggles -->
      <button
        class="nav-btn"
        [class.active]="activePanel() === 'thread-stats'"
        (click)="toggle('thread-stats')"
        title="Thread Stats">
        🧵
      </button>
      <button
        class="nav-btn"
        [class.active]="activePanel() === 'prompt-debug'"
        (click)="toggle('prompt-debug')"
        title="Prompt Debug">
        🔍
      </button>
    </div>

    <!-- Drawer overlay -->
    @if (activePanel()) {
      <div class="drawer-overlay" (click)="close()"></div>
      <div class="drawer-panel">
        <div class="drawer-header">
          <span class="drawer-title">{{ drawerTitle() }}</span>
          <button class="drawer-close" (click)="close()">✕</button>
        </div>
        <div class="drawer-content">
          @if (activePanel() === 'thread-stats') {
            <app-thread-stats />
          }
          @if (activePanel() === 'prompt-debug') {
            <app-prompt-debug />
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 100;
      display: flex;
    }

    .debug-nav {
      width: 48px;
      height: 100vh;
      background: #1a1a1a;
      border-right: 1px solid #333;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 16px;
      gap: 8px;
      flex-shrink: 0;
    }

    .nav-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, border-color 0.15s;
      line-height: 1;
      text-decoration: none;
      color: inherit;
    }

    .nav-btn:hover {
      background: #2a2a2a;
      border-color: #444;
    }

    .nav-btn.active {
      background: #2a2a2a;
      border-color: #6366f1;
    }

    /* Services link uses a teal accent when active */
    .nav-link.active {
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(34, 197, 94, 0.5);
    }

    .nav-divider {
      width: 28px;
      height: 1px;
      background: #2a2a2a;
      margin: 4px 0;
      flex-shrink: 0;
    }

    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: transparent;
      z-index: 101;
    }

    .drawer-panel {
      position: fixed;
      top: 0;
      left: 48px;
      width: 480px;
      height: 100vh;
      background: #1e1e1e;
      border-right: 1px solid #444;
      z-index: 102;
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 24px rgba(0,0,0,0.5);
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from { transform: translateX(-100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.25rem;
      height: 56px;
      border-bottom: 1px solid #444;
      background: #2a2a2a;
      flex-shrink: 0;
    }

    .drawer-title {
      font-weight: 600;
      color: #fff;
      font-size: 0.9rem;
    }

    .drawer-close {
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }

    .drawer-close:hover {
      color: #fff;
      background: #3a3a3a;
    }

    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
    }
  `]
})
export class DebugDrawerComponent {
  activePanel = signal<DrawerPanel>(null);

  toggle(panel: DrawerPanel) {
    this.activePanel.update(current => current === panel ? null : panel);
  }

  close() {
    this.activePanel.set(null);
  }

  drawerTitle(): string {
    switch (this.activePanel()) {
      case 'thread-stats': return '🧵 Thread Stats';
      case 'prompt-debug': return '🔍 Prompt Debug';
      default: return '';
    }
  }
}