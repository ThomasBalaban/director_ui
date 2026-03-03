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
})
export class DrawerComponent {}