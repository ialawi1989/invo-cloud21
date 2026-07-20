import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  CalculatedField,
  CalcOperator,
  CalcAggFunc,
  FlatField,
} from '../../shared/models/custom-report.model';

interface CalcFieldView {
  id: string;
  name: string;
  formulaLabel: string;
  source: CalculatedField;
}

interface FieldOption {
  value: string;
  label: string;
}

const mathOperatorOptions: { value: CalcOperator; label: string }[] = [
  { value: '+', label: '+' },
  { value: '-', label: '-' },
  { value: '*', label: 'x' },
  { value: '/', label: '/' },
  { value: '%', label: '%' },
];

@Component({
  selector: 'app-calculated-fields',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './calculated-fields.component.html',
  styleUrls: ['./calculated-fields.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculatedFieldsComponent implements OnChanges {
  @Input() fields: CalculatedField[] = [];
  @Input() allFields: FlatField[] = [];
  @Input() dataKeys: string[] = [];
  @Output() fieldsChange = new EventEmitter<CalculatedField[]>();

  constructor(private cdr: ChangeDetectorRef) {}

  editingField: CalculatedField | null = null;
  showEditor = false;
  mathOperators = mathOperatorOptions;
  aggFunctions: { value: CalcAggFunc; label: string }[] = [
    { value: 'sum', label: 'SUM' },
    { value: 'avg', label: 'AVG' },
    { value: 'min', label: 'MIN' },
    { value: 'max', label: 'MAX' },
    { value: 'count', label: 'COUNT' },
  ];

  // Cached for template
  cachedFieldViews: CalcFieldView[] = [];
  cachedAvailableFields: FieldOption[] = [];
  cachedNumericFields: FieldOption[] = [];

  ngOnChanges(_changes: SimpleChanges): void {
    this.rebuildCaches();
  }

  private rebuildCaches(): void {
    this.cachedFieldViews = this.fields.map(cf => ({
      id: cf.id,
      name: cf.name,
      formulaLabel: this.buildFormulaLabel(cf),
      source: cf,
    }));

    const seen = new Set<string>();
    const result: FieldOption[] = [];
    for (const dk of this.dataKeys) {
      if (!seen.has(dk)) {
        seen.add(dk);
        result.push({ value: dk, label: this.resolveLabel(dk) });
      }
    }
    for (const f of this.allFields) {
      if (!seen.has(f.fullId)) {
        seen.add(f.fullId);
        result.push({ value: f.fullId, label: f.label + ' (' + f.table + ')' });
      }
    }
    this.cachedAvailableFields = result;

    // Numeric-only fields for math/summary modes
    const numericFullIds = new Set<string>(
      this.allFields.filter(f => f.type === 'number').map(f => f.fullId)
    );
    const aggPrefixes = ['sum.', 'avg.', 'min.', 'max.', 'count.'];
    this.cachedNumericFields = result.filter(f => {
      // Aggregated columns (sum.X, avg.X, etc.) are always numeric
      if (aggPrefixes.some(p => f.value.startsWith(p))) return true;
      // Plain field references: check against known numeric fields
      return numericFullIds.has(f.value);
    });
  }

  private resolveLabel(key: string): string {
    const f = this.allFields.find(x => x.fullId === key);
    if (f) return f.label;
    const parts = (key || '').split('.');
    if (parts.length >= 2) return parts[parts.length - 1];
    return key || '';
  }

  private buildFormulaLabel(cf: CalculatedField): string {
    if (cf.mode === 'summary') {
      const func = (cf.aggFunc || 'sum').toUpperCase();
      const expr = cf.operands.map((o, i) => {
        const name = o.type === 'field' ? this.resolveLabel(o.value) : o.value;
        if (i === 0) return name;
        return (o.operator || '+') + ' ' + name;
      }).join(' ');
      return func + '(' + expr + ')';
    }
    if (cf.mode === 'concat') {
      return cf.operands.map(o => o.type === 'field' ? this.resolveLabel(o.value) : '"' + o.value + '"').join(' & ');
    }
    return cf.operands.map((o, i) => {
      const name = o.type === 'field' ? this.resolveLabel(o.value) : o.value;
      if (i === 0) return name;
      return (o.operator || '+') + ' ' + name;
    }).join(' ');
  }

  // ─── Actions ──────────────────────────────────────

  addMathField(): void {
    this.editingField = {
      id: 'calc-' + Date.now(),
      name: '',
      mode: 'math',
      operands: [
        { type: 'field', value: '' },
        { type: 'field', value: '', operator: '+' },
      ],
      resultType: 'number',
    };
    this.showEditor = true;
  }

  addSummaryField(): void {
    this.editingField = {
      id: 'calc-' + Date.now(),
      name: '',
      mode: 'summary',
      operands: [
        { type: 'field', value: '' },
        { type: 'field', value: '', operator: '-' },
      ],
      aggFunc: 'sum',
      resultType: 'number',
    };
    this.showEditor = true;
  }

  addConcatField(): void {
    this.editingField = {
      id: 'calc-' + Date.now(),
      name: '',
      mode: 'concat',
      operands: [
        { type: 'field', value: '' },
        { type: 'field', value: '' },
      ],
      separator: ' ',
      resultType: 'text',
    };
    this.showEditor = true;
  }

  editField(cf: CalculatedField): void {
    this.editingField = { ...cf, operands: cf.operands.map(o => ({ ...o })) };
    this.showEditor = true;
  }

  removeField(id: string): void {
    this.fields = this.fields.filter(f => f.id !== id);
    this.fieldsChange.emit([...this.fields]);
    this.rebuildCaches();
  }

  addOperand(): void {
    if (!this.editingField) return;
    this.editingField.operands.push({
      type: 'field',
      value: '',
      operator: this.editingField.mode === 'math' ? '+' : undefined,
    });
  }

  removeOperand(index: number): void {
    if (!this.editingField || this.editingField.operands.length <= 2) return;
    this.editingField.operands.splice(index, 1);
  }

  saveField(): void {
    if (!this.editingField || !this.editingField.name.trim()) return;
    const filledCount = this.editingField.operands.filter(o => o.value.trim()).length;
    const minRequired = this.editingField.mode === 'summary' ? 1 : 2;
    if (filledCount < minRequired) return;

    const existing = this.fields.findIndex(f => f.id === this.editingField!.id);
    if (existing >= 0) {
      this.fields = this.fields.map((f, i) => i === existing ? this.editingField! : f);
    } else {
      this.fields = [...this.fields, this.editingField];
    }
    this.fieldsChange.emit([...this.fields]);
    this.showEditor = false;
    this.editingField = null;
    this.rebuildCaches();
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.showEditor = false;
    this.editingField = null;
    this.cdr.markForCheck();
  }
}
