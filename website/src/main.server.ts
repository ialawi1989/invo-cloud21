import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

// Angular 21+: the SSR runtime hands `bootstrapApplication` a context
// object so it can wire its platform into each per-request render.
// Earlier versions called `bootstrap()` with no args and threw the
// generic NG0401 ("Missing Platform") error when v21 picked up the
// old signature.
const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, config, context);

export default bootstrap;
