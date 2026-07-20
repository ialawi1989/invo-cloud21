import { Pipe, PipeTransform } from '@angular/core';
import { ReportColumn } from '../models/custom-report.model';

@Pipe({ name: 'dimensionFilter', standalone: true })
export class DimensionFilterPipe implements PipeTransform {
  transform(columns: ReportColumn[]): ReportColumn[] {
    return columns.filter((c) => !c.agg);
  }
}

@Pipe({ name: 'measureFilter', standalone: true })
export class MeasureFilterPipe implements PipeTransform {
  transform(columns: ReportColumn[]): ReportColumn[] {
    return columns.filter((c) => !!c.agg);
  }
}
