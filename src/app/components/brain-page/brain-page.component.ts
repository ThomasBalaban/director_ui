import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { DirectorState } from '../../shared/interfaces/director.interfaces';
import { MetricsPanelComponent } from '../panels/metrics-panel/metrics-panel.component';
import { InterestGraphComponent } from '../panels/interest-graph/interest-graph.component';
import { UserPanelComponent } from '../panels/user-panel/user-panel.component';

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
    <div class="page">

      <div class="page-header">
        <div class="page-header-left">
          <a routerLink="/" class="back-btn">← Dashboard</a>
          <h1 class="page-title">
            <span class="title-icon">🧠</span>
            Brain
          </h1>
          <span class="live-badge" [class.live-badge--connected]="isConnected">
            <span class="live-dot"></span>
            {{ isConnected ? 'LIVE' : 'DISCONNECTED' }}
          </span>
        </div>
      </div>

      <div class="page-content">
        <div class="page-grid page-grid-brain">
          <!-- Left column: Metrics -->
          <div class="page-col">
            <app-metrics-panel
              [adaptive]="directorState?.adaptive || null"
              [flow]="directorState?.flow || 'Unknown'"
              [intent]="directorState?.intent || 'Unknown'"
              [prediction]="directorState?.prediction || 'Observing flow...'"
            ></app-metrics-panel>
          </div>

          <!-- Middle column: Interest Graph -->
          <div class="page-col">
            <app-interest-graph
              [scoreHistory]="scoreHistory"
            ></app-interest-graph>
          </div>

          <!-- Right column: Active User + Memories -->
          <div class="page-col">
            <app-user-panel
              [user]="directorState?.active_user || null"
            ></app-user-panel>
          </div>
        </div>
      </div>
    </div>
  `,
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