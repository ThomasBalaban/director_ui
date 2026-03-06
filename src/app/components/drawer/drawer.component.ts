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
         class="nav-btn nav-link" title="Dashboard">🏠</a>
      <a routerLink="/sensors" routerLinkActive="active"
         class="nav-btn nav-link" title="Raw Sensor Feeds"><span _ngcontent-ng-c3811861080="" class="title-icon">🔭</span></a>
      <a routerLink="/brain" routerLinkActive="active"
         class="nav-btn nav-link" title="Brain - Metrics, Graph, Memory, User"><span _ngcontent-ng-c426499138="" class="title-icon">🧠</span></a>
      <div class="nav-divider"></div>
      <a routerLink="/services" routerLinkActive="active"
         class="nav-btn nav-link" title="Manage Services">&#9881;</a>
      
    </div>
  `,
})
export class DrawerComponent {}