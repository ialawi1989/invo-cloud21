/* Ported verbatim from InvoCloudFront2 core/models/employee/employee.ts —
   the dashboard-canvas/layout-editor data classes the report builder uses. */

export class DashboardRow {
  id: string = "";
  order: number = 0;
  widgets: DashboardWidgets[] = [];

  constructor(id?: string) {
    this.id = id || this.generateId();
  }

  generateId(): string {
    return 'row_' + Math.random().toString(36).substr(2, 9);
  }

  // Get total columns used by widgets in this row
  getTotalColSpan(): number {
    return this.widgets.reduce((sum, w) => sum + (w.colSpan || 12), 0);
  }

  // Get remaining columns available
  getRemainingCols(): number {
    return Math.max(0, 12 - this.getTotalColSpan());
  }

  ParseJson(json: any): void {
    if (json.id) this.id = json.id;
    if (json.order !== undefined) this.order = json.order;

    // Parse widgets array
    if (json.widgets && Array.isArray(json.widgets)) {
      this.widgets = json.widgets.map((w: any) => {
        const widget = new DashboardWidgets();
        widget.ParseJson(w);
        return widget;
      });
    }
  }

  toJson(): any {
    return {
      id: this.id,
      order: this.order,
      widgets: this.widgets.map(w => w.toJson())
    };
  }
}

// Dashboard Layout - contains all rows
export class DashboardLayout {
  rows: DashboardRow[] = [];

  ParseJson(json: any): void {
    if (json.rows && Array.isArray(json.rows)) {
      this.rows = json.rows.map((r: any) => {
        const row = new DashboardRow();
        row.ParseJson(r);
        return row;
      });
    }
  }

  toJson(): any {
    return {
      rows: this.rows.map(r => r.toJson())
    };
  }
}

// Keep for backward compatibility
export class DashboardSections {
  index: number = 0;
  columns: any = {}

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class DashboardWidgets {
  title: string = "";
  slug: string = "";
  show: boolean = false;
  checked: boolean = false;
  isAdded: boolean = false;
  defaultHeight: number = 350;
  index: number = 0;

  // Layout properties (12-column grid system)
  rowId: string = "";
  colSpan: number = 12;  // 1-12 columns (default: 12 = full width)
  order: number = 0;     // Order within the row

  // Custom-report widgets: rendered from a saved custom report instead of a
  // built-in widget component. `slug` is `custom-report:<customReportId>`.
  isCustom: boolean = false;
  customReportId: string = "";
  // Which sheet of the report to show, and the report filter values chosen for
  // this widget at add-time (FilterRule[] shape, kept loose to avoid coupling
  // core models to the custom-reports feature types).
  customSheetId: string = "";
  customFilters: any[] = [];
  customPageSize: number = 0; // 0 → use the report's saved page size
  // Default server-side sort chosen in the Customize modal (SortRule[] shape:
  // [{ id: "Table.col", mod: "ASC" | "DESC" }]). Empty → the sheet's saved sort.
  customSort: any[] = [];

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
    // Migration: convert old columnSpan to new colSpan
    if (json.columnSpan && !json.colSpan) {
      this.colSpan = json.columnSpan === 1 ? 12 :
                     json.columnSpan === 2 ? 6 :
                     json.columnSpan === 3 ? 4 :
                     json.columnSpan === 4 ? 3 : 12;
    }
  }

  toJson(): any {
    return {
      title: this.title,
      slug: this.slug,
      isAdded: this.isAdded,
      defaultHeight: this.defaultHeight,
      index: this.index,
      rowId: this.rowId,
      colSpan: this.colSpan,
      order: this.order,
      isCustom: this.isCustom,
      customReportId: this.customReportId,
      customSheetId: this.customSheetId,
      customFilters: this.customFilters,
      customPageSize: this.customPageSize,
      customSort: this.customSort
    };
  }

  clone(): DashboardWidgets {
    const widget = new DashboardWidgets();
    widget.ParseJson(this.toJson());
    widget.show = this.show;
    widget.checked = this.checked;
    return widget;
  }
}
