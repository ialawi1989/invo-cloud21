import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';

import { environment } from '../../../../environments/environment';
import { BlogPost } from '../models/blog.types';

export interface SeoConfig {
  title:       string;
  description: string;
  url:         string;
  image?:      string | null;
  type?:       'website' | 'article' | 'profile';
  locale?:     string;
  noindex?:    boolean;
  hreflang?:   { lang: string; url: string }[];
  rss?:        string;
  publishedAt?: string;
  modifiedAt?:  string;
  author?:     string;
  siteName?:   string;
}

/**
 * Centralised <head> management. We use `Title`/`Meta` from
 * `@angular/platform-browser` so both SSR and CSR write to the
 * server's response or the live DOM respectively. Hreflang and
 * JSON-LD are managed manually because Meta only handles <meta>
 * tags, not <link> / <script>.
 *
 * On each call we *replace* (not append) — every page route should
 * call `apply()` once on mount to ensure stale tags from the
 * previous page don't leak through during client-side navigation.
 */
@Injectable({ providedIn: 'root' })
export class BlogSeoService {
  private meta  = inject(Meta);
  private title = inject(Title);
  private doc   = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  apply(cfg: SeoConfig): void {
    this.title.setTitle(cfg.title);

    const ogLocale = cfg.locale ? this.toOgLocale(cfg.locale) : 'en_US';
    const og: Record<string, string | undefined> = {
      'description': cfg.description,
      'robots':      cfg.noindex ? 'noindex, nofollow' : 'index, follow',

      'og:title':       cfg.title,
      'og:description': cfg.description,
      'og:url':         cfg.url,
      'og:type':        cfg.type ?? 'website',
      'og:image':       cfg.image ?? undefined,
      'og:locale':      ogLocale,
      'og:site_name':   cfg.siteName ?? environment.siteName,

      'twitter:card':        cfg.image ? 'summary_large_image' : 'summary',
      'twitter:title':       cfg.title,
      'twitter:description': cfg.description,
      'twitter:image':       cfg.image ?? undefined,
    };

    if (cfg.type === 'article') {
      og['article:published_time'] = cfg.publishedAt;
      og['article:modified_time']  = cfg.modifiedAt;
      og['article:author']         = cfg.author;
    }

    for (const [name, content] of Object.entries(og)) {
      if (content == null) {
        this.meta.removeTag(`name='${name}'`);
        this.meta.removeTag(`property='${name}'`);
        continue;
      }
      if (name.startsWith('og:') || name.startsWith('article:')) {
        this.meta.updateTag({ property: name, content });
      } else {
        this.meta.updateTag({ name, content });
      }
    }

    this.setLink('canonical', cfg.url);
    this.setHreflang(cfg.hreflang ?? []);
    if (cfg.rss) this.setAlternate('application/rss+xml', cfg.rss);
  }

  applyForPost(post: BlogPost, lang: string, fullUrl: string, rssUrl?: string): void {
    this.apply({
      title:       post.seo?.title       || post.title,
      description: post.seo?.description || post.excerpt,
      url:         post.seo?.canonical   || fullUrl,
      image:       post.seo?.ogImage     || post.coverImage,
      type:        'article',
      locale:      lang,
      hreflang:    post.seo?.hreflangAlternates,
      rss:         rssUrl,
      publishedAt: post.publishDate,
      modifiedAt:  post.modifiedAt ?? post.publishDate,
      author:      post.author?.name,
    });
    this.setJsonLd([
      this.articleJsonLd(post, fullUrl, lang),
      this.breadcrumbJsonLd(post, lang),
    ]);
  }

  setJsonLd(blocks: object[]): void {
    if (!this.doc) return;
    const head = this.doc.head;
    const existing = head.querySelectorAll('script[data-blog-jsonld]');
    existing.forEach(n => n.remove());
    for (const block of blocks) {
      const s = this.doc.createElement('script');
      s.setAttribute('type', 'application/ld+json');
      s.setAttribute('data-blog-jsonld', '');
      s.textContent = JSON.stringify(block);
      head.appendChild(s);
    }
  }

  setLangAndDir(lang: string, rtl: boolean): void {
    if (!this.doc) return;
    const html = this.doc.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  }

  /** Wipe all tags this service might have set. Useful between routes
   *  if a page wants a known-clean baseline. */
  reset(): void {
    if (!this.doc) return;
    this.doc.head.querySelectorAll('link[data-blog-hreflang]').forEach(n => n.remove());
    this.doc.head.querySelectorAll('script[data-blog-jsonld]').forEach(n => n.remove());
  }

  private setLink(rel: string, href: string): void {
    if (!this.doc) return;
    let link = this.doc.head.querySelector<HTMLLinkElement>(`link[rel='${rel}']:not([data-blog-hreflang])`);
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', rel);
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private setAlternate(type: string, href: string): void {
    if (!this.doc) return;
    let link = this.doc.head.querySelector<HTMLLinkElement>(`link[rel='alternate'][type='${type}']`);
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('type', type);
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private setHreflang(alts: { lang: string; url: string }[]): void {
    if (!this.doc) return;
    this.doc.head.querySelectorAll('link[data-blog-hreflang]').forEach(n => n.remove());
    for (const { lang, url } of alts) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', lang);
      link.setAttribute('href', url);
      link.setAttribute('data-blog-hreflang', '');
      this.doc.head.appendChild(link);
    }
  }

  private toOgLocale(lang: string): string {
    const map: Record<string, string> = {
      en: 'en_US', ar: 'ar_AR', he: 'he_IL', fa: 'fa_IR', ur: 'ur_PK',
      fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT', pt: 'pt_BR',
      tr: 'tr_TR', ru: 'ru_RU', zh: 'zh_CN', ja: 'ja_JP', ko: 'ko_KR',
    };
    return map[lang] ?? `${lang}_${lang.toUpperCase()}`;
  }

  private articleJsonLd(post: BlogPost, url: string, lang: string): object {
    return {
      '@context': 'https://schema.org',
      '@type':    'BlogPosting',
      'headline': post.title,
      'image':    post.coverImage ? [post.coverImage] : undefined,
      'datePublished': post.publishDate,
      'dateModified':  post.modifiedAt ?? post.publishDate,
      'author': post.author ? {
        '@type': 'Person',
        'name':  post.author.name,
        'image': post.author.image ?? undefined,
      } : undefined,
      'publisher': {
        '@type': 'Organization',
        'name':  environment.siteName,
      },
      'mainEntityOfPage': { '@type': 'WebPage', '@id': url },
      'description': post.excerpt,
      'inLanguage':  lang,
    };
  }

  private breadcrumbJsonLd(post: BlogPost, lang: string): object {
    const main = post.categories.find(c => c.isMain) ?? post.categories[0];
    const origin = environment.siteOrigin || (this.isBrowser ? window.location.origin : '');
    const items: { name: string; url: string }[] = [
      { name: 'Home', url: `${origin}/${lang}` },
      { name: 'Blog', url: `${origin}/${lang}/blog` },
    ];
    if (main) items.push({ name: main.name, url: `${origin}/${lang}/blog/category/${main.slug}` });
    items.push({ name: post.title, url: `${origin}/${lang}/blog/${post.slug}` });
    return {
      '@context': 'https://schema.org',
      '@type':    'BreadcrumbList',
      'itemListElement': items.map((it, i) => ({
        '@type':    'ListItem',
        'position': i + 1,
        'name':     it.name,
        'item':     it.url,
      })),
    };
  }
}
