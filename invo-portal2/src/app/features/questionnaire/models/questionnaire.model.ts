export type QuestionType = 'rate' | 'comment';

/** One question. Legacy form fields: `type` (rate / comment) and `text`. */
export interface Question {
  id: string;
  type: QuestionType;
  text: string;
}

export const QUESTION_TYPES: QuestionType[] = ['rate', 'comment'];

export function emptyQuestion(): Question {
  return { id: '', type: 'rate', text: '' };
}
