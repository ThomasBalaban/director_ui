import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ServicesPageComponent } from './components/service-page/service-page.component';

export const routes: Routes = [
  { path: '',        component: DashboardComponent },
  { path: 'services', component: ServicesPageComponent },
  { path: '**',      redirectTo: '' },
];