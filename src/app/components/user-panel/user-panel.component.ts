import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfile } from '../../shared/interfaces/director.interfaces';

@Component({
  selector: 'app-user-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">👤 Active User</h2>
      <div class="panel-content">

        <div *ngIf="user" class="user-card">
          <div class="user-header">
            <h3>{{ user.username }}</h3>
            <span class="tier-badge">{{ user.relationship.tier }}</span>
          </div>

          <div class="user-field">
            <span class="user-label">Nickname:</span>
            <span class="user-value">{{ user.nickname }}</span>
          </div>

          <div class="user-field">
            <span class="user-label">Role:</span>
            <span class="user-value role" [ngClass]="user.role">{{ user.role }}</span>
          </div>

          <div class="affinity">
            <span class="user-label">Affinity</span>
            <div class="bar-bg bar-bg--sm">
              <div class="bar bar-purple" [style.width.%]="user.relationship.affinity"></div>
            </div>
          </div>

          <div class="facts" *ngIf="user.facts.length">
            <strong>Known Facts:</strong>
            <ul>
              <li *ngFor="let fact of user.facts.slice(-3)">{{ fact.content }}</li>
            </ul>
          </div>
        </div>

        <p *ngIf="!user" class="empty">No active user context.</p>

      </div>
    </div>
  `,
})
export class UserPanelComponent {
  @Input() user: UserProfile | null = null;
}