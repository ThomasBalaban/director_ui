import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DirectorService } from '../../shared/services/director.service';
import { DirectorState } from '../../shared/interfaces/director.interfaces';
import { MetricsPanelComponent } from '../panels/metrics-panel/metrics-panel.component';
import { InterestGraphComponent } from '../panels/interest-graph/interest-graph.component';
import { BasePanelComponent } from '../panels/base-panel/base-panel.component';

@Component({
  selector: 'app-brain-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MetricsPanelComponent,
    InterestGraphComponent,
    BasePanelComponent,
  ],
  styleUrl: 'brain-page.component.scss',
  templateUrl: 'brain-page.component.html',
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