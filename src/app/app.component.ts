import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DebugDrawerComponent } from './components/debug-drawer/debug-drawer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, DebugDrawerComponent],
  template: `
    <app-debug-drawer />
    <router-outlet></router-outlet>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class AppComponent {
  title = 'Director UI';
}