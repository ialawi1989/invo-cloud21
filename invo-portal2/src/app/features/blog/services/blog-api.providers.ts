import { Provider } from '@angular/core';

import { BLOG_API } from './blog-api';
import { BlogMockApi } from './blog-mock-api';
import { BlogHttpApi } from './blog-http-api';

/**
 * Single switch between mock and real backend. Default: real HTTP — pages
 * hit `blog/*` on the same backend the rest of the app uses.
 *
 * For local UI work without a running backend, flip to the mock:
 *
 *   { provide: BLOG_API, useExisting: BlogMockApi }
 *
 * Both classes stay registered so flipping is a one-touch change.
 */
export const BLOG_API_PROVIDERS: Provider[] = [
  { provide: BLOG_API, useExisting: BlogHttpApi },
  BlogMockApi,
  BlogHttpApi,
];
