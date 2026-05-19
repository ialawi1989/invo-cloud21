/**
 * Minimal in-bundle i18n for the public blog. Keys are looked up by
 * language code with English fallback. Add a new language by adding
 * its dictionary below — pages call `t(lang, 'key')` directly.
 *
 * For copy that comes from the backend (post titles, category names,
 * etc.) the backend resolves the language itself — these strings are
 * UI chrome only.
 */

type Dict = Record<string, string>;

const EN: Dict = {
  'blog':              'Blog',
  'all_posts':         'All Posts',
  'search':            'Search',
  'search_placeholder': 'Search the blog…',
  'showing_results':   'Showing {n} results for "{q}"',
  'no_results':        'No results found',
  'no_results_hint':   'Try fewer or different keywords.',
  'no_posts':          'No posts yet',
  'home':              'Home',
  'load_more':         'Load more',
  'next':              'Next',
  'previous':          'Previous',
  'page':              'Page',
  'min_read':          'min read',
  'featured':          'Featured',
  'comments':          'Comments',
  'comments_count':    '{n} Comments',
  'no_comments':       'No comments yet. Be the first to share your thoughts.',
  'post_comment':      'Post comment',
  'reply':             'Reply',
  'edit':              'Edit',
  'save':              'Save',
  'cancel':            'Cancel',
  'delete':            'Delete',
  'pending_approval':  'Pending approval',
  'comment_deleted':   '[Comment deleted]',
  'sign_in_to_comment': 'Please sign in to leave a comment.',
  'sign_in':           'Sign in',
  'sign_up':           'Sign up',
  'sign_out':          'Sign out',
  'email':             'Email',
  'password':          'Password',
  'your_name':         'Your name',
  'tags':              'Tags',
  'related_posts':     'Related Posts',
  'read_more_by':      'Read more posts by {name}',
  'newest':            'Newest',
  'oldest':            'Oldest',
  'sort_by':           'Sort by',
  'share':             'Share',
  'copy_link':         'Copy link',
  'link_copied':       'Link copied to clipboard',
  'back_to_blog':      'Back to all posts',
  'posts_tagged':      'Posts tagged #{tag}',
  'category':          'Category',
  'tag':               'Tag',
  'author':            'Author',
  'views':             '{n} views',
  '404_title':         'Post not found',
  '404_body':          'The page you were looking for could not be found.',
  'error_title':       'Something went wrong',
  'error_body':        'Please refresh the page or try again later.',
  'retry':             'Retry',
  'customer':          'Customer',
  'staff':             'Staff',
  'subscribe_rss':     'Subscribe to RSS',
  'write_a_comment':   'Write a comment…',
  'reply_to':          'Reply to {name}',
  'fallback_notice':   'This article isn’t available in your language yet — showing the {lang} version instead.',
  'rate_limited':      'You’re posting too quickly — please try again in a moment.',
};

const AR: Dict = {
  'blog':              'المدونة',
  'all_posts':         'جميع المقالات',
  'search':            'بحث',
  'search_placeholder': 'ابحث في المدونة…',
  'showing_results':   'عرض {n} نتيجة لـ "{q}"',
  'no_results':        'لا توجد نتائج',
  'no_results_hint':   'حاول استخدام كلمات مفتاحية أقل أو مختلفة.',
  'no_posts':          'لا توجد مقالات بعد',
  'home':              'الرئيسية',
  'load_more':         'تحميل المزيد',
  'next':              'التالي',
  'previous':          'السابق',
  'page':              'صفحة',
  'min_read':          'دقيقة قراءة',
  'featured':          'مميّز',
  'comments':          'التعليقات',
  'comments_count':    '{n} تعليقات',
  'no_comments':       'لا توجد تعليقات بعد. كن أول من يشارك رأيه.',
  'post_comment':      'نشر التعليق',
  'reply':             'رد',
  'edit':              'تعديل',
  'save':              'حفظ',
  'cancel':            'إلغاء',
  'delete':            'حذف',
  'pending_approval':  'في انتظار الموافقة',
  'comment_deleted':   '[تم حذف التعليق]',
  'sign_in_to_comment': 'الرجاء تسجيل الدخول لإضافة تعليق.',
  'sign_in':           'تسجيل الدخول',
  'sign_up':           'إنشاء حساب',
  'sign_out':          'تسجيل الخروج',
  'email':             'البريد الإلكتروني',
  'password':          'كلمة المرور',
  'your_name':         'الاسم',
  'tags':              'الوسوم',
  'related_posts':     'مقالات ذات صلة',
  'read_more_by':      'اقرأ المزيد من مقالات {name}',
  'newest':            'الأحدث',
  'oldest':            'الأقدم',
  'sort_by':           'ترتيب حسب',
  'share':             'مشاركة',
  'copy_link':         'نسخ الرابط',
  'link_copied':       'تم نسخ الرابط',
  'back_to_blog':      'العودة إلى المقالات',
  'posts_tagged':      'مقالات موسومة بـ #{tag}',
  'category':          'تصنيف',
  'tag':               'وسم',
  'author':            'الكاتب',
  'views':             '{n} مشاهدة',
  '404_title':         'الصفحة غير موجودة',
  '404_body':          'لم نتمكن من العثور على الصفحة التي تبحث عنها.',
  'error_title':       'حدث خطأ ما',
  'error_body':        'يرجى تحديث الصفحة أو المحاولة لاحقاً.',
  'retry':             'إعادة المحاولة',
  'customer':          'عميل',
  'staff':             'موظف',
  'subscribe_rss':     'اشترك في RSS',
  'write_a_comment':   'اكتب تعليقاً…',
  'reply_to':          'الرد على {name}',
  'fallback_notice':   'هذه المقالة غير متوفرة بلغتك بعد — يتم عرض النسخة بلغة {lang}.',
  'rate_limited':      'أنت تنشر بسرعة كبيرة — يرجى المحاولة بعد لحظات.',
};

const DICTS: Record<string, Dict> = { en: EN, ar: AR };

/** Native names shown in the language switcher. Falls back to the
 *  ISO code if no native name is registered. */
export const NATIVE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  he: 'עברית',
  fa: 'فارسی',
  ur: 'اردو',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  tr: 'Türkçe',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
};

export function t(lang: string, key: string, vars: Record<string, string | number> = {}): string {
  const dict = DICTS[lang] ?? EN;
  let s = dict[key] ?? EN[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return s;
}

export function nativeLanguageName(code: string): string {
  return NATIVE_NAMES[code] ?? code.toUpperCase();
}

/** Locale-aware date format. Falls back gracefully if Intl chokes on
 *  an unknown lang tag. */
export function formatDate(lang: string, iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
  } catch {
    return new Date(iso).toDateString();
  }
}

export function formatNumber(lang: string, n: number): string {
  try { return new Intl.NumberFormat(lang).format(n); }
  catch { return String(n); }
}
