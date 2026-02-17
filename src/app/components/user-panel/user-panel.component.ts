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
            <span class="badge">{{ user.relationship.tier }}</span>
          </div>
          
          <div class="field">
            <span class="label">Nickname:</span>
            <span class="value">{{ user.nickname }}</span>
          </div>
          
          <div class="field">
            <span class="label">Role:</span>
            <span class="value role" [ngClass]="user.role">{{ user.role }}</span>
          </div>
          
          <div class="affinity">
            <span class="label">Affinity:</span>
            <div class="bar-bg">
              <div 
                class="bar" 
                [style.width.%]="user.relationship.affinity"
              ></div>
            </div>
          </div>
          
          <div class="facts" *ngIf="user.facts?.length">
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
      border-radius: 0.5rem;
      border: 1px solid #444;
    }
    
    .user-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    
    .user-header h3 {
      font-size: 0.875rem;
      font-weight: 700;
      color: white;
      margin: 0;
    }
    
    .badge {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: #444;
      color: #bbb;
    }
    
    .field {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-bottom: 0.25rem;
    }
    
    .field .value {
      color: white;
    }
    
    .role.handler {
      color: #f472b6;
      font-weight: 600;
    }
    
    .role.viewer {
      color: #63e2b7;
    }
    
    .affinity {
      margin-top: 0.5rem;
    }
    
    .affinity .label {
      font-size: 0.75rem;
      color: #9ca3af;
      display: block;
      margin-bottom: 0.25rem;
    }
    
    .bar-bg {
      width: 100%;
      height: 4px;
      background: #374151;
      border-radius: 9999px;
      overflow: hidden;
    }
    
    .bar {
      height: 100%;
      background: #a855f7;
      border-radius: 9999px;
      transition: width 0.3s;
    }
    
    .facts {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #444;
      font-size: 0.75rem;
      color: #d1d5db;
    }
    
    .facts strong {
      display: block;
      margin-bottom: 0.25rem;
    }
    
    .facts ul {
      list-style: disc;
      padding-left: 1rem;
      margin: 0;
      color: #9ca3af;
    }
    
    .facts li {
      margin-bottom: 0.125rem;
    }
    
    .empty {
      color: #6b7280;
      font-style: italic;
      text-align: center;
      font-size: 0.875rem;
    }
  `]
})
export class UserPanelComponent {
  @Input() user: UserProfile | null = null;
}
