import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  MarkEncoding,
  MarkChannel,
  FlatField,
  ReportColumn,
} from '../../shared/models/custom-report.model';

interface MarkSlot {
  channel: MarkChannel;
  label: string;
  icon: string;
}

/**
 * Chart types for which ApexCharts supports a meaningful data-labels toggle.
 * Table/KPI are rendered natively (not via ApexCharts) — labels are baked in
 * for table and meaningless for KPI, so we hide the toggle there.
 */
const LABEL_CAPABLE_CHART_TYPES = new Set<string>([
  'vertical-bar', 'horizontal-bar', 'line', 'area', 'donut', 'pie',
]);

@Component({
  selector: 'app-marks-card',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './marks-card.component.html',
  styleUrls: ['./marks-card.component.scss'],
})
export class MarksCardComponent {
  @Input() marks: MarkEncoding[] = [];
  @Input() allFields: FlatField[] = [];
  /**
   * Active chart type — gates the visibility of the data-labels toggle so
   * we don't show it for Table / KPI where it has no effect.
   */
  @Input() chartType = '';
  /**
   * Current `SheetConfig.showLabels` value, mirrored here so the toggle is
   * controlled by the parent. Parent emits the next value via `showLabelsChange`.
   */
  @Input() showLabels = true;
  @Output() marksChange = new EventEmitter<MarkEncoding[]>();
  @Output() showLabelsChange = new EventEmitter<boolean>();

  /** True when the active chart type supports data labels. */
  get showLabelsAvailable(): boolean {
    return LABEL_CAPABLE_CHART_TYPES.has(this.chartType);
  }

  onShowLabelsChange(next: boolean): void {
    this.showLabels = next;
    this.showLabelsChange.emit(next);
  }

  dragOverChannel: MarkChannel | null = null;

  // Only the Color channel is exposed — it's the one channel that's actually
  // wired into the chart renderer (splits the data into multiple series per
  // distinct value, drives the legend, and adds a coloured stripe on table
  // rows). Size / Label / Tooltip / Shape were UI-only and removed; add them
  // back here if you wire them through to ApexCharts.
  slots: MarkSlot[] = [
    { channel: 'color', label: 'Color', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' },
  ];

  // Mark-type (local visual state — no data/service impact)
  markType = 'automatic';
  markTypes: { value: string; label: string }[] = [
    { value: 'automatic', label: 'Automatic' },
    { value: 'bar',       label: 'Bar' },
    { value: 'line',      label: 'Line' },
    { value: 'circle',    label: 'Circle' },
    { value: 'square',    label: 'Square' },
    { value: 'text',      label: 'Text' },
  ];

  getMarkForChannel(channel: MarkChannel): MarkEncoding | undefined {
    return this.marks.find(m => m.channel === channel);
  }

  getFieldLabel(col: string): string {
    const f = this.allFields.find(x => x.fullId === col);
    return f ? f.label : col;
  }

  onDragOver(event: DragEvent, channel: MarkChannel): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    this.dragOverChannel = channel;
  }

  onDragLeave(channel: MarkChannel): void {
    if (this.dragOverChannel === channel) this.dragOverChannel = null;
  }

  onDrop(event: DragEvent, channel: MarkChannel): void {
    event.preventDefault();
    this.dragOverChannel = null;
    try {
      const json = event.dataTransfer!.getData('application/json');
      if (!json) return;
      const field: FlatField = JSON.parse(json);
      this.setMark(channel, field);
    } catch {}
  }

  setMark(channel: MarkChannel, field: FlatField): void {
    const newCol: ReportColumn = {
      col: field.fullId,
      agg: '',
      datePart: field.type === 'date' ? 'yearmonth' : '',
      key: Date.now() + '-mark-' + channel,
    };

    const filtered = this.marks.filter(m => m.channel !== channel);
    this.marks = [...filtered, { channel, field: newCol }];
    this.marksChange.emit([...this.marks]);
  }

  removeMark(channel: MarkChannel): void {
    this.marks = this.marks.filter(m => m.channel !== channel);
    this.marksChange.emit([...this.marks]);
  }
}
