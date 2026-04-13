export type ComponentType = 
  | 'hero' 
  | 'features' 
  | 'testimonials' 
  | 'cta' 
  | 'pricing' 
  | 'gallery' 
  | 'faq' 
  | 'contact' 
  | 'stats'
  | 'team'
  | 'newsletter';

export interface PageComponent {
  id: string;
  type: ComponentType;
  settings: Record<string, any>;
  order: number;
}

export interface GlobalSettings {
  headerBgColor: string;
  headerTextColor: string;
  bodyBgColor: string;
  bodyTextColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headingFontFamily: string;
  baseFontSize: number;
  headingFontSize: number;
  lineHeight: number;
  fontWeight: number;
  containerWidth: number;
  headerHeight: number;
  sectionPadding: number;
  borderRadius: number;
  siteTitle: string;
  siteTagline: string;
  footerText: string;
  showHeader: boolean;
  showFooter: boolean;
  stickyHeader: boolean;
}

export interface PageData {
  globalSettings: GlobalSettings;
  components: PageComponent[];
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  headerBgColor: '#ffffff',
  headerTextColor: '#1f2937',
  bodyBgColor: '#ffffff',
  bodyTextColor: '#374151',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  accentColor: '#06b6d4',
  fontFamily: 'Inter',
  headingFontFamily: 'Inter',
  baseFontSize: 16,
  headingFontSize: 48,
  lineHeight: 1.6,
  fontWeight: 400,
  containerWidth: 1200,
  headerHeight: 70,
  sectionPadding: 80,
  borderRadius: 12,
  siteTitle: 'My Website',
  siteTagline: 'Building amazing experiences',
  footerText: '© 2024 My Website. All rights reserved.',
  showHeader: true,
  showFooter: true,
  stickyHeader: true
};

export interface MessagePayload {
  type: 'setting-change' | 'sync-all' | 'preview-ready' | 'element-click' | 'reset' | 'page-data' | 'scroll-to-component';
  key?: string;
  value?: any;
  settings?: GlobalSettings;
  pageData?: PageData;
  componentId?: string;
}

// Component name mapping for display
export const COMPONENT_NAMES: Record<ComponentType, string> = {
  'hero': 'Hero Section',
  'features': 'Features Grid',
  'testimonials': 'Testimonials',
  'cta': 'Call to Action',
  'pricing': 'Pricing',
  'gallery': 'Image Gallery',
  'faq': 'FAQ',
  'contact': 'Contact',
  'stats': 'Stats',
  'team': 'Team',
  'newsletter': 'Newsletter'
};
