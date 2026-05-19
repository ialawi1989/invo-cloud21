import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Browser-side, tenant-aware base URL resolver. Matches oldEco's
 * AppConfigService — kept thin on purpose so consumer code can pick
 * up the proxied path without threading the subdomain through every
 * call site.
 *
 *   `${baseUrl}${subdomain}/...` →  `./v1/ecommerce/<slug>/...`
 *
 * The SSR Express layer rewrites `./v1` to the real backend, so the
 * browser bundle never embeds the upstream URL.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  baseUrl = `${environment.BASE_URL}/ecommerce/`;
  isInitialized = false;
}
