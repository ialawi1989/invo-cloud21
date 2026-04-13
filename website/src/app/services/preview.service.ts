import { Injectable, signal, computed } from '@angular/core';
import { 
  GlobalSettings, 
  DEFAULT_GLOBAL_SETTINGS, 
  MessagePayload,
  PageData,
  PageComponent
} from '../models/settings.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PreviewService {
  private dashboardOrigin = environment.dashboardUrl;
  
  private _isCustomizeMode = signal<boolean>(false);
  private _globalSettings = signal<GlobalSettings>({ ...DEFAULT_GLOBAL_SETTINGS });
  private _components = signal<PageComponent[]>([]);
  
  isCustomizeMode = computed(() => this._isCustomizeMode());
  globalSettings = computed(() => this._globalSettings());
  components = computed(() => this._components());

  constructor() {
    this.init();
  }

  private init(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const customizeMode = urlParams.get('customize') === 'true';
    
    if (customizeMode) {
      this._isCustomizeMode.set(true);
      document.body.classList.add('customize-mode');
      this.setupMessageListener();
      setTimeout(() => this.notifyReady(), 100);
    }
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.dashboardOrigin) return;
      this.handleMessage(event.data as MessagePayload);
    });
  }

  private handleMessage(data: MessagePayload): void {
    switch (data.type) {
      case 'page-data':
        if (data.pageData) {
          this.applyPageData(data.pageData);
        }
        break;
      case 'sync-all':
        if (data.settings) {
          this.applyGlobalSettings(data.settings);
        }
        break;
      case 'scroll-to-component':
        if (data.componentId) {
          this.scrollToComponent(data.componentId);
        }
        break;
      case 'reset':
        this.applyPageData({
          globalSettings: DEFAULT_GLOBAL_SETTINGS,
          components: []
        });
        break;
    }
  }

  private scrollToComponent(componentId: string): void {
    // Find the component element by its data attribute
    const element = document.querySelector(`[data-component-id="${componentId}"]`);
    if (element) {
      // Remove previous highlights
      document.querySelectorAll('.component-highlight').forEach(el => {
        el.classList.remove('component-highlight');
      });
      
      // Add highlight to the selected element
      element.classList.add('component-highlight');
      
      // Scroll to the element
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove highlight after animation
      setTimeout(() => {
        element.classList.remove('component-highlight');
      }, 2000);
    }
  }

  private applyPageData(pageData: PageData): void {
    this._globalSettings.set({ ...pageData.globalSettings });
    this._components.set([...pageData.components]);
    this.applyGlobalSettings(pageData.globalSettings);
  }

  private applyGlobalSettings(settings: GlobalSettings): void {
    const root = document.documentElement;
    
    // Colors
    root.style.setProperty('--header-bg', settings.headerBgColor);
    root.style.setProperty('--header-text', settings.headerTextColor);
    root.style.setProperty('--body-bg', settings.bodyBgColor);
    root.style.setProperty('--body-text', settings.bodyTextColor);
    root.style.setProperty('--primary', settings.primaryColor);
    root.style.setProperty('--secondary', settings.secondaryColor);
    root.style.setProperty('--accent', settings.accentColor);
    
    // Typography
    root.style.setProperty('--font-family', `'${settings.fontFamily}', sans-serif`);
    root.style.setProperty('--heading-font', `'${settings.headingFontFamily}', sans-serif`);
    root.style.setProperty('--base-font-size', `${settings.baseFontSize}px`);
    root.style.setProperty('--heading-font-size', `${settings.headingFontSize}px`);
    root.style.setProperty('--line-height', settings.lineHeight.toString());
    root.style.setProperty('--font-weight', settings.fontWeight.toString());
    
    // Layout
    root.style.setProperty('--container-width', `${settings.containerWidth}px`);
    root.style.setProperty('--header-height', `${settings.headerHeight}px`);
    root.style.setProperty('--section-padding', `${settings.sectionPadding}px`);
    root.style.setProperty('--border-radius', `${settings.borderRadius}px`);
  }

  private notifyReady(): void {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'preview-ready' }, this.dashboardOrigin);
    }
  }
}
