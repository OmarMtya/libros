import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

Sentry.init({
  dsn: environment.sentryDsn,
  enabled: environment.production,
  environment: environment.production ? 'production' : 'development',
  integrations: [Sentry.browserTracingIntegration()],
  tracePropagationTargets: ['localhost', /^\/api\//, 'https://api.milibrosorpresa.com'],
  tracesSampleRate: 0.1,
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
