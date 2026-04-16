# 📋 Angular 21 List Component - Clean Version

**100% clean, modern Angular 21 - No legacy code!**

## ✅ What's Inside

```
list-page/
├── components/
│   ├── list-page.component.ts        ← Main component (signals-based)
│   ├── list-page.component.html      ← Template (@if/@for syntax)
│   └── filter-modal.component.ts     ← Filter modal
├── interfaces/
│   └── list-page.types.ts            ← Type definitions
├── directives/
│   └── list-template.directives.ts   ← Custom templates
└── index.ts                          ← Public API
```

**NO utils folder - NO legacy code - NO old dependencies!**

---

## 🚀 Installation

### **Step 1: Extract**
```bash
unzip angular21-list-component-FINAL.zip -d src/app/shared/components/
```

### **Step 2: Add Path Alias** (Optional)
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@shared/*": ["src/app/shared/*"]
    }
  }
}
```

### **Step 3: Use It!**
```typescript
import { ListPageComponent } from '@shared/components/list-page';

@Component({
  imports: [ListPageComponent],
  template: `
    <app-list-page
      [columns]="columns"
      [dataSource]="loadData"
      [pagination]="{ enabled: true }"
      [search]="{ enabled: true }">
    </app-list-page>
  `
})
```

---

## ✨ Features

- ✅ **Pure Angular 21** - Signals, new control flow (@if/@for)
- ✅ **Standalone** - No modules needed
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Zero dependencies** - Just Router, CommonModule, FormsModule
- ✅ **Search & Filter** - Built-in with debounce
- ✅ **Sorting** - Click column headers
- ✅ **Pagination** - Configurable page sizes
- ✅ **Custom templates** - ng-template support
- ✅ **URL state** - Sync filters to URL
- ✅ **Mobile responsive** - Auto card layout

---

## 📝 Example Usage

```typescript
@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [ListPageComponent],
  template: `
    <app-list-page
      [columns]="columns"
      [dataSource]="loadProducts"
      [pagination]="{ enabled: true, default: 25 }"
      [search]="{ enabled: true, placeholder: 'Search...' }"
      [sorting]="{ enabled: true }"
      [filters]="filters"
      [selectable]="true"
      (rowClicked)="onRowClick($event)">
      
      <!-- Custom cell template -->
      <ng-template listCellTemplate="status" let-row>
        <span class="badge">{{ row.status }}</span>
      </ng-template>

      <!-- Custom row actions -->
      <ng-template listRowActions let-row>
        <button (click)="edit(row)">Edit</button>
        <button (click)="delete(row)">Delete</button>
      </ng-template>
    </app-list-page>
  `
})
export class ProductsListComponent {
  columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'price', label: 'Price', pipe: 'currency' },
    { key: 'status', label: 'Status', customTemplate: true }
  ];

  filters = [
    {
      type: 'checkbox-group',
      key: 'types',
      label: 'Type',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    }
  ];

  loadProducts = (params: ListQueryParams) => {
    return this.productService.getList(params);
  };

  onRowClick(event: any) {
    this.router.navigate(['/products', event.row.id]);
  }

  edit(row: any) {
    console.log('Edit', row);
  }

  delete(row: any) {
    console.log('Delete', row);
  }
}
```

---

## 🎯 API Response Format

Your service should return:

```typescript
interface ListResponse<T> {
  list: T[];           // Array of items
  count: number;       // Total count
  pageCount: number;   // Number of pages
}
```

Example:
```typescript
getProductList(params: ListQueryParams): Observable<ListResponse<Product>> {
  return this.http.post('/api/products/list', {
    page: params.page,
    limit: params.limit,
    search: params.searchTerm,
    sortBy: params.sortBy?.column,
    sortDir: params.sortBy?.direction,
    filters: params.filter
  }).pipe(
    map(response => ({
      list: response.data.list,
      count: response.data.count,
      pageCount: response.data.pageCount
    }))
  );
}
```

---

## 🐛 Troubleshooting

### **Error: Cannot find module '@shared/components/list-page'**

**Fix**: Add path alias to `tsconfig.json` or use relative import:
```typescript
import { ListPageComponent } from '../../../shared/components/list-page';
```

### **Error: Property 'Object' does not exist**

**Fix**: You're using an old version. Make sure you extracted the FINAL version and deleted any old files.

### **Error: utils/list-helpers.ts not found**

**Fix**: Delete the utils folder - it's not needed in the clean version:
```bash
rm -rf src/app/shared/components/list-page/utils
```

---

## ✅ Verification

After extraction, verify:

```bash
# Check structure
ls src/app/shared/components/list-page/

# Should show:
# components/
# directives/
# interfaces/
# index.ts

# Should NOT show utils/ folder!

# Check file count
find src/app/shared/components/list-page -type f | wc -l

# Should show: 6 files (not 10+ with old version)
```

---

## 🎉 You're Ready!

```bash
ng serve
# Navigate to your list page
# Everything should work!
```

---

## 📚 Files Included

1. **list-page.component.ts** (280 lines) - Main component with signals
2. **list-page.component.html** (170 lines) - Clean template
3. **filter-modal.component.ts** (140 lines) - Filter modal
4. **list-page.types.ts** (120 lines) - Type definitions
5. **list-template.directives.ts** (35 lines) - Template directives
6. **index.ts** (10 lines) - Public API

**Total: ~755 lines of clean, modern Angular 21 code**

Compare to old version: **1,200+ lines with legacy patterns**

---

## 💡 Tips

- Use with the `products-complete-i18n.zip` for a full example
- Customize columns, filters, and actions as needed
- Add custom templates for complex cells
- Sync state to URL for shareable links
- Works great with Tailwind CSS (included in templates)

---

**Clean Angular 21 - Production Ready!** 🚀
