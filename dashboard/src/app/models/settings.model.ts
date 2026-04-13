// ============================================
// COMPONENT TYPES
// ============================================

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
  | 'newsletter'
  | 'products'
  | 'categories'
  | 'banner'
  | 'about';

export interface PageComponent {
  id: string;
  type: ComponentType;
  settings: Record<string, any>;
  order: number;
}

export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  icon: string;
  description: string;
  defaultSettings: Record<string, any>;
  settingsSchema: SettingField[];
}

export interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'number' | 'select' | 'toggle' | 'range' | 'image';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

// ============================================
// THEME SYSTEM INTERFACES
// ============================================

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: ThemeCategory;
  isPremium: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  buttons: ThemeButtons;
  inputs: ThemeInputs;
  header: ThemeHeader;
  footer: ThemeFooter;
  productCards: ThemeProductCards;
  layout: ThemeLayout;
  background: ThemeBackground;
}

export type ThemeCategory = 
  | 'minimal' 
  | 'modern' 
  | 'classic' 
  | 'bold' 
  | 'elegant' 
  | 'playful'
  | 'dark'
  | 'ecommerce';

export interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
}

export interface ThemeTypography {
  headingFontFamily: string;
  bodyFontFamily: string;
  headingFontWeight: number;
  bodyFontWeight: number;
  headingFontSizeScale: number;
  bodyFontSizeScale: number;
  lineHeight: number;
  letterSpacing: number;
}

export interface ThemeButtons {
  fontColor: string;
  backgroundColor: string;
  borderColor: string;
  borderThickness: number;
  borderCornerRadius: number;
  shadowBlur: number;
  shadowOpacity: number;
  shadowVerticalOffset: number;
  shadowHorizontalOffset: number;
  hoverStyle: 'darken' | 'lighten' | 'scale' | 'glow' | 'outline';
}

export interface ThemeInputs {
  backgroundColor: string;
  borderColor: string;
  borderThickness: number;
  borderCornerRadius: number;
  shadowBlur: number;
  shadowOpacity: number;
  focusBorderColor: string;
}

export interface ThemeHeader {
  style: 'Style 1' | 'Style 2' | 'Style 3' | 'Style 4';
  backgroundColor: string;
  textColor: string;
  logoWidth: number;
  menuAlignment: 'Left' | 'Center' | 'Right';
  menuTextColor: string;
  menuBackgroundColor: string;
  showWishList: boolean;
  showContactPhone: boolean;
  showWelcomeMessage: boolean;
  borderBottomThickness: number;
  isSticky: boolean;
  isTransparent: boolean;
}

export interface ThemeFooter {
  style: 'Style 1' | 'Style 2' | 'Style 3' | 'Style 4';
  backgroundColor: string;
  textColor: string;
  logoWidth: number;
  showTopLink: boolean;
  showQuickLink: boolean;
  showContactInfo: boolean;
  showSocialMedia: boolean;
  showNewsletter: boolean;
  showCopyRightsReserved: boolean;
  columnsLayout: '2' | '3' | '4' | '5';
}

export interface ThemeProductCards {
  style: 'Standard' | 'Minimal' | 'Card' | 'Overlay' | 'Magazine';
  backgroundColor: string;
  borderColor: string;
  borderThickness: number;
  borderCornerRadius: number;
  shadowBlur: number;
  shadowOpacity: number;
  imagePadding: number;
  textAlignment: 'Left' | 'Center' | 'Right';
  showQuickView: boolean;
  showAddToCart: boolean;
  showWishlist: boolean;
  hoverEffect: 'none' | 'zoom' | 'slide' | 'fade' | 'overlay';
}

export interface ThemeLayout {
  width: 'Full' | 'Boxed' | 'Wide';
  containerMaxWidth: number;
  sectionPadding: number;
  componentGap: number;
}

export interface ThemeBackground {
  style: 'Color' | 'Gradient' | 'Image' | 'Pattern';
  isParallax: boolean;
  showOverlay: boolean;
  overlayColor: string;
  overlayOpacity: number;
  gradientAngle?: number;
  gradientColors?: string[];
  patternType?: 'dots' | 'lines' | 'grid' | 'waves';
}

export interface HomepageTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: 'landing' | 'ecommerce' | 'portfolio' | 'blog' | 'corporate' | 'startup';
  components: PageComponent[];
  recommendedThemes: string[];
}

// ============================================
// GLOBAL SETTINGS
// ============================================

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
  activeThemeId?: string;
  activeHomepageId?: string;
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

// ============================================
// THEME PRESETS
// ============================================

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    description: 'Clean and simple with lots of white space',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop',
    category: 'minimal',
    isPremium: false,
    colors: {
      primaryColor: '#000000',
      secondaryColor: '#6b7280',
      accentColor: '#3b82f6',
      backgroundColor: '#ffffff',
      surfaceColor: '#f9fafb',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#9ca3af',
      borderColor: '#e5e7eb',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      errorColor: '#ef4444'
    },
    typography: {
      headingFontFamily: 'DM Sans',
      bodyFontFamily: 'DM Sans',
      headingFontWeight: 700,
      bodyFontWeight: 400,
      headingFontSizeScale: 120,
      bodyFontSizeScale: 100,
      lineHeight: 1.6,
      letterSpacing: -0.02
    },
    buttons: {
      fontColor: '#ffffff',
      backgroundColor: '#000000',
      borderColor: '#000000',
      borderThickness: 0,
      borderCornerRadius: 4,
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowVerticalOffset: 0,
      shadowHorizontalOffset: 0,
      hoverStyle: 'darken'
    },
    inputs: {
      backgroundColor: '#ffffff',
      borderColor: '#d1d5db',
      borderThickness: 1,
      borderCornerRadius: 4,
      shadowBlur: 0,
      shadowOpacity: 0,
      focusBorderColor: '#000000'
    },
    header: {
      style: 'Style 1',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      logoWidth: 120,
      menuAlignment: 'Right',
      menuTextColor: '#374151',
      menuBackgroundColor: '#ffffff',
      showWishList: true,
      showContactPhone: false,
      showWelcomeMessage: false,
      borderBottomThickness: 1,
      isSticky: true,
      isTransparent: false
    },
    footer: {
      style: 'Style 1',
      backgroundColor: '#111827',
      textColor: '#d1d5db',
      logoWidth: 100,
      showTopLink: false,
      showQuickLink: true,
      showContactInfo: true,
      showSocialMedia: true,
      showNewsletter: true,
      showCopyRightsReserved: true,
      columnsLayout: '4'
    },
    productCards: {
      style: 'Minimal',
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderThickness: 0,
      borderCornerRadius: 0,
      shadowBlur: 0,
      shadowOpacity: 0,
      imagePadding: 0,
      textAlignment: 'Left',
      showQuickView: false,
      showAddToCart: true,
      showWishlist: true,
      hoverEffect: 'zoom'
    },
    layout: {
      width: 'Boxed',
      containerMaxWidth: 1200,
      sectionPadding: 100,
      componentGap: 0
    },
    background: {
      style: 'Color',
      isParallax: false,
      showOverlay: false,
      overlayColor: '#000000',
      overlayOpacity: 0
    }
  },
  {
    id: 'modern-dark',
    name: 'Modern Dark',
    description: 'Sleek dark theme with vibrant accents',
    thumbnail: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400&h=300&fit=crop',
    category: 'dark',
    isPremium: false,
    colors: {
      primaryColor: '#8b5cf6',
      secondaryColor: '#06b6d4',
      accentColor: '#f43f5e',
      backgroundColor: '#0f172a',
      surfaceColor: '#1e293b',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#64748b',
      borderColor: '#334155',
      successColor: '#22c55e',
      warningColor: '#eab308',
      errorColor: '#ef4444'
    },
    typography: {
      headingFontFamily: 'Space Grotesk',
      bodyFontFamily: 'Inter',
      headingFontWeight: 600,
      bodyFontWeight: 400,
      headingFontSizeScale: 130,
      bodyFontSizeScale: 100,
      lineHeight: 1.7,
      letterSpacing: -0.01
    },
    buttons: {
      fontColor: '#ffffff',
      backgroundColor: '#8b5cf6',
      borderColor: '#8b5cf6',
      borderThickness: 0,
      borderCornerRadius: 8,
      shadowBlur: 20,
      shadowOpacity: 30,
      shadowVerticalOffset: 4,
      shadowHorizontalOffset: 0,
      hoverStyle: 'glow'
    },
    inputs: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderThickness: 1,
      borderCornerRadius: 8,
      shadowBlur: 0,
      shadowOpacity: 0,
      focusBorderColor: '#8b5cf6'
    },
    header: {
      style: 'Style 2',
      backgroundColor: '#0f172a',
      textColor: '#f8fafc',
      logoWidth: 130,
      menuAlignment: 'Center',
      menuTextColor: '#cbd5e1',
      menuBackgroundColor: '#1e293b',
      showWishList: true,
      showContactPhone: false,
      showWelcomeMessage: true,
      borderBottomThickness: 0,
      isSticky: true,
      isTransparent: false
    },
    footer: {
      style: 'Style 2',
      backgroundColor: '#020617',
      textColor: '#94a3b8',
      logoWidth: 110,
      showTopLink: true,
      showQuickLink: true,
      showContactInfo: true,
      showSocialMedia: true,
      showNewsletter: true,
      showCopyRightsReserved: true,
      columnsLayout: '4'
    },
    productCards: {
      style: 'Card',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderThickness: 1,
      borderCornerRadius: 12,
      shadowBlur: 20,
      shadowOpacity: 20,
      imagePadding: 12,
      textAlignment: 'Left',
      showQuickView: true,
      showAddToCart: true,
      showWishlist: true,
      hoverEffect: 'overlay'
    },
    layout: {
      width: 'Wide',
      containerMaxWidth: 1400,
      sectionPadding: 80,
      componentGap: 20
    },
    background: {
      style: 'Gradient',
      isParallax: false,
      showOverlay: false,
      overlayColor: '#000000',
      overlayOpacity: 0,
      gradientAngle: 135,
      gradientColors: ['#0f172a', '#1e1b4b']
    }
  },
  {
    id: 'elegant-luxury',
    name: 'Elegant Luxury',
    description: 'Sophisticated design for premium brands',
    thumbnail: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=400&h=300&fit=crop',
    category: 'elegant',
    isPremium: true,
    colors: {
      primaryColor: '#b8860b',
      secondaryColor: '#1a1a2e',
      accentColor: '#d4af37',
      backgroundColor: '#fefefe',
      surfaceColor: '#f8f6f3',
      textPrimary: '#1a1a2e',
      textSecondary: '#4a4a5e',
      textMuted: '#8a8a9e',
      borderColor: '#e8e6e3',
      successColor: '#2d6a4f',
      warningColor: '#b8860b',
      errorColor: '#9d0208'
    },
    typography: {
      headingFontFamily: 'Playfair Display',
      bodyFontFamily: 'Lato',
      headingFontWeight: 600,
      bodyFontWeight: 400,
      headingFontSizeScale: 140,
      bodyFontSizeScale: 105,
      lineHeight: 1.75,
      letterSpacing: 0.02
    },
    buttons: {
      fontColor: '#ffffff',
      backgroundColor: '#1a1a2e',
      borderColor: '#b8860b',
      borderThickness: 2,
      borderCornerRadius: 0,
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowVerticalOffset: 0,
      shadowHorizontalOffset: 0,
      hoverStyle: 'outline'
    },
    inputs: {
      backgroundColor: '#ffffff',
      borderColor: '#d4af37',
      borderThickness: 1,
      borderCornerRadius: 0,
      shadowBlur: 0,
      shadowOpacity: 0,
      focusBorderColor: '#b8860b'
    },
    header: {
      style: 'Style 3',
      backgroundColor: '#fefefe',
      textColor: '#1a1a2e',
      logoWidth: 150,
      menuAlignment: 'Center',
      menuTextColor: '#1a1a2e',
      menuBackgroundColor: '#fefefe',
      showWishList: true,
      showContactPhone: true,
      showWelcomeMessage: false,
      borderBottomThickness: 1,
      isSticky: false,
      isTransparent: true
    },
    footer: {
      style: 'Style 3',
      backgroundColor: '#1a1a2e',
      textColor: '#d4d4d4',
      logoWidth: 120,
      showTopLink: false,
      showQuickLink: true,
      showContactInfo: true,
      showSocialMedia: true,
      showNewsletter: true,
      showCopyRightsReserved: true,
      columnsLayout: '3'
    },
    productCards: {
      style: 'Magazine',
      backgroundColor: '#ffffff',
      borderColor: '#e8e6e3',
      borderThickness: 0,
      borderCornerRadius: 0,
      shadowBlur: 30,
      shadowOpacity: 10,
      imagePadding: 0,
      textAlignment: 'Center',
      showQuickView: true,
      showAddToCart: false,
      showWishlist: true,
      hoverEffect: 'fade'
    },
    layout: {
      width: 'Full',
      containerMaxWidth: 1600,
      sectionPadding: 120,
      componentGap: 0
    },
    background: {
      style: 'Color',
      isParallax: false,
      showOverlay: false,
      overlayColor: '#000000',
      overlayOpacity: 0
    }
  },
  {
    id: 'bold-vibrant',
    name: 'Bold & Vibrant',
    description: 'Eye-catching colors and dynamic layouts',
    thumbnail: 'https://images.unsplash.com/photo-1618172193763-c511deb635ca?w=400&h=300&fit=crop',
    category: 'bold',
    isPremium: false,
    colors: {
      primaryColor: '#ff6b35',
      secondaryColor: '#004e89',
      accentColor: '#f7c59f',
      backgroundColor: '#ffffff',
      surfaceColor: '#f0f4f8',
      textPrimary: '#1a1a2e',
      textSecondary: '#4a5568',
      textMuted: '#718096',
      borderColor: '#e2e8f0',
      successColor: '#38a169',
      warningColor: '#dd6b20',
      errorColor: '#e53e3e'
    },
    typography: {
      headingFontFamily: 'Bebas Neue',
      bodyFontFamily: 'Open Sans',
      headingFontWeight: 400,
      bodyFontWeight: 400,
      headingFontSizeScale: 160,
      bodyFontSizeScale: 100,
      lineHeight: 1.6,
      letterSpacing: 0.05
    },
    buttons: {
      fontColor: '#ffffff',
      backgroundColor: '#ff6b35',
      borderColor: '#ff6b35',
      borderThickness: 0,
      borderCornerRadius: 50,
      shadowBlur: 15,
      shadowOpacity: 40,
      shadowVerticalOffset: 6,
      shadowHorizontalOffset: 0,
      hoverStyle: 'scale'
    },
    inputs: {
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderThickness: 2,
      borderCornerRadius: 50,
      shadowBlur: 0,
      shadowOpacity: 0,
      focusBorderColor: '#ff6b35'
    },
    header: {
      style: 'Style 4',
      backgroundColor: '#004e89',
      textColor: '#ffffff',
      logoWidth: 140,
      menuAlignment: 'Left',
      menuTextColor: '#ffffff',
      menuBackgroundColor: '#003d6b',
      showWishList: true,
      showContactPhone: true,
      showWelcomeMessage: true,
      borderBottomThickness: 0,
      isSticky: true,
      isTransparent: false
    },
    footer: {
      style: 'Style 4',
      backgroundColor: '#1a1a2e',
      textColor: '#e2e8f0',
      logoWidth: 130,
      showTopLink: true,
      showQuickLink: true,
      showContactInfo: true,
      showSocialMedia: true,
      showNewsletter: true,
      showCopyRightsReserved: true,
      columnsLayout: '5'
    },
    productCards: {
      style: 'Overlay',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderThickness: 0,
      borderCornerRadius: 16,
      shadowBlur: 25,
      shadowOpacity: 15,
      imagePadding: 0,
      textAlignment: 'Center',
      showQuickView: true,
      showAddToCart: true,
      showWishlist: true,
      hoverEffect: 'slide'
    },
    layout: {
      width: 'Full',
      containerMaxWidth: 1400,
      sectionPadding: 60,
      componentGap: 30
    },
    background: {
      style: 'Pattern',
      isParallax: false,
      showOverlay: true,
      overlayColor: '#ffffff',
      overlayOpacity: 95,
      patternType: 'dots'
    }
  },
  {
    id: 'playful-pastel',
    name: 'Playful Pastel',
    description: 'Soft colors and friendly rounded shapes',
    thumbnail: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=400&h=300&fit=crop',
    category: 'playful',
    isPremium: false,
    colors: {
      primaryColor: '#a855f7',
      secondaryColor: '#ec4899',
      accentColor: '#06b6d4',
      backgroundColor: '#fdf4ff',
      surfaceColor: '#ffffff',
      textPrimary: '#581c87',
      textSecondary: '#7e22ce',
      textMuted: '#c084fc',
      borderColor: '#f0abfc',
      successColor: '#34d399',
      warningColor: '#fbbf24',
      errorColor: '#fb7185'
    },
    typography: {
      headingFontFamily: 'Quicksand',
      bodyFontFamily: 'Nunito',
      headingFontWeight: 700,
      bodyFontWeight: 400,
      headingFontSizeScale: 125,
      bodyFontSizeScale: 102,
      lineHeight: 1.7,
      letterSpacing: 0
    },
    buttons: {
      fontColor: '#ffffff',
      backgroundColor: '#a855f7',
      borderColor: '#a855f7',
      borderThickness: 0,
      borderCornerRadius: 20,
      shadowBlur: 20,
      shadowOpacity: 25,
      shadowVerticalOffset: 4,
      shadowHorizontalOffset: 0,
      hoverStyle: 'lighten'
    },
    inputs: {
      backgroundColor: '#ffffff',
      borderColor: '#f0abfc',
      borderThickness: 2,
      borderCornerRadius: 16,
      shadowBlur: 10,
      shadowOpacity: 10,
      focusBorderColor: '#a855f7'
    },
    header: {
      style: 'Style 1',
      backgroundColor: '#ffffff',
      textColor: '#581c87',
      logoWidth: 120,
      menuAlignment: 'Center',
      menuTextColor: '#7e22ce',
      menuBackgroundColor: '#fdf4ff',
      showWishList: true,
      showContactPhone: false,
      showWelcomeMessage: true,
      borderBottomThickness: 0,
      isSticky: true,
      isTransparent: false
    },
    footer: {
      style: 'Style 2',
      backgroundColor: '#581c87',
      textColor: '#e9d5ff',
      logoWidth: 100,
      showTopLink: true,
      showQuickLink: true,
      showContactInfo: true,
      showSocialMedia: true,
      showNewsletter: true,
      showCopyRightsReserved: true,
      columnsLayout: '4'
    },
    productCards: {
      style: 'Card',
      backgroundColor: '#ffffff',
      borderColor: '#f0abfc',
      borderThickness: 2,
      borderCornerRadius: 24,
      shadowBlur: 20,
      shadowOpacity: 15,
      imagePadding: 16,
      textAlignment: 'Center',
      showQuickView: true,
      showAddToCart: true,
      showWishlist: true,
      hoverEffect: 'zoom'
    },
    layout: {
      width: 'Boxed',
      containerMaxWidth: 1280,
      sectionPadding: 80,
      componentGap: 24
    },
    background: {
      style: 'Gradient',
      isParallax: false,
      showOverlay: false,
      overlayColor: '#000000',
      overlayOpacity: 0,
      gradientAngle: 180,
      gradientColors: ['#fdf4ff', '#fce7f3', '#fdf4ff']
    }
  },
  {
    id: 'classic-professional',
    name: 'Classic Professional',
    description: 'Timeless design for corporate brands',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
    category: 'classic',
    isPremium: false,
    colors: {
      primaryColor: '#1e40af',
      secondaryColor: '#475569',
      accentColor: '#0891b2',
      backgroundColor: '#ffffff',
      surfaceColor: '#f8fafc',
      textPrimary: '#0f172a',
      textSecondary: '#334155',
      textMuted: '#64748b',
      borderColor: '#cbd5e1',
      successColor: '#059669',
      warningColor: '#d97706',
      errorColor: '#dc2626'
    },
    typography: {
      headingFontFamily: 'Merriweather',
      bodyFontFamily: 'Source Sans Pro',
      headingFontWeight: 700,
      bodyFontWeight: 400,
      headingFontSizeScale: 115,
      bodyFontSizeScale: 100,
      lineHeight: 1.65,
      letterSpacing: 0
    },
    buttons: {
      fontColor: '#ffffff',
      backgroundColor: '#1e40af',
      borderColor: '#1e40af',
      borderThickness: 0,
      borderCornerRadius: 6,
      shadowBlur: 4,
      shadowOpacity: 20,
      shadowVerticalOffset: 2,
      shadowHorizontalOffset: 0,
      hoverStyle: 'darken'
    },
    inputs: {
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderThickness: 1,
      borderCornerRadius: 6,
      shadowBlur: 0,
      shadowOpacity: 0,
      focusBorderColor: '#1e40af'
    },
    header: {
      style: 'Style 1',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      logoWidth: 140,
      menuAlignment: 'Right',
      menuTextColor: '#334155',
      menuBackgroundColor: '#f8fafc',
      showWishList: true,
      showContactPhone: true,
      showWelcomeMessage: false,
      borderBottomThickness: 1,
      isSticky: true,
      isTransparent: false
    },
    footer: {
      style: 'Style 1',
      backgroundColor: '#0f172a',
      textColor: '#cbd5e1',
      logoWidth: 120,
      showTopLink: false,
      showQuickLink: true,
      showContactInfo: true,
      showSocialMedia: true,
      showNewsletter: false,
      showCopyRightsReserved: true,
      columnsLayout: '4'
    },
    productCards: {
      style: 'Standard',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderThickness: 1,
      borderCornerRadius: 8,
      shadowBlur: 10,
      shadowOpacity: 8,
      imagePadding: 0,
      textAlignment: 'Left',
      showQuickView: false,
      showAddToCart: true,
      showWishlist: true,
      hoverEffect: 'zoom'
    },
    layout: {
      width: 'Boxed',
      containerMaxWidth: 1200,
      sectionPadding: 80,
      componentGap: 0
    },
    background: {
      style: 'Color',
      isParallax: false,
      showOverlay: false,
      overlayColor: '#000000',
      overlayOpacity: 0
    }
  }
];

// ============================================
// HOMEPAGE TEMPLATES
// ============================================

export const HOMEPAGE_TEMPLATES: HomepageTemplate[] = [
  {
    id: 'ecommerce-standard',
    name: 'E-commerce Standard',
    description: 'Classic online store layout with hero, categories, and products',
    thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop',
    category: 'ecommerce',
    recommendedThemes: ['minimal-light', 'modern-dark', 'classic-professional'],
    components: [
      { id: 'hero-1', type: 'hero', order: 0, settings: { title: 'Discover Our Collection', subtitle: 'Premium products crafted with care', buttonText: 'Shop Now', alignment: 'left' } },
      { id: 'categories-1', type: 'categories', order: 1, settings: { title: 'Shop by Category', subtitle: 'Browse our curated collections', columns: 4 } },
      { id: 'products-1', type: 'products', order: 2, settings: { title: 'Featured Products', subtitle: 'Our best sellers', columns: 4, productCount: 8 } },
      { id: 'banner-1', type: 'banner', order: 3, settings: { title: 'Summer Sale', subtitle: 'Up to 50% off', buttonText: 'Shop Sale', style: 'full-width' } },
      { id: 'testimonials-1', type: 'testimonials', order: 4, settings: { title: 'What Our Customers Say', layout: 'carousel' } },
      { id: 'newsletter-1', type: 'newsletter', order: 5, settings: { title: 'Join Our Newsletter', subtitle: 'Get 10% off', buttonText: 'Subscribe' } }
    ]
  },
  {
    id: 'landing-startup',
    name: 'Startup Landing',
    description: 'Perfect for SaaS and tech startups',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    category: 'startup',
    recommendedThemes: ['modern-dark', 'bold-vibrant', 'playful-pastel'],
    components: [
      { id: 'hero-1', type: 'hero', order: 0, settings: { title: 'Build Something Amazing', subtitle: 'The all-in-one platform for modern teams', buttonText: 'Start Free Trial', alignment: 'center' } },
      { id: 'stats-1', type: 'stats', order: 1, settings: { title: 'Our Impact', stats: [{ value: '10K+', label: 'Users' }, { value: '99.9%', label: 'Uptime' }] } },
      { id: 'features-1', type: 'features', order: 2, settings: { title: 'Everything You Need', columns: 3 } },
      { id: 'pricing-1', type: 'pricing', order: 3, settings: { title: 'Simple Pricing' } },
      { id: 'testimonials-1', type: 'testimonials', order: 4, settings: { title: 'Loved by Teams', layout: 'grid' } },
      { id: 'faq-1', type: 'faq', order: 5, settings: { title: 'FAQ' } },
      { id: 'cta-1', type: 'cta', order: 6, settings: { title: 'Ready to Get Started?', buttonText: 'Start Free Trial', style: 'gradient' } }
    ]
  },
  {
    id: 'portfolio-minimal',
    name: 'Minimal Portfolio',
    description: 'Clean showcase for creative work',
    thumbnail: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=300&fit=crop',
    category: 'portfolio',
    recommendedThemes: ['minimal-light', 'elegant-luxury'],
    components: [
      { id: 'hero-1', type: 'hero', order: 0, settings: { title: 'Creative Studio', subtitle: 'We craft beautiful digital experiences', buttonText: 'View Our Work', alignment: 'center' } },
      { id: 'gallery-1', type: 'gallery', order: 1, settings: { title: 'Selected Work', columns: 3 } },
      { id: 'about-1', type: 'about', order: 2, settings: { title: 'About Us', showImage: true } },
      { id: 'team-1', type: 'team', order: 3, settings: { title: 'Meet the Team' } },
      { id: 'contact-1', type: 'contact', order: 4, settings: { title: 'Get in Touch' } }
    ]
  },
  {
    id: 'corporate-business',
    name: 'Corporate Business',
    description: 'Professional layout for enterprises',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop',
    category: 'corporate',
    recommendedThemes: ['classic-professional', 'elegant-luxury', 'minimal-light'],
    components: [
      { id: 'hero-1', type: 'hero', order: 0, settings: { title: 'Building the Future Together', subtitle: 'Trusted by Fortune 500 companies', buttonText: 'Learn More', alignment: 'left' } },
      { id: 'stats-1', type: 'stats', order: 1, settings: { title: 'Our Impact', style: 'cards' } },
      { id: 'features-1', type: 'features', order: 2, settings: { title: 'Our Services', columns: 3 } },
      { id: 'testimonials-1', type: 'testimonials', order: 3, settings: { title: 'Client Success Stories', layout: 'carousel' } },
      { id: 'team-1', type: 'team', order: 4, settings: { title: 'Leadership Team' } },
      { id: 'cta-1', type: 'cta', order: 5, settings: { title: 'Partner With Us', buttonText: 'Schedule a Call', style: 'solid' } }
    ]
  },
  {
    id: 'ecommerce-luxury',
    name: 'Luxury E-commerce',
    description: 'Elegant design for premium products',
    thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop',
    category: 'ecommerce',
    recommendedThemes: ['elegant-luxury', 'modern-dark'],
    components: [
      { id: 'hero-1', type: 'hero', order: 0, settings: { title: 'Timeless Elegance', subtitle: 'Handcrafted luxury for the discerning', buttonText: 'Explore Collection', alignment: 'center' } },
      { id: 'products-1', type: 'products', order: 1, settings: { title: 'New Arrivals', columns: 3, productCount: 6 } },
      { id: 'banner-1', type: 'banner', order: 2, settings: { title: 'The Art of Craftsmanship', buttonText: 'Our Story', style: 'split' } },
      { id: 'categories-1', type: 'categories', order: 3, settings: { title: 'Collections', columns: 3 } },
      { id: 'testimonials-1', type: 'testimonials', order: 4, settings: { title: 'Client Testimonials', layout: 'carousel' } },
      { id: 'newsletter-1', type: 'newsletter', order: 5, settings: { title: 'Stay Informed', buttonText: 'Subscribe' } }
    ]
  }
];

// ============================================
// MESSAGE & UTILITIES
// ============================================

export interface MessagePayload {
  type: 'setting-change' | 'sync-all' | 'preview-ready' | 'element-click' | 'reset' | 'page-data' | 'theme-change' | 'homepage-change' | 'scroll-to-component';
  key?: string;
  value?: any;
  settings?: GlobalSettings;
  pageData?: PageData;
  theme?: ThemePreset;
  homepage?: HomepageTemplate;
  componentId?: string;
}

export interface HistoryState {
  pageData: PageData;
  timestamp: number;
}

export type DeviceType = 'desktop' | 'tablet' | 'mobile';

export const DEVICE_WIDTHS: Record<DeviceType, number> = {
  desktop: 100,
  tablet: 768,
  mobile: 375
};

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ============================================
// COMPONENT LIBRARY
// ============================================

export const COMPONENT_LIBRARY: ComponentDefinition[] = [
  {
    type: 'hero',
    name: 'Hero Section',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>',
    description: 'Large banner section with heading, text and CTA',
    defaultSettings: {
      title: 'Welcome to Our Store',
      subtitle: 'Discover amazing products at great prices',
      buttonText: 'Shop Now',
      buttonLink: '#',
      showSecondaryButton: true,
      secondaryButtonText: 'Learn More',
      alignment: 'center'
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { key: 'buttonText', label: 'Button Text', type: 'text' },
      { key: 'buttonLink', label: 'Button Link', type: 'text' },
      { key: 'showSecondaryButton', label: 'Show Secondary Button', type: 'toggle' },
      { key: 'secondaryButtonText', label: 'Secondary Button Text', type: 'text' },
      { key: 'alignment', label: 'Alignment', type: 'select', options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' }
      ]}
    ]
  },
  {
    type: 'features',
    name: 'Features Grid',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    description: 'Grid of feature cards with icons',
    defaultSettings: {
      title: 'Our Features',
      subtitle: 'What makes us different',
      columns: 3,
      features: [
        { title: 'Fast Delivery', description: 'Get your orders quickly' },
        { title: 'Quality Products', description: 'Only the best items' },
        { title: '24/7 Support', description: 'Always here to help' }
      ]
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'columns', label: 'Columns', type: 'select', options: [
        { value: '2', label: '2 Columns' },
        { value: '3', label: '3 Columns' },
        { value: '4', label: '4 Columns' }
      ]}
    ]
  },
  {
    type: 'testimonials',
    name: 'Testimonials',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    description: 'Customer testimonials and reviews',
    defaultSettings: {
      title: 'What Our Customers Say',
      subtitle: 'Read testimonials from happy customers',
      testimonials: [
        { name: 'John Doe', role: 'Customer', content: 'Amazing products and great service!' },
        { name: 'Jane Smith', role: 'Customer', content: 'Fast delivery and excellent quality.' },
        { name: 'Mike Johnson', role: 'Customer', content: 'Best shopping experience ever!' }
      ]
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' }
    ]
  },
  {
    type: 'cta',
    name: 'Call to Action',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    description: 'Prominent call-to-action section',
    defaultSettings: {
      title: 'Ready to Get Started?',
      subtitle: 'Join thousands of happy customers today',
      buttonText: 'Get Started',
      buttonLink: '#',
      style: 'gradient'
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'buttonText', label: 'Button Text', type: 'text' },
      { key: 'buttonLink', label: 'Button Link', type: 'text' },
      { key: 'style', label: 'Style', type: 'select', options: [
        { value: 'gradient', label: 'Gradient' },
        { value: 'solid', label: 'Solid Color' },
        { value: 'outline', label: 'Outline' }
      ]}
    ]
  },
  {
    type: 'pricing',
    name: 'Pricing Table',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    description: 'Pricing plans comparison table',
    defaultSettings: {
      title: 'Choose Your Plan',
      subtitle: 'Simple, transparent pricing',
      plans: [
        { name: 'Basic', price: '9', period: 'month', features: ['Feature 1', 'Feature 2'], highlighted: false },
        { name: 'Pro', price: '29', period: 'month', features: ['Feature 1', 'Feature 2', 'Feature 3'], highlighted: true },
        { name: 'Enterprise', price: '99', period: 'month', features: ['All features', 'Priority support'], highlighted: false }
      ]
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' }
    ]
  },
  {
    type: 'stats',
    name: 'Statistics',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    description: 'Number statistics display',
    defaultSettings: {
      title: 'Our Impact',
      subtitle: 'Numbers that speak for themselves',
      stats: [
        { value: '10K+', label: 'Happy Customers' },
        { value: '500+', label: 'Products' },
        { value: '99%', label: 'Satisfaction' },
        { value: '24/7', label: 'Support' }
      ]
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' }
    ]
  },
  {
    type: 'faq',
    name: 'FAQ Section',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    description: 'Frequently asked questions',
    defaultSettings: {
      title: 'Frequently Asked Questions',
      subtitle: 'Find answers to common questions',
      faqs: [
        { question: 'How do I place an order?', answer: 'Simply browse our products, add items to your cart, and proceed to checkout.' },
        { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards, PayPal, and bank transfers.' },
        { question: 'How long does shipping take?', answer: 'Standard shipping takes 3-5 business days. Express shipping is available.' }
      ]
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' }
    ]
  },
  {
    type: 'contact',
    name: 'Contact Form',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    description: 'Contact information and form',
    defaultSettings: {
      title: 'Get in Touch',
      subtitle: 'We would love to hear from you',
      email: 'contact@example.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main Street, City, Country'
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea' }
    ]
  },
  {
    type: 'newsletter',
    name: 'Newsletter',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    description: 'Email newsletter signup',
    defaultSettings: {
      title: 'Subscribe to Our Newsletter',
      subtitle: 'Get the latest updates and offers',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe'
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'placeholder', label: 'Placeholder', type: 'text' },
      { key: 'buttonText', label: 'Button Text', type: 'text' }
    ]
  },
  {
    type: 'gallery',
    name: 'Image Gallery',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    description: 'Image gallery grid',
    defaultSettings: {
      title: 'Gallery',
      subtitle: 'Explore our collection',
      columns: 3,
      images: [
        { src: 'https://picsum.photos/400/300?random=1', alt: 'Image 1' },
        { src: 'https://picsum.photos/400/300?random=2', alt: 'Image 2' },
        { src: 'https://picsum.photos/400/300?random=3', alt: 'Image 3' }
      ]
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'columns', label: 'Columns', type: 'select', options: [
        { value: '2', label: '2 Columns' },
        { value: '3', label: '3 Columns' },
        { value: '4', label: '4 Columns' }
      ]}
    ]
  },
  {
    type: 'team',
    name: 'Team Section',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    description: 'Team members display',
    defaultSettings: {
      title: 'Meet Our Team',
      subtitle: 'The people behind our success',
      members: [
        { name: 'John Doe', role: 'CEO' },
        { name: 'Jane Smith', role: 'CTO' },
        { name: 'Mike Johnson', role: 'Designer' },
        { name: 'Sarah Williams', role: 'Developer' }
      ]
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' }
    ]
  },
  {
    type: 'products',
    name: 'Products Grid',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    description: 'Product showcase grid',
    defaultSettings: {
      title: 'Featured Products',
      subtitle: 'Check out our best sellers',
      columns: 4,
      productCount: 8
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'columns', label: 'Columns', type: 'select', options: [
        { value: '3', label: '3 Columns' },
        { value: '4', label: '4 Columns' }
      ]},
      { key: 'productCount', label: 'Number of Products', type: 'number', min: 4, max: 12 }
    ]
  },
  {
    type: 'categories',
    name: 'Categories Grid',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    description: 'Product categories display',
    defaultSettings: {
      title: 'Shop by Category',
      subtitle: 'Browse our collections',
      columns: 4
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'columns', label: 'Columns', type: 'select', options: [
        { value: '3', label: '3 Columns' },
        { value: '4', label: '4 Columns' }
      ]}
    ]
  },
  {
    type: 'banner',
    name: 'Promo Banner',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    description: 'Promotional banner section',
    defaultSettings: {
      title: 'Special Offer',
      subtitle: 'Limited time only!',
      buttonText: 'Shop Now',
      style: 'full-width'
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'buttonText', label: 'Button Text', type: 'text' },
      { key: 'style', label: 'Style', type: 'select', options: [
        { value: 'full-width', label: 'Full Width' },
        { value: 'split', label: 'Split Layout' }
      ]}
    ]
  },
  {
    type: 'about',
    name: 'About Section',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    description: 'About us content section',
    defaultSettings: {
      title: 'About Us',
      subtitle: 'Our Story',
      content: 'We are passionate about creating amazing experiences for our customers.',
      showImage: true
    },
    settingsSchema: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'content', label: 'Content', type: 'textarea' },
      { key: 'showImage', label: 'Show Image', type: 'toggle' }
    ]
  }
];

// ============================================
// FONT OPTIONS
// ============================================

export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Quicksand', label: 'Quicksand' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Montserrat', label: 'Montserrat' }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function themeToGlobalSettings(theme: ThemePreset): Partial<GlobalSettings> {
  return {
    primaryColor: theme.colors.primaryColor,
    secondaryColor: theme.colors.secondaryColor,
    accentColor: theme.colors.accentColor,
    bodyBgColor: theme.colors.backgroundColor,
    bodyTextColor: theme.colors.textPrimary,
    headerBgColor: theme.header.backgroundColor,
    headerTextColor: theme.header.textColor,
    fontFamily: theme.typography.bodyFontFamily,
    headingFontFamily: theme.typography.headingFontFamily,
    borderRadius: theme.buttons.borderCornerRadius,
    containerWidth: theme.layout.containerMaxWidth,
    sectionPadding: theme.layout.sectionPadding,
    stickyHeader: theme.header.isSticky,
    activeThemeId: theme.id
  };
}
