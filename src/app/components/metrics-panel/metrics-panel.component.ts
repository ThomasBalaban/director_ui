import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdaptiveState } from '../../models/director.models';

@Component({
  selector: 'app-metrics-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title metrics-title">
        <span>🎛️ Brain Metrics</span>
        <span class="state-label" [ngClass]="getStateClass()">
          {{ adaptive?.state || 'Initializing' }}
        </span>
      </h2>
      <div class="panel-content">

        <!-- Social Battery -->
        <div class="metric">
          <div class="metric-header">
            <span>Social Battery</span>
            <span>{{ adaptive?.social_battery?.percent || 100 }}%</span>
          </div>
          <div class="bar-bg bar-bg--md">
            <div
              class="bar"
              [ngClass]="getBatteryClass()"
              [style.width.%]="adaptive?.social_battery?.percent || 100"
            ></div>
          </div>
        </div>

        <!-- Attention Threshold -->
        <div class="metric section-divider">
          <div class="metric-header">
            <span>Attention Threshold</span>
            <span>{{ (adaptive?.threshold || 0.9).toFixed(2) }}</span>
          </div>
          <div class="bar-bg bar-bg--md">
            <div
              class="bar bar-blue"
              [style.width.%]="(adaptive?.threshold || 0.9) * 100"
            ></div>
          </div>
        </div>

        <!-- Velocity & Hype -->
        <div class="metrics-grid">
          <div class="metric">
            <div class="metric-header">
              <span>Velocity</span>
              <span>{{ (adaptive?.chat_velocity || 0).toFixed(1) }}/m</span>
            </div>
            <div class="bar-bg bar-bg--md">
              <div
                class="bar bar-purple"
                [style.width.%]="Math.min((adaptive?.chat_velocity || 0) / 40 * 100, 100)"
              ></div>
            </div>
          </div>

          <div class="metric">
            <div class="metric-header">
              <span>Hype</span>
              <span>{{ (adaptive?.energy || 0).toFixed(2) }}</span>
            </div>
            <div class="bar-bg bar-bg--md">
              <div
                class="bar bar-yellow"
                [style.width.%]="(adaptive?.energy || 0) * 100"
              ></div>
            </div>
          </div>
        </div>

        <!-- Flow Dynamics -->
        <div class="section-divider">
          <h3 class="sub-heading">🌊 Flow Dynamics</h3>
          <div class="dynamics-grid">
            <div>
              <div class="label-caps">Current Flow</div>
              <div class="value value--flow">{{ flow }}</div>
            </div>
            <div>
              <div class="label-caps">User Intent</div>
              <div class="value value--intent">{{ intent }}</div>
            </div>
          </div>
        </div>

        <!-- Anticipation -->
        <div class="section-divider">
          <h3 class="sub-heading">🔮 Anticipation</h3>
          <p class="prediction-text">{{ prediction }}</p>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .metrics-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .state-label {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);
      background: #374151;
      color: #d1d5db;

      &.chaos { background: #7f1d1d; color: var(--accent-red-pale); }
      &.dead  { background: #1e3a8a; color: #bfdbfe; }
    }

    .metric { margin-bottom: 1rem; }

    .bar-bg--md { height: 0.5rem; background: #1f2937; }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .dynamics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .sub-heading {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-white);
      margin: 0 0 0.5rem;
    }

    .value {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .prediction-text {
      font-size: 0.875rem;
      color: var(--nami-teal);
      font-style: italic;
      line-height: 1.5;
      margin: 0;
    }
  `]
})
export class MetricsPanelComponent {
  @Input() adaptive: AdaptiveState | null = null;
  @Input() flow = 'Unknown';
  @Input() intent = 'Unknown';
  @Input() prediction = 'Observing flow...';

  Math = Math;

  getStateClass(): string {
    const state = this.adaptive?.state || '';
    if (state.includes('Chaos')) return 'chaos';
    if (state.includes('Dead'))  return 'dead';
    return '';
  }

  getBatteryClass(): string {
    const percent = this.adaptive?.social_battery?.percent || 100;
    if (percent < 20) return 'bar-red';
    if (percent < 50) return 'bar-yellow';
    return 'bar-green';
  }
}