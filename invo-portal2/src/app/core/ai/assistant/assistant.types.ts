/** JSON-schema description of one tool, as sent to the model. */
export interface AssistantToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A page the user can open from an answer (never opened automatically). */
export interface AssistantLink {
  label: string;
  url: string;
}

export interface ToolOutcome {
  /** Compact JSON handed back to the model. */
  result: unknown;
  links?: AssistantLink[];
}

export interface AssistantTool {
  def: AssistantToolDef;
  /** Privilege gate — a tool the employee may not use is never offered to the model. */
  allowed: () => boolean;
  run: (args: Record<string, any>) => Promise<ToolOutcome>;
}

/** One chat bubble in the panel. */
export interface ChatItem {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  links?: AssistantLink[];
  error?: boolean;
  /** i18n key of an error message (shown instead of `text`). */
  key?: string;
}

/** Wire format of `ai/chat` messages (OpenAI-style). */
export interface WireToolCall { id: string; name: string; arguments: string }
export interface WireMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: WireToolCall[];
  tool_call_id?: string;
}
