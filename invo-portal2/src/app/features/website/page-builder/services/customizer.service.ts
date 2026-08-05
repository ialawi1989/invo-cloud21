import { Injectable, computed, inject, signal } from '@angular/core';
import { 
  GlobalSettings, 
  DEFAULT_GLOBAL_SETTINGS, 
  MessagePayload,
  PageData,
  PageComponent,
  ComponentType,
  COMPONENT_LIBRARY,
  generateId
} from '../models/settings.model';
import { StorefrontUrlService } from '@core/auth/storefront-url.service';

@Injectable({
  providedIn: 'root'
})
export class CustomizerService {
  private iframeWindow: Window | null = null;
  private storefront = inject(StorefrontUrlService);

  /** Origin of the storefront that hosts the preview iframe. Resolved through
   *  StorefrontUrlService so local / LAN / dev / prod and custom domains all
   *  work — a hardcoded origin would silently break postMessage delivery. */
  private get targetOrigin(): string {
    return this.storefront.baseUrl();
  }
  
  // Page Data
  private _globalSettings = signal<GlobalSettings>({ ...DEFAULT_GLOBAL_SETTINGS });
  private _components = signal<PageComponent[]>([]);
  private _selectedComponentId = signal<string | null>(null);
  
  // UI State
  private _isPreviewReady = signal<boolean>(false);
  private _hasUnsavedChanges = signal<boolean>(false);
  private _activeTab = signal<'components' | 'settings'>('components');
  
  // History for undo/redo
  private _history = signal<PageData[]>([]);
  private _historyIndex = signal<number>(-1);
  
  // Public computed signals
  globalSettings = computed(() => this._globalSettings());
  components = computed(() => this._components());
  selectedComponentId = computed(() => this._selectedComponentId());
  selectedComponent = computed(() => {
    const id = this._selectedComponentId();
    return this._components().find(c => c.id === id) || null;
  });
  isPreviewReady = computed(() => this._isPreviewReady());
  hasUnsavedChanges = computed(() => this._hasUnsavedChanges());
  activeTab = computed(() => this._activeTab());
  canUndo = computed(() => this._historyIndex() > 0);
  canRedo = computed(() => this._historyIndex() < this._history().length - 1);

  constructor() {
    this.setupMessageListener();
  }

  // Tab management
  setActiveTab(tab: 'components' | 'settings'): void {
    this._activeTab.set(tab);
  }

  // Register iframe
  registerIframe(iframe: HTMLIFrameElement): void {
    this.iframeWindow = iframe.contentWindow;
  }

  // Component management
  addComponent(type: ComponentType): void {
    const definition = COMPONENT_LIBRARY.find(c => c.type === type);
    if (!definition) return;

    const newComponent: PageComponent = {
      id: generateId(),
      type,
      settings: { ...definition.defaultSettings },
      order: this._components().length
    };

    const components = [...this._components(), newComponent];
    this._components.set(components);
    this._selectedComponentId.set(newComponent.id);
    this._hasUnsavedChanges.set(true);
    this.addToHistory();
    this.syncToPreview();
  }

  removeComponent(id: string): void {
    const components = this._components().filter(c => c.id !== id);
    // Reorder
    components.forEach((c, i) => c.order = i);
    this._components.set(components);
    
    if (this._selectedComponentId() === id) {
      this._selectedComponentId.set(null);
    }
    
    this._hasUnsavedChanges.set(true);
    this.addToHistory();
    this.syncToPreview();
  }

  selectComponent(id: string | null): void {
    this._selectedComponentId.set(id);
    // Send message to preview to scroll to and highlight the component
    if (id) {
      this.scrollToComponentInPreview(id);
    }
  }

  private scrollToComponentInPreview(componentId: string): void {
    if (this.iframeWindow) {
      this.iframeWindow.postMessage({
        type: 'scroll-to-component',
        componentId
      }, this.targetOrigin);
    }
  }

  moveComponent(id: string, direction: 'up' | 'down'): void {
    const components = [...this._components()];
    const index = components.findIndex(c => c.id === id);
    
    if (direction === 'up' && index > 0) {
      [components[index], components[index - 1]] = [components[index - 1], components[index]];
    } else if (direction === 'down' && index < components.length - 1) {
      [components[index], components[index + 1]] = [components[index + 1], components[index]];
    }
    
    components.forEach((c, i) => c.order = i);
    this._components.set(components);
    this._hasUnsavedChanges.set(true);
    this.addToHistory();
    this.syncToPreview();
  }

  duplicateComponent(id: string): void {
    const original = this._components().find(c => c.id === id);
    if (!original) return;

    const newComponent: PageComponent = {
      id: generateId(),
      type: original.type,
      settings: { ...original.settings },
      order: this._components().length
    };

    const components = [...this._components(), newComponent];
    this._components.set(components);
    this._selectedComponentId.set(newComponent.id);
    this._hasUnsavedChanges.set(true);
    this.addToHistory();
    this.syncToPreview();
  }

  // Update component settings
  updateComponentSetting(componentId: string, key: string, value: any): void {
    const components = this._components().map(c => {
      if (c.id === componentId) {
        return { ...c, settings: { ...c.settings, [key]: value } };
      }
      return c;
    });
    
    this._components.set(components);
    this._hasUnsavedChanges.set(true);
    this.syncToPreview();
  }

  // Global settings
  updateGlobalSetting<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]): void {
    const settings = { ...this._globalSettings(), [key]: value };
    this._globalSettings.set(settings);
    this._hasUnsavedChanges.set(true);
    this.syncToPreview();
  }

  // Sync to preview
  syncToPreview(): void {
    const pageData: PageData = {
      globalSettings: this._globalSettings(),
      components: this._components()
    };
    
    this.sendToPreview({
      type: 'page-data',
      pageData
    });
  }

  // ── Persistence ────────────────────────────────────────────────────────
  // The prototype kept pages in localStorage. Here the page ROW is the store:
  // the editor host loads `template.sections` in and writes the snapshot back
  // through WebsitePagesService, so a page edited on one machine is the page
  // every other machine and the storefront see.

  /** Current editor state, for the host to persist into `template.sections`. */
  snapshot(): PageData {
    return {
      globalSettings: this._globalSettings(),
      components: this._components(),
    };
  }

  /** Called by the host once the save round-trip succeeds. */
  markSaved(): void {
    this._hasUnsavedChanges.set(false);
  }

  // Reset
  resetToDefaults(): void {
    this._globalSettings.set({ ...DEFAULT_GLOBAL_SETTINGS });
    this._components.set([]);
    this._selectedComponentId.set(null);
    this._hasUnsavedChanges.set(false);
    this.addToHistory();
    this.syncToPreview();
  }

  /**
   * Load a page's saved editor state.
   *
   * `sections` is whatever the row carries: the editor's own
   * `{ globalSettings, components }` snapshot, or a bare component array from
   * an older save. Both are accepted so an existing page opens instead of
   * silently starting blank.
   */
  loadPageData(sections: any): void {
    this._selectedComponentId.set(null);

    const data: Partial<PageData> = Array.isArray(sections)
      ? { components: sections }
      : (sections ?? {});

    this._globalSettings.set({ ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings ?? {}) });
    this._components.set(Array.isArray(data.components) ? data.components : []);

    // Fresh history per page — undo must never step into another page's state.
    this._history.set([]);
    this._historyIndex.set(-1);
    this.addToHistory();
    this._hasUnsavedChanges.set(false);
    this.syncToPreview();
  }

  // History (undo/redo)
  undo(): void {
    const index = this._historyIndex();
    if (index > 0) {
      this._historyIndex.set(index - 1);
      const state = this._history()[index - 1];
      this._globalSettings.set({ ...state.globalSettings });
      this._components.set([...state.components]);
      this._hasUnsavedChanges.set(true);
      this.syncToPreview();
    }
  }

  redo(): void {
    const index = this._historyIndex();
    const history = this._history();
    if (index < history.length - 1) {
      this._historyIndex.set(index + 1);
      const state = history[index + 1];
      this._globalSettings.set({ ...state.globalSettings });
      this._components.set([...state.components]);
      this._hasUnsavedChanges.set(true);
      this.syncToPreview();
    }
  }

  private addToHistory(): void {
    const pageData: PageData = {
      globalSettings: { ...this._globalSettings() },
      components: [...this._components()]
    };
    
    const history = this._history().slice(0, this._historyIndex() + 1);
    history.push(pageData);
    
    if (history.length > 50) {
      history.shift();
    }
    
    this._history.set(history);
    this._historyIndex.set(history.length - 1);
  }

  // Export/Import
  exportData(): string {
    const pageData: PageData = {
      globalSettings: this._globalSettings(),
      components: this._components()
    };
    return JSON.stringify(pageData, null, 2);
  }

  importData(json: string): boolean {
    try {
      const data = JSON.parse(json) as PageData;
      this._globalSettings.set({ ...DEFAULT_GLOBAL_SETTINGS, ...data.globalSettings });
      this._components.set(data.components || []);
      this._hasUnsavedChanges.set(true);
      this.addToHistory();
      this.syncToPreview();
      return true;
    } catch {
      return false;
    }
  }

  // Message handling
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.targetOrigin) return;
      this.handlePreviewMessage(event.data);
    });
  }

  private handlePreviewMessage(data: MessagePayload): void {
    if (data.type === 'preview-ready') {
      this._isPreviewReady.set(true);
      this.syncToPreview();
    }
  }

  private sendToPreview(message: MessagePayload): void {
    if (this.iframeWindow) {
      this.iframeWindow.postMessage(message, this.targetOrigin);
    }
  }
}
