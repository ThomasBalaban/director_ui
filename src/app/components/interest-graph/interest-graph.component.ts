import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-interest-graph',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <h2 class="panel-title">📈 Interest Graph</h2>
      <div class="panel-content graph-content">
        <div class="chart-container">
          <canvas #chartCanvas></canvas>
        </div>
        <pre class="score-log">{{ logText }}</pre>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .graph-content {
      display: flex;
      flex-direction: column;
    }

    .chart-container {
      flex: 1;
      position: relative;
      min-height: 120px;

      canvas {
        position: absolute;
        top: 0; left: 0;
        width: 100%;
        height: 100%;
      }
    }

    .score-log {
      font-size: 0.75rem;
      color: var(--text-muted);
      flex: none;
      height: 8rem;
      overflow-y: auto;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border);
      margin-top: 0.5rem;
      white-space: pre-wrap;
    }
  `]
})
export class InterestGraphComponent implements AfterViewInit, OnChanges {
  @Input() scoreHistory: { score: number; source: string; text: string }[] = [];
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  logText = '[Waiting for scores...]';

  ngAfterViewInit(): void {
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scoreHistory'] && this.chart) {
      this.updateChart();
    }
  }

  private initChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Interest Score',
          data: [],
          borderColor: '#63e2b7',
          backgroundColor: 'rgba(99, 226, 183, 0.2)',
          tension: 0.3,
          pointRadius: 2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
          y: {
            min: 0.0,
            max: 1.0,
            ticks: { color: '#e0e0e0' },
            grid: { color: '#444' }
          },
          x: { display: false }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  private updateChart(): void {
    if (!this.chart) return;

    this.chart.data.labels   = this.scoreHistory.map(() => '');
    this.chart.data.datasets[0].data = this.scoreHistory.map(s => s.score);
    this.chart.update('none');

    const recentItems = this.scoreHistory.slice(-10).reverse();
    this.logText = recentItems
      .map(s => `${s.score.toFixed(2)} - ${s.source}: ${s.text.substring(0, 30)}...`)
      .join('\n') || '[Waiting for scores...]';
  }
}