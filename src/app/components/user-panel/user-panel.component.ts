import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfile } from '../../models/director.models';

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
  styles: [`
    .user-card {
      background: #202020;
      padding: 0.75rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
    }

    .user-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;

      h3 {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--text-white);
        margin: 0;
      }
    }

    .tier-badge {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--border);
      color: #bbb;
    }

    .user-field {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .user-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: block;
      margin-bottom: 0.25rem;
    }

    .user-value { color: var(--text-white); }

    .role {
      &.handler { color: #f472b6; font-weight: 600; }
      &.viewer  { color: var(--nami-teal); }
    }

    .bar-bg--sm { height: 4px; background: #374151; }

    .affinity { margin-top: 0.5rem; }

    .facts {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: #d1d5db;

      strong { display: block; margin-bottom: 0.25rem; }

      ul {
        list-style: disc;
        padding-left: 1rem;
        margin: 0;
        color: var(--text-muted);
      }

      li { margin-bottom: 0.125rem; }
    }
  `]
})
export class UserPanelComponent {
  @Input() user: UserProfile | null = null;
}