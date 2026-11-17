/**
 * SVG stand-ins for the emoji values that are persisted by some features
 * (service-request `icon`, content-library collection `icon`).
 *
 * The STORED value stays the emoji string (other clients read it), but the
 * portal never renders the emoji itself: it renders the matching SVG here.
 * Unknown emoji fall back to a generic bell.
 */
export interface EmojiIconDef {
  /** The persisted value. */
  emoji: string;
  /** English label used for search. */
  label: string;
  /** SVG `d` attributes (24x24 viewBox, stroked, no fill). */
  paths: string[];
}

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rect = (x: number, y: number, w: number, h: number, r = 2): string =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const BELL = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0';
const STAR = 'M12 2l3.1 6.6 6.9.7-5.2 4.7 1.4 7-6.2-3.5L5.8 21l1.4-7L2 9.3l6.9-.7L12 2z';

export const EMOJI_ICONS: EmojiIconDef[] = [
  // service
  { emoji: '🛎️', label: 'service bell', paths: ['M3 18h18M5 18a7 7 0 0 1 14 0M12 8V6M10 6h4'] },
  { emoji: '👋', label: 'wave hand call', paths: ['M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.5-2.7L3 15.5a1.6 1.6 0 0 1 2.5-2L7 15'] },
  { emoji: '💳', label: 'card payment', paths: [rect(2, 5, 20, 14), 'M2 10h20'] },
  { emoji: '🧾', label: 'receipt bill', paths: ['M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6'] },
  { emoji: '💰', label: 'cash money', paths: [circle(12, 12, 9), 'M14.5 9.5c-.5-1-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.5-2.5-1.5M12 6v2M12 16v2'] },
  { emoji: '📞', label: 'phone call', paths: ['M22 17v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 17z'] },
  { emoji: '🆘', label: 'help sos lifebuoy', paths: [circle(12, 12, 10), circle(12, 12, 4), 'M4.9 4.9l4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3'] },
  { emoji: '⚠️', label: 'warning alert', paths: ['M12 3L2 20h20L12 3zM12 10v4M12 17h.01'] },
  { emoji: '❓', label: 'question help', paths: [circle(12, 12, 10), 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01'] },
  { emoji: '💡', label: 'idea tip bulb', paths: ['M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z'] },
  { emoji: '🔔', label: 'notification bell', paths: [BELL] },
  { emoji: '📢', label: 'announce megaphone', paths: ['M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12'] },
  { emoji: '⏰', label: 'clock time wait', paths: [circle(12, 12, 10), 'M12 6v6l4 2'] },
  { emoji: '🚨', label: 'siren urgent', paths: ['M7 18v-6a5 5 0 0 1 10 0v6M5 21h14M12 2v2M3.5 6.5l1.5 1M20.5 6.5l-1.5 1'] },
  // water & drinks
  { emoji: '💧', label: 'water drop', paths: ['M12 2.7s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z'] },
  { emoji: '🥤', label: 'drink cup soda', paths: ['M6 4h12l-1.5 17h-9L6 4zM6.5 9h11'] },
  { emoji: '🧊', label: 'ice', paths: [rect(4, 4, 16, 16, 3), 'M9 9l2 1M13 13l2 2M14 8l-1.5 2'] },
  { emoji: '☕', label: 'coffee tea', paths: ['M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 10h2a2 2 0 0 1 0 5h-2M8 2v3M12 2v3'] },
  { emoji: '🍷', label: 'wine glass', paths: ['M8 2h8l1 8a5 5 0 0 1-10 0l1-8zM12 15v7M8 22h8'] },
  { emoji: '🍺', label: 'beer mug', paths: ['M5 6h10v14H5zM15 9h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3M8 10v6M12 10v6'] },
  { emoji: '🍾', label: 'bottle', paths: ['M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3V2zM8 13h8'] },
  // bbq / grill
  { emoji: '🔥', label: 'fire flame grill', paths: ['M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 1-3.5 3-4 5-1-1-1.5-2-1.5-3.5C7 8 5 11 5 15a7 7 0 0 0 7 7z'] },
  { emoji: '🥩', label: 'meat steak', paths: ['M4 14c0-5 5-9 10-9s6 3 6 6-4 8-9 8-7-2-7-5z', circle(14, 11, 1.5)] },
  { emoji: '⚡', label: 'power bolt', paths: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'] },
  { emoji: '🌡️', label: 'temperature thermometer', paths: ['M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z'] },
  // assistance
  { emoji: '🔍', label: 'search look', paths: [circle(11, 11, 7), 'M21 21l-4.3-4.3'] },
  { emoji: '👍', label: 'thumbs up ok', paths: ['M7 11v10H3V11h4zM7 11l4-8a2.5 2.5 0 0 1 2.5 3L13 9h6a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7'] },
  { emoji: '❤️', label: 'heart love', paths: ['M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z'] },
  { emoji: '🤝', label: 'people team handshake', paths: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'] },
  // payment & documents
  { emoji: '📄', label: 'document page', paths: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M8 13h8M8 17h8'] },
  { emoji: '📝', label: 'note memo write', paths: ['M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'] },
  { emoji: '📊', label: 'chart report', paths: ['M3 3v18h18M7 15v3M12 10v8M17 6v12'] },
  { emoji: '💵', label: 'banknote cash', paths: [rect(2, 6, 20, 12), circle(12, 12, 3)] },
  // utensils
  { emoji: '🍽️', label: 'plate dish meal', paths: [circle(12, 12, 9), circle(12, 12, 4.5)] },
  { emoji: '🥄', label: 'spoon', paths: ['M12 2c-2.5 0-4 2-4 5s1.5 5 4 5 4-2 4-5-1.5-5-4-5zM12 12v10'] },
  { emoji: '🍴', label: 'fork knife cutlery', paths: ['M6 2v7a2 2 0 0 0 4 0V2M8 2v20M18 22V2c-3 2-4 6-4 9h4'] },
  { emoji: '🔪', label: 'knife', paths: ['M18 2c-4 2-6 6-6 10h6V2zM18 12v10'] },
  // content / collections
  { emoji: '🖼', label: 'image picture', paths: [rect(3, 3, 18, 18), circle(8.5, 8.5, 1.5), 'M21 15l-5-5L5 21'] },
  { emoji: '👥', label: 'users people', paths: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'] },
  { emoji: '⭐', label: 'star favourite', paths: [STAR] },
  { emoji: '📦', label: 'box package', paths: ['M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5L12 12.5l8.7-5M12 22V12.5'] },
  { emoji: '🎯', label: 'target goal', paths: [circle(12, 12, 10), circle(12, 12, 6), circle(12, 12, 2)] },
  { emoji: '🔗', label: 'link', paths: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'] },
  { emoji: '💬', label: 'message chat comment', paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z'] },
  { emoji: '🏷', label: 'tag label', paths: ['M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01'] },
  { emoji: '📅', label: 'calendar date', paths: [rect(3, 4, 18, 18), 'M16 2v4M8 2v4M3 10h18'] },
  { emoji: '🎨', label: 'palette art design', paths: ['M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1.5 3.3c.7.8.2 2.7-2.5 2.7zM7.5 11h.01M12 7h.01M16.5 11h.01'] },
];

/** Variation-selector-insensitive so '🛎' and '🛎️' resolve to the same icon. */
const norm = (e: string): string => (e ?? '').replace(/️/g, '');
const BY_EMOJI = new Map(EMOJI_ICONS.map(i => [norm(i.emoji), i]));

export const FALLBACK_EMOJI_ICON: EmojiIconDef = { emoji: '', label: 'icon', paths: [BELL] };

export function emojiIconFor(emoji: string | null | undefined): EmojiIconDef {
  return BY_EMOJI.get(norm(emoji ?? '')) ?? FALLBACK_EMOJI_ICON;
}

/** Service-request picker categories (labels are the existing i18n keys). */
export const EMOJI_ICON_CATEGORIES: { key: string; label: string; emojis: string[] }[] = [
  { key: 'service', label: 'SERVICE_REQUEST.ICONS.SERVICE', emojis: ['🛎️', '👋', '📞', '🆘', '⚠️', '❓', '💡', '🔔', '📢', '⏰', '🚨'] },
  { key: 'water_drinks', label: 'SERVICE_REQUEST.ICONS.WATER_DRINKS', emojis: ['💧', '🥤', '🧊', '☕', '🍷', '🍺', '🍾'] },
  { key: 'bbq_grill', label: 'SERVICE_REQUEST.ICONS.BBQ_GRILL', emojis: ['🔥', '🥩', '⚡', '🌡️'] },
  { key: 'assistance', label: 'SERVICE_REQUEST.ICONS.ASSISTANCE', emojis: ['🆘', '❓', '💡', '🔍', '👋', '👍', '❤️', '🤝'] },
  { key: 'payment', label: 'SERVICE_REQUEST.ICONS.PAYMENT', emojis: ['💳', '💰', '💵', '🧾', '📄', '📝', '📊'] },
  { key: 'utensils', label: 'SERVICE_REQUEST.ICONS.UTENSILS', emojis: ['🍽️', '🥄', '🍴', '🔪', '🍷', '☕'] },
];

/** The 12 icons offered when creating a content-library collection. */
export const COLLECTION_EMOJIS = ['📝', '🖼', '👥', '⭐', '📦', '🎯', '📊', '🔗', '💬', '🏷', '📅', '🎨'];
