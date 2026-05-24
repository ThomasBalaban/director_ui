import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

class LoudErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    console.error(
      '%c[Angular ErrorHandler]',
      'background:#7f1d1d;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;',
      error,
    );
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: ErrorHandler, useClass: LoudErrorHandler },
  ]
};
