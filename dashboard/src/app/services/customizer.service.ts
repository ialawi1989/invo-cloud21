import { Injectable, signal, computed } from '@angular/core';
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
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomizerService {
  private iframeWindow: Window | null = null;
  private targetOrigin = environment.websiteUrl;
  
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
    this.loadSavedData();
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

  // Save/Load
  saveData(): void {
    const pageData: PageData = {
      globalSettings: this._globalSettings(),
      components: this._components()
    };
    localStorage.setItem('page-builder-data', JSON.stringify(pageData));
    this._hasUnsavedChanges.set(false);
  }

  private loadSavedData(): void {
    const saved = localStorage.getItem('page-builder-data');
    if (saved) {
      try {
        const data = JSON.parse(saved) as PageData;
        this._globalSettings.set({ ...DEFAULT_GLOBAL_SETTINGS, ...data.globalSettings });
        this._components.set(data.components || []);
      } catch {
        this._globalSettings.set({ ...DEFAULT_GLOBAL_SETTINGS });
        this._components.set([]);
      }
    }
    this.addToHistory();
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

  // Load page data by slug
  loadPageData(slug: string): void {
    // Clear current selection
    this._selectedComponentId.set(null);
    
    // Try to load saved data for this page
    const saved = localStorage.getItem(`page-builder-${slug}`);
    if (saved) {
      try {
        const data = JSON.parse(saved) as PageData;
        this._globalSettings.set({ ...DEFAULT_GLOBAL_SETTINGS, ...data.globalSettings });
        this._components.set(data.components || []);
      } catch {
        this.resetToDefaults();
      }
    } else {
      // Start fresh for new pages
      this.resetToDefaults();
    }
    
    // Reset history for new page
    this._history.set([]);
    this._historyIndex.set(-1);
    this.addToHistory();
    this._hasUnsavedChanges.set(false);
    this.syncToPreview();
  }

  // Save page data with slug
  savePageData(slug: string): void {
    const pageData: PageData = {
      globalSettings: this._globalSettings(),
      components: this._components()
    };
    localStorage.setItem(`page-builder-${slug}`, JSON.stringify(pageData));
    this._hasUnsavedChanges.set(false);
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
