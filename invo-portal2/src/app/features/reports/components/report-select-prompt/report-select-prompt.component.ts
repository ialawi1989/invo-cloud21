import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * "Choose something first" state of a report that needs an employee (or similar) before it can run: an illustration, a title and a hint
 * pointing at the Filters button. The sibling of `app-report-empty`, so both read as one family.
 */
/** What a report can be waiting for: a filter choice (employee / branch / product / discount) or the row of another report it is opened from (`record`). */
export type ReportPromptKind = 'employee' | 'branch' | 'product' | 'discount' | 'record';

@Component({
  selector: 'app-report-select-prompt',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="sp" role="status">
      <svg class="sp-art" viewBox="0 0 260 190" fill="none" aria-hidden="true">
        <ellipse cx="130" cy="168" rx="92" ry="11" class="sp-shadow"/>
        <circle cx="130" cy="86" r="74" class="sp-blob"/>
        <circle cx="46" cy="58" r="5" class="sp-dot d1"/>
        <circle cx="218" cy="44" r="4" class="sp-dot d2"/>
        <circle cx="230" cy="122" r="6" class="sp-dot d3"/>
        <path d="M32 128l5-5m0 5l-5-5" class="sp-spark"/>
        <path d="M208 152l5-5m0 5l-5-5" class="sp-spark"/>
        <g class="sp-float">
          <!-- the profile card -->
          <rect x="70" y="30" width="120" height="124" rx="14" class="sp-card"/>
          <rect x="70" y="30" width="120" height="30" rx="14" class="sp-head"/>
          <rect x="70" y="46" width="120" height="14" class="sp-head"/>
          <circle cx="130" cy="82" r="15" class="sp-avatar"/>
          @switch (kind()) {
            @case ('branch') {
              <path d="M120 78l3-6h14l3 6z" class="sp-person-line"/>
              <path d="M121 78v13h18V78M127 91v-6h6v6" class="sp-person-line"/>
            }
            @case ('product') {
              <path d="M130 72l9 4.5v9L130 90l-9-4.5v-9z" class="sp-person-line"/>
              <path d="M121 76.5l9 4.5 9-4.5M130 81v9" class="sp-person-line"/>
            }
            @case ('record') {
              <path d="M130 72l9 4.5v9L130 90l-9-4.5v-9z" class="sp-person-line"/>
              <path d="M121 76.5l9 4.5 9-4.5M130 81v9" class="sp-person-line"/>
            }
            @case ('discount') {
              <path d="M123 90l14-16" class="sp-person-line"/>
              <circle cx="124" cy="77" r="3.2" class="sp-person"/>
              <circle cx="136" cy="87" r="3.2" class="sp-person"/>
            }
            @default {
              <circle cx="130" cy="78" r="6" class="sp-person"/>
              <path d="M118 94c2-7 22-7 24 0" class="sp-person-line"/>
            }
          }
          <rect x="94" y="110" width="72" height="8" rx="4" class="sp-row"/>
          <rect x="106" y="126" width="48" height="8" rx="4" class="sp-row"/>
          <!-- the pointer -->
          <circle cx="178" cy="132" r="22" class="sp-lens"/>
          <circle cx="178" cy="132" r="15" class="sp-lens-in"/>
          <path d="M194 148l14 14" class="sp-handle"/>
          <path d="M171 132h14M178 125v14" class="sp-plus"/>
        </g>
      </svg>
      <h3 class="sp-title">{{ ('REPORTS.PROMPT.' + kind().toUpperCase() + '_TITLE') | translate }}</h3>
      <p class="sp-hint">{{ ('REPORTS.PROMPT.' + kind().toUpperCase() + '_HINT') | translate }}</p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sp { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 34px 20px 38px; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 1px 3px rgba(15, 23, 42, .05); }
    .sp-art { width: min(260px, 70vw); height: auto; margin-bottom: 4px; }
    .sp-shadow { fill: #e2e8f0; opacity: .7; }
    .sp-blob { fill: #eaf6f9; }
    .sp-dot { fill: #9fd6e0; &.d2 { fill: #fcd9a8; } &.d3 { fill: #c9c2f5; } }
    .sp-spark { stroke: #94a3b8; stroke-width: 2; stroke-linecap: round; opacity: .7; }
    .sp-card { fill: #fff; stroke: #cbd9e1; stroke-width: 2; }
    .sp-head { fill: #dff1f5; }
    .sp-avatar { fill: #e0f2fe; stroke: #7cc4d4; stroke-width: 2; }
    .sp-person { fill: #167d8f; }
    .sp-person-line { stroke: #167d8f; stroke-width: 3; stroke-linecap: round; fill: none; }
    .sp-row { fill: #e8eef3; }
    .sp-lens { fill: #fff; stroke: #167d8f; stroke-width: 6; }
    .sp-lens-in { fill: #ecfeff; }
    .sp-handle { stroke: #167d8f; stroke-width: 8; stroke-linecap: round; }
    .sp-plus { stroke: #167d8f; stroke-width: 3.5; stroke-linecap: round; }
    .sp-float { animation: sp-float 4.2s ease-in-out infinite; transform-origin: 50% 60%; }
    .sp-dot { animation: sp-twinkle 3s ease-in-out infinite; &.d2 { animation-delay: .8s; } &.d3 { animation-delay: 1.6s; } }
    @keyframes sp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes sp-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
    @media (prefers-reduced-motion: reduce) { .sp-float, .sp-dot { animation: none; } }
    .sp-title { margin: 8px 0 4px; font-size: 17px; font-weight: 700; color: #0f172a; }
    .sp-hint { margin: 0; max-width: 400px; font-size: 13.5px; line-height: 1.5; color: #64748b; }
  `],
})
export class ReportSelectPromptComponent {
  /** What the report needs chosen first; picks the pictogram and the `REPORTS.PROMPT.<KIND>_TITLE / _HINT` texts. */
  kind = input<ReportPromptKind>('employee');
}
