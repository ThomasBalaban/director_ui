import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ServicesPageComponent } from './components/service-page/service-page.component';
import { SensorsPageComponent } from './components/sensors-page/sensors-page.component';
import { BrainPageComponent } from './components/brain-page/brain-page.component';

export const routes: Routes = [
  { path: '',         component: DashboardComponent },
  { path: 'services', component: ServicesPageComponent },
  { path: 'sensors',  component: SensorsPageComponent },
  { path: 'brain',    component: BrainPageComponent },
  { path: '**',       redirectTo: '' },
];