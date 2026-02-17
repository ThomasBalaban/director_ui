import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdaptiveState } from '../../models/director.models';

@Component({
  selector: 'app-metrics-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">
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
          <div class="bar-bg">
            <div 
              class="bar" 
              [ngClass]="getBatteryClass()"
              [style.width.%]="adaptive?.social_battery?.percent || 100"
            ></div>
          </div>
        </div>
        
        <!-- Attention Threshold -->
        <div class="metric border-top">
          <div class="metric-header">
            <span>Attention Threshold</span>
            <span>{{ (adaptive?.threshold || 0.9).toFixed(2) }}</span>
          </div>
          <div class="bar-bg">
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
            <div class="bar-bg">
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
            <div class="bar-bg">
              <div 
                class="bar bar-yellow" 
                [style.width.%]="(adaptive?.energy || 0) * 100"
              ></div>
            </div>
          </div>
        </div>
        
        <!-- Flow Dynamics -->
        <div class="dynamics border-top">
          <h3 class="dynamics-title">🌊 Flow Dynamics</h3>
          <div class="dynamics-grid">
            <div>
              <div class="label">Current Flow</div>
              <div class="value flow">{{ flow }}</div>
            </div>
            <div>
              <div class="label">User Intent</div>
              <div class="value intent">{{ intent }}</div>
            </div>
          </div>
        </div>
        
        <!-- Prediction -->
        <div class="prediction border-top">
          <h3 class="dynamics-title">🔮 Anticipation</h3>
          <p class="prediction-text">{{ prediction }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .panel-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .state-label {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      background: #374151;
      color: #d1d5db;
    }
    
    .state-label.chaos {
      background: #7f1d1d;
      color: #fecaca;
    }
    
    .state-label.dead {
      background: #1e3a8a;
      color: #bfdbfe;
    }
    
    .metric {
      margin-bottom: 1rem;
    }
    
    .metric-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #9ca3af;
      margin-bottom: 0.25rem;
    }
    
    .bar-bg {
      width: 100%;
      height: 0.5rem;
      background: #1f2937;
      border-radius: 9999px;
      overflow: hidden;
    }
    
    .bar {
      height: 100%;
      transition: all 0.5s;
      border-radius: 9999px;
    }
    
    .bar-green { background: #22c55e; }
    .bar-yellow { background: #eab308; }
    .bar-red { background: #ef4444; }
    .bar-blue { background: #3b82f6; }
    .bar-purple { background: #a855f7; }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
    
    .border-top {
      border-top: 1px solid #374151;
      padding-top: 0.75rem;
      margin-top: 0.75rem;
    }
    
    .dynamics-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: white;
      margin-bottom: 0.5rem;
    }
    
    .dynamics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    
    .label {
      font-size: 0.625rem;
      text-transform: uppercase;
      font-weight: bold;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }
    
    .value {
      font-size: 0.875rem;
      font-weight: 500;
    }
    
    .value.flow { color: #93c5fd; }
    .value.intent { color: #c4b5fd; }
    
    .prediction-text {
      font-size: 0.875rem;
      color: #63e2b7;
      font-style: italic;
      line-height: 1.5;
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
    if (state.includes('Dead')) return 'dead';
    return '';
  }
  
  getBatteryClass(): string {
    const percent = this.adaptive?.social_battery?.percent || 100;
    if (percent < 20) return 'bar-red';
    if (percent < 50) return 'bar-yellow';
    return 'bar-green';
  }
}
