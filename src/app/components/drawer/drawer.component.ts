import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <div class="debug-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
         class="nav-btn nav-link" title="Dashboard">&#127968;</a>
      <a routerLink="/brain" routerLinkActive="active"
         class="nav-btn nav-link" title="Brain - Metrics, Graph, Memory, User">&#129504;</a>
      <div class="nav-divider"></div>
      <a routerLink="/services" routerLinkActive="active"
         class="nav-btn nav-link" title="Manage Services">&#9881;</a>
      <a routerLink="/sensors" routerLinkActive="active"
         class="nav-btn nav-link" title="Raw Sensor Feeds">&#128301;</a>
      <div class="nav-divider"></div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; display: flex;
    }
    .debug-nav {
      width: 48px; height: 100vh; background: #1a1a1a; border-right: 1px solid #333;
      display: flex; flex-direction: column; align-items: center;
      padding-top: 16px; gap: 8px; flex-shrink: 0;
    }
    .nav-btn {
      width: 36px; height: 36px; border-radius: 8px; border: 1px solid transparent;
      background: transparent; font-size: 18px; cursor: pointer; display: flex;
      align-items: center; justify-content: center; transition: background 0.15s, border-color 0.15s;
      line-height: 1; text-decoration: none; color: inherit;
    }
    .nav-btn:hover { background: #2a2a2a; border-color: #444; }
    .nav-link.active { background: rgba(34, 197, 94, 0.12); border-color: rgba(34, 197, 94, 0.5); }
    .nav-divider { width: 28px; height: 1px; background: #2a2a2a; margin: 4px 0; flex-shrink: 0; }
  `]
})
export class DrawerComponent {}