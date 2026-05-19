// src/app/app-config.token.ts
import { InjectionToken } from '@angular/core';

export interface AppConfig {
  subdomain: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
