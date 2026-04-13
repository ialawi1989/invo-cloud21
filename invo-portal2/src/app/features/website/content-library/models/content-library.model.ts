// ─── Field Types ─────────────────────────────────────────────────────────────

export type ContentFieldType =
  // Essentials
  | 'text'
  | 'long-text'
  | 'rich-text'
  | 'rich-content'
  | 'url'
  | 'email'
  | 'number'
  | 'tags'
  | 'boolean'
  | 'reference'
  | 'multi-reference'
  | 'color'
  | 'choice'
  | 'multi-choice'
  // Media
  | 'image'
  | 'media-gallery'
  | 'video'
  | 'audio'
  | 'document'
  | 'multi-document'
  // Time and location
  | 'date'
  | 'datetime'
  | 'time'
  | 'address';


export class ContentFieldOption {
  label = '';
  value = '';
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) this[key as keyof typeof this] = json[key];
    }
  }
}

export class ContentField {
  id         = '';
  name       = '';
  key        = '';
  type: ContentFieldType = 'text';
  required   = false;
  isSystem   = false;
  isVisible  = true;
  options: ContentFieldOption[] = [];
  referenceCollectionId = '';

  cardinality: 'one' | 'many' = 'one';

  // ── Validation constraints ──
  limitCharCount: any = false;
  minLength: any = null;
  maxLength: any = null;
  acceptSpecific: any = false;
  specificValues: any = '';
  limitRange: any = false;
  rangeMin: any = null;
  rangeMax: any = null;
  regex: any = '';
  minItems: any = null;
  maxItems: any = null;

  ParseJson(json: any): void {
    if (!json || typeof json !== 'object') return;
    if (json.id != null)          this.id = json.id;
    if (json.name != null)        this.name = json.name;
    if (json.key != null)         this.key = json.key;
    if (json.type != null)        this.type = json.type;
    if (json.required != null)    this.required = json.required;
    if (json.isSystem != null)    this.isSystem = json.isSystem;
    if (json.isVisible != null)   this.isVisible = json.isVisible;
    if (json.referenceCollectionId != null) this.referenceCollectionId = json.referenceCollectionId;
    if (json.cardinality != null) this.cardinality = json.cardinality;

    if (json.limitCharCount != null) this.limitCharCount = json.limitCharCount;
    if (json.minLength != null)      this.minLength = json.minLength;
    if (json.maxLength != null)      this.maxLength = json.maxLength;
    if (json.acceptSpecific != null)  this.acceptSpecific = json.acceptSpecific;
    if (json.specificValues != null)  this.specificValues = json.specificValues;
    if (json.limitRange != null)     this.limitRange = json.limitRange;
    if (json.rangeMin != null)       this.rangeMin = json.rangeMin;
    if (json.rangeMax != null)       this.rangeMax = json.rangeMax;
    if (json.regex != null)          this.regex = json.regex;
    if (json.minItems != null)       this.minItems = json.minItems;
    if (json.maxItems != null)       this.maxItems = json.maxItems;

    if (json.options) {
      this.options = (json.options || []).map((o: any) => {
        const opt = new ContentFieldOption();
        opt.ParseJson(o);
        return opt;
      });
    }
  }
}

export class ContentLibraryView {
  id      = '';
  name    = '';
  filters: { fieldKey: string; operator: string; value: any }[] = [];
  sortBy  = '';
  sortDir: 'asc' | 'desc' = 'asc';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) this[key as keyof typeof this] = json[key];
    }
  }
}

export class ContentLibraryTemplate {
  displayName  = '';
  slug         = '';
  description  = '';
  icon         = '';
  color        = '#32acc1';
  fields       : ContentField[] = [];
  views        : ContentLibraryView[] = [];

  controlVisibility  = false;
  defaultVisibility: 'visible' | 'hidden' = 'visible';
  hideTableLayout    = false;

  permMode:     'show' | 'collect' | 'advanced' = 'show';
  viewAudience: 'everyone' | 'members' | 'collaborators' = 'everyone';
  addAudience:  'everyone' | 'members' | 'collaborators' = 'everyone';
  permRows: { role: string; tooltip: string; view: boolean; add: boolean; update: boolean; del: boolean; locked?: boolean }[] = [];

  constructor() {
    const titleField       = new ContentField();
    titleField.id          = 'sys-title';
    titleField.name        = 'Title';
    titleField.key         = 'title';
    titleField.type        = 'text';
    titleField.required    = true;
    titleField.isSystem    = true;

    const slugField        = new ContentField();
    slugField.id           = 'sys-slug';
    slugField.name         = 'Slug';
    slugField.key          = 'slug';
    slugField.type         = 'url';
    slugField.required     = true;
    slugField.isSystem     = true;

    const publishedField   = new ContentField();
    publishedField.id      = 'sys-published';
    publishedField.name    = 'Published';
    publishedField.key     = 'published';
    publishedField.type    = 'boolean';
    publishedField.isSystem = true;

    this.fields = [titleField, slugField, publishedField];

    const defaultView      = new ContentLibraryView();
    defaultView.id         = 'default';
    defaultView.name       = 'Default view';
    this.views             = [defaultView];
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'fields') {
        this.fields = (json[key] || []).map((f: any) => {
          const field = new ContentField();
          field.ParseJson(f);
          return field;
        });
      } else if (key === 'views') {
        this.views = (json[key] || []).map((v: any) => {
          const view = new ContentLibraryView();
          view.ParseJson(v);
          return view;
        });
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }

  toJson(): any {
    return {
      displayName:        this.displayName,
      slug:               this.slug,
      description:        this.description,
      icon:               this.icon,
      color:              this.color,
      fields:             this.fields,
      views:              this.views,
      controlVisibility:  this.controlVisibility,
      defaultVisibility:  this.defaultVisibility,
      hideTableLayout:    this.hideTableLayout,
      permMode:           this.permMode,
      viewAudience:       this.viewAudience,
      addAudience:        this.addAudience,
      permRows:           this.permRows,
    };
  }
}

// ─── ContentItemTemplate ──────────────────────────────────────────────────────────

export class ContentItemTemplate {
  collectionId = '';
  index        = 0;
  data: Record<string, any> = {};
  status: 'published' | 'draft' = 'draft';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) this[key as keyof typeof this] = json[key];
    }
  }

  toJson(): any {
    return {
      collectionId: this.collectionId,
      index:        this.index,
      status:       this.status,
      data:         { ...this.data },
    };
  }
}
