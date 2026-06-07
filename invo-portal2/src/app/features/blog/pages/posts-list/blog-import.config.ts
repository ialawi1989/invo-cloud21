import { TranslateService } from '@ngx-translate/core';

import type { BlogApi } from '../../services/blog-api';
import type { ImportWizardConfig, ImportRow } from '@shared/components/import-wizard/import-wizard.types';

/**
 * Config for the shared `<app-import-wizard>` that imports blog posts.
 * The wizard parses the pasted CSV / uploaded file into rows keyed by the
 * `columns` below; `submit` maps them to the backend's JSON import shape
 * (`POST blog/importPosts { source:'json', posts:[…] }`).
 */
export function buildBlogImportConfig(opts: {
  api: BlogApi;
  translate: TranslateService;
  defaultLang: string;
}): ImportWizardConfig {
  const { api, translate, defaultLang } = opts;
  const t = (k: string) => translate.instant(k);
  const split = (v?: string) =>
    (v ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean);

  return {
    title: t('BLOG.LIST.MA_IMPORT'),
    hint:  t('BLOG.IMPORT.HINT'),
    templateName: 'blog-posts',
    columns: [
      { key: 'title',      label: t('BLOG.IMPORT.COL_TITLE') },
      { key: 'language',   label: t('BLOG.IMPORT.COL_LANGUAGE') },
      { key: 'status',     label: t('BLOG.IMPORT.COL_STATUS') },
      { key: 'slug',       label: t('BLOG.IMPORT.COL_SLUG') },
      { key: 'excerpt',    label: t('BLOG.IMPORT.COL_EXCERPT') },
      { key: 'content',    label: t('BLOG.IMPORT.COL_CONTENT') },
      { key: 'categories', label: t('BLOG.IMPORT.COL_CATEGORIES') },
      { key: 'tags',       label: t('BLOG.IMPORT.COL_TAGS') },
    ],
    templateRows: [
      ['title', 'language', 'status', 'slug', 'excerpt', 'content', 'categories', 'tags'],
      ['My first post', defaultLang || 'en', 'draft', 'my-first-post', 'A short teaser', '<p>Post body…</p>', 'News, Updates', 'launch'],
    ],
    validate: (cells: ImportRow) => {
      const errors: string[] = [];
      if (!cells['title']?.trim()) errors.push(t('BLOG.IMPORT.ERR_TITLE'));
      return { errors };
    },
    duplicateKey: (cells: ImportRow) => (cells['slug'] || cells['title'] || '').toLowerCase(),
    async submit(rows: ImportRow[]) {
      const posts = rows.map(r => {
        const lang = (r['language'] || defaultLang || 'en').trim();
        return {
          defaultLanguage: lang,
          status: (r['status'] || 'draft').trim(),
          translations: {
            [lang]: {
              title:   r['title'] ?? '',
              slug:    r['slug'] ?? '',
              excerpt: r['excerpt'] ?? '',
              content: r['content'] ?? '',
            },
          },
          taxonomyNames: { categories: split(r['categories']), tags: split(r['tags']) },
        };
      });
      try {
        const res = await api.importPosts({ source: 'json', posts });
        return {
          ok: true,
          result: {
            total:      rows.length,
            successful: res.imported ?? rows.length,
            failed:     res.failed ?? 0,
            skipped:    rows.length - (res.imported ?? rows.length) - (res.failed ?? 0),
          },
        };
      } catch (e: any) {
        return { ok: false, msg: e?.message || t('COMMON.SAVE_FAILED') };
      }
    },
    notes: {
      sections: [
        { title: 'BLOG.IMPORT.GUIDE_TITLE', items: ['BLOG.IMPORT.GUIDE_1', 'BLOG.IMPORT.GUIDE_2', 'BLOG.IMPORT.GUIDE_3'] },
      ],
    },
  };
}
