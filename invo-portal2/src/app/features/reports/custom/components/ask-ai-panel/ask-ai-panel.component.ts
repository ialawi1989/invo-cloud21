import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ReportV2Service } from '../../services/report-v2.service';
import {
  AiBuildResult,
  AiHistoryTurn,
  AiUsage,
  ReportSpecV2,
} from '../../shared/v2/report-v2.model';

interface ChatTurn {
  role: 'user' | 'assistant' | 'error';
  text: string;
  /** Assistant turns: the spec the AI built (null = it couldn't build one). */
  spec?: ReportSpecV2 | null;
  preview?: AiBuildResult['preview'];
}

/** Rows of the preview shown inline; the real table comes from /v2/run. */
const PREVIEW_ROWS = 8;
const MAX_MESSAGE = 4000;

/**
 * Ask AI panel. The user types a question ("net sales by branch last month");
 * the backend builds a v2 spec, which is loaded into the builder for the user
 * to adjust and save with the normal Save button. The AI never saves on its
 * own and only sees the user's own company and branches.
 */
@Component({
  selector: 'app-ask-ai-panel',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './ask-ai-panel.component.html',
  styleUrls: ['./ask-ai-panel.component.scss'],
})
export class AskAiPanelComponent implements OnInit {
  /** Builds the spec open in the builder, sent so follow-ups can change it. */
  @Input() currentSpec: () => ReportSpecV2 | null = () => null;
  /** True when the builder has columns — offers "change the open report". */
  @Input() hasOpenReport = false;
  @Output() applySpec = new EventEmitter<ReportSpecV2>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('thread') thread?: ElementRef<HTMLElement>;

  readonly maxMessage = MAX_MESSAGE;
  readonly previewRows = PREVIEW_ROWS;
  readonly examples = [
    'CUSTOM_REPORTS.AI.EXAMPLE_1',
    'CUSTOM_REPORTS.AI.EXAMPLE_2',
    'CUSTOM_REPORTS.AI.EXAMPLE_3',
  ];

  turns: ChatTurn[] = [];
  message = '';
  pending = false;
  /** Send the open report along so the AI changes it instead of starting over. */
  refineCurrent = true;

  constructor(
    private reportsV2: ReportV2Service,
    private translate: TranslateService,
  ) {}

  /** Null until known; the meter stays hidden if the usage call fails. */
  usage: AiUsage | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.usage = await this.reportsV2.getAiUsage();
    } catch {
      // The meter is informational; the server still enforces the allowance.
    }
  }

  get allowanceUsedUp(): boolean {
    return (
      !!this.usage &&
      this.usage.monthlyLimit > 0 &&
      this.usage.usedThisMonth >= this.usage.monthlyLimit
    );
  }

  /** 0–100; usedThisMonth can end slightly above the limit, so it is capped. */
  get usagePercent(): number {
    if (!this.usage || this.usage.monthlyLimit <= 0) return 0;
    return Math.min(100, Math.round((this.usage.usedThisMonth / this.usage.monthlyLimit) * 100));
  }

  get canSend(): boolean {
    return (
      !this.pending &&
      !this.allowanceUsedUp &&
      !!this.message.trim() &&
      this.message.length <= MAX_MESSAGE
    );
  }

  /** Fill the box with an example question (a CUSTOM_REPORTS.AI.* key). */
  useExample(key: string): void {
    this.message = this.translate.instant(key);
  }

  onKeydown(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter adds a line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  async send(): Promise<void> {
    if (!this.canSend) return;
    const message = this.message.trim();
    // Earlier turns as plain text; the explanations are the assistant turns.
    const history: AiHistoryTurn[] = this.turns
      .filter((t) => t.role !== 'error')
      .map((t) => ({ role: t.role as 'user' | 'assistant', content: t.text }));
    const currentSpec = this.refineCurrent && this.hasOpenReport ? this.currentSpec() : null;

    this.turns = [...this.turns, { role: 'user', text: message }];
    this.message = '';
    this.pending = true;
    this.scrollToEnd();

    try {
      const result = await this.reportsV2.aiBuild({ message, history, currentSpec });
      if (result.usage) this.usage = result.usage;
      this.turns = [
        ...this.turns,
        {
          role: 'assistant',
          text: result.explanation || '',
          spec: result.spec,
          preview: result.preview,
        },
      ];
      if (result.spec) this.applySpec.emit(result.spec);
    } catch (err: any) {
      this.turns = [...this.turns, { role: 'error', text: err?.message || '' }];
    } finally {
      this.pending = false;
      this.scrollToEnd();
    }
  }

  /** Re-load an earlier answer into the builder. */
  reapply(turn: ChatTurn): void {
    if (turn.spec) this.applySpec.emit(turn.spec);
  }

  clear(): void {
    if (this.pending) return;
    this.turns = [];
  }

  previewColumns(turn: ChatTurn): string[] {
    return (turn.preview?.columns || []).map((c) => c.name);
  }

  previewRowsOf(turn: ChatTurn): any[] {
    const p = turn.preview;
    if (!p) return [];
    const rows = p.rows || (p.groups || []).flatMap((g) => g.rows || []);
    return rows.slice(0, PREVIEW_ROWS);
  }

  previewHasMore(turn: ChatTurn): boolean {
    const p = turn.preview;
    if (!p) return false;
    const total = p.rows
      ? p.rows.length
      : (p.groups || []).reduce((n, g) => n + (g.rows || []).length, 0);
    return p.hasMore || total > PREVIEW_ROWS;
  }

  trackTurn(index: number): number {
    return index;
  }

  private scrollToEnd(): void {
    setTimeout(() => {
      const el = this.thread?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
