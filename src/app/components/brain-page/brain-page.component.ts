import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { DirectorState } from '../../shared/interfaces/director.interfaces';
import { MetricsPanelComponent } from '../metrics-panel/metrics-panel.component';
import { InterestGraphComponent } from '../interest-graph/interest-graph.component';
import { UserPanelComponent } from '../user-panel/user-panel.component';

@Component({
  selector: 'app-brain-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MetricsPanelComponent,
    InterestGraphComponent,
    UserPanelComponent,
  ],
  template: `
    <div class="brain-page">

      <div class="brain-header">
        <div class="brain-header-left">
          <a routerLink="/" class="back-btn">← Dashboard</a>
          <h1 class="brain-title">
            <span class="title-icon">🧠</span>
            Brain
          </h1>
          <span class="live-badge" [class.live-badge--connected]="isConnected">
            <span class="live-dot"></span>
            {{ isConnected ? 'LIVE' : 'DISCONNECTED' }}
          </span>
        </div>
      </div>

      <div class="brain-grid">

        <!-- Left column: Metrics -->
        <div class="brain-col">
          <app-metrics-panel
            [adaptive]="directorState?.adaptive || null"
            [flow]="directorState?.flow || 'Unknown'"
            [intent]="directorState?.intent || 'Unknown'"
            [prediction]="directorState?.prediction || 'Observing flow...'"
          ></app-metrics-panel>
        </div>

        <!-- Middle column: Interest Graph -->
        <div class="brain-col">
          <app-interest-graph
            [scoreHistory]="scoreHistory"
          ></app-interest-graph>
        </div>

        <!-- Right column: Active User + Memories -->
        <div class="brain-col">
          <app-user-panel
            [user]="directorState?.active_user || null"
          ></app-user-panel>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .brain-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--surface-1);
      padding: 1rem 1.5rem 1.5rem;
      box-sizing: border-box;
      overflow: hidden;
    }

    .brain-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      flex-shrink: 0;
    }

    .brain-header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .back-btn {
      color: var(--text-dim);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 4px 10px;
      border: 1px solid var(--border-faint);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    }

    .back-btn:hover {
      color: white;
      border-color: #555;
      background: var(--surface-4);
    }

    .brain-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: white;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .title-icon { font-size: 1.25rem; }

    .live-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--text-dimmer);
      background: rgba(75, 85, 99, 0.2);
      border: 1px solid var(--border-faint);
      border-radius: var(--radius-full);
      padding: 3px 10px;
    }

    .live-badge--connected {
      color: var(--accent-green-light);
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.3);
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .live-badge--connected .live-dot {
      animation: pulse-dot 1.5s ease-in-out infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.8); }
    }

    .brain-grid {
      display: grid;
      grid-template-columns: 1fr 1.5fr 1fr;
      gap: 1.25rem;
      flex: 1;
      min-height: 0;
    }

    .brain-col {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      min-height: 0;
      overflow: hidden;
    }
  `]
})
export class BrainPageComponent implements OnInit, OnDestroy {
  directorState: DirectorState | null = null;
  isConnected = false;
  scoreHistory: { score: number; source: string; text: string }[] = [];

  private subs = new Subscription();

  constructor(private directorService: DirectorService) {}

  ngOnInit(): void {
    this.subs.add(
      this.directorService.connectionStatus$.subscribe(c => this.isConnected = c)
    );
    this.subs.add(
      this.directorService.directorState$.subscribe(state => {
        if (state) this.directorState = state;
      })
    );
    this.subs.add(
      this.directorService.scoreHistory$.subscribe(h => this.scoreHistory = h)
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}