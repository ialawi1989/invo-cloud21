/** One customer rating, as stored in the backend `Feedbacks` table (InvoCloudBack `models/Settings/feedBack.ts`). */
export interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string | null;
  customerContact: string | null;
  /** Legacy list alias of `customerContact`. */
  customerPhone: string;
  transactionId: string | null;
  transactionNumber: string | null;
  branchId?: string;
  createdAt: string;
}

/** Body of `company/getFeedbackList` (legacy `loadFeedbackData`). */
export interface FeedbackListParams {
  page: number;
  limit: number;
  searchTerm: string;
  ratings: number[];
  sort: { value: string; direction: string };
  fromDate: string;
  toDate: string;
  branchIds: string[];
}

export interface FeedbackListResult {
  list: Feedback[];
  hasNext: boolean;
}

/** The `feedbackSettings` jsonb column of `Companies`. */
export interface FeedbackSettings {
  emailNotifications: { emails: string[]; ratings: number[] };
  googleFeedbackSettings: { url: string; ratings: number[] };
}

export const RATINGS = [5, 4, 3, 2, 1] as const;

export function ratingColor(rating: number): 'success' | 'warning' | 'danger' {
  if (rating >= 4) return 'success';
  if (rating >= 3) return 'warning';
  return 'danger';
}
