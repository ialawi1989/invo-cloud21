import { Provider } from '@angular/core';

import { BLOG_API } from './blog-api';
import { BlogHttpApi } from './blog-http-api';

/**
 * Binds the blog API token to the real HTTP implementation. Every blog
 * page injects `BLOG_API`, so this is the single place that decides which
 * implementation backs it.
 */
export const BLOG_API_PROVIDERS: Provider[] = [
  { provide: BLOG_API, useExisting: BlogHttpApi },
  BlogHttpApi,
];
