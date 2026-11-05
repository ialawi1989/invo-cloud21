import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The whole document-view page as shimmering placeholders — record rail + title bar + toolbar + paper — shown
 * until the first document and rail page arrive (the shell itself only exists once there is a document).
 * Self-contained styles, so it renders correctly before the shell's global `dv-*` styles have been loaded.
 */
@Component({
  selector: 'app-doc-view-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sk" aria-hidden="true">
      <aside class="sk__rail">
        <div class="sk__head"><span class="b" style="width:110px;height:16px"></span><span class="b" style="width:92px;height:28px;border-radius:8px"></span></div>
        <div class="sk__search"><span class="b" style="width:100%;height:34px;border-radius:8px"></span></div>
        @for (n of rows; track n) {
          <div class="sk__row">
            <span class="b" style="width:16px;height:16px;border-radius:4px"></span>
            <div class="sk__row-body">
              <div class="sk__line"><span class="b" style="width:46%"></span><span class="b" style="width:22%"></span></div>
              <span class="b sm" style="width:58%"></span>
            </div>
          </div>
        }
      </aside>
      <section class="sk__main">
        <div class="sk__title"><span class="b" style="width:180px;height:18px"></span><span class="b" style="width:22px;height:22px;border-radius:999px"></span></div>
        <div class="sk__toolbar">
          @for (w of tools; track $index) { <span class="b" [style.width.px]="w" style="height:26px;border-radius:6px"></span> }
        </div>
        <div class="sk__body">
          <span class="b" style="width:100%;height:56px;border-radius:10px"></span>
          <div class="sk__paper">
            <div class="sk__paper-top"><span class="b" style="width:90px;height:90px;border-radius:8px"></span><span class="b" style="width:150px;height:30px"></span></div>
            <span class="b" style="width:100%;height:2px"></span>
            @for (w of lines; track $index) { <span class="b" [style.width.%]="w"></span> }
            <span class="b" style="width:100%;height:30px;margin-top:10px;border-radius:4px"></span>
            @for (n of [1, 2, 3]; track n) { <span class="b" style="width:100%;height:26px"></span> }
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; overflow: hidden; }
    .sk { display: flex; width: 100%; height: 100%; background: #fff; }
    .b { display: inline-block; height: 12px; border-radius: 6px; background: linear-gradient(90deg, #eef2f6 25%, #e4e9ef 37%, #eef2f6 63%); background-size: 400% 100%; animation: sk-shimmer 1.4s ease infinite; }
    .b.sm { height: 10px; }
    @keyframes sk-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
    .sk__rail { width: 340px; flex: 0 0 340px; border-inline-end: 1px solid #e4e7ec; background: #fbfcfd; display: flex; flex-direction: column; overflow: hidden; }
    .sk__head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; }
    .sk__search { padding: 4px 16px 10px; }
    .sk__row { display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-top: 1px solid #f1f5f9; background: #fff; }
    .sk__row-body { flex: 1; display: flex; flex-direction: column; gap: 9px; }
    .sk__line { display: flex; justify-content: space-between; gap: 12px; }
    .sk__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .sk__title { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #e4e7ec; }
    .sk__toolbar { display: flex; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #e4e7ec; }
    .sk__body { flex: 1; overflow: hidden; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; background: #f6f8fa; }
    .sk__paper { background: #fff; border-radius: 6px; padding: 28px 32px; display: flex; flex-direction: column; gap: 14px; max-width: 800px; width: 100%; margin-inline: auto; box-shadow: 0 1px 3px rgba(15, 23, 42, .08); }
    .sk__paper-top { display: flex; justify-content: space-between; align-items: center; }
    @media (max-width: 900px) { .sk { flex-direction: column; } .sk__rail { display: none; } }
  `],
})
export class DocViewSkeletonComponent {
  readonly rows = Array.from({ length: 8 }, (_, i) => i);
  readonly tools = [60, 80, 120, 70, 80, 36];
  readonly lines = [40, 55, 35, 60, 45];
}
