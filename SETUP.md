# Setup Guide

This guide will help you set up and run the Angular Customizer project.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Angular CLI** (v17 or higher)

Install Angular CLI globally:
```bash
npm install -g @angular/cli
```

## Quick Start

### Option 1: Using the Start Script

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

### Option 2: Manual Setup

1. **Install Dashboard dependencies:**
```bash
cd dashboard
npm install
```

2. **Install Website dependencies:**
```bash
cd ../website
npm install
```

3. **Start the Dashboard (Terminal 1):**
```bash
cd dashboard
ng serve --port 4200
```

4. **Start the Website (Terminal 2):**
```bash
cd website
ng serve --port 4300
```

5. **Open the Dashboard:**
Navigate to `http://localhost:4200` in your browser.

## Project Structure

```
angular-customizer/
├── dashboard/                 # Dashboard Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── customizer/      # Main customizer container
│   │   │   │   ├── control-panel/   # Settings panels
│   │   │   │   └── preview-frame/   # Iframe preview
│   │   │   ├── services/
│   │   │   │   └── customizer.service.ts
│   │   │   └── models/
│   │   │       └── settings.model.ts
│   │   └── environments/
│   ├── package.json
│   └── angular.json
│
├── website/                   # Website Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── header/
│   │   │   │   ├── hero/
│   │   │   │   ├── features/
│   │   │   │   └── footer/
│   │   │   ├── services/
│   │   │   │   └── preview.service.ts
│   │   │   └── models/
│   │   └── environments/
│   ├── package.json
│   └── angular.json
│
├── README.md
├── SETUP.md
├── start.sh
└── start.bat
```

## Configuration

### Changing Ports

**Dashboard (default: 4200):**
Edit `dashboard/package.json`:
```json
"start": "ng serve --port YOUR_PORT"
```

**Website (default: 4300):**
Edit `website/package.json`:
```json
"start": "ng serve --port YOUR_PORT"
```

### Changing Origins (for Production)

**Dashboard** - Edit `dashboard/src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  websiteUrl: 'https://your-website-domain.com'
};
```

**Website** - Edit `website/src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  dashboardUrl: 'https://your-dashboard-domain.com'
};
```

## How It Works

### Communication Flow

1. **Dashboard loads Website in iframe** with `?customize=true` query parameter
2. **Website detects customize mode** and initializes the PreviewService
3. **Website sends "ready" message** to Dashboard via `postMessage`
4. **Dashboard syncs all settings** to Website
5. **User changes a setting** → Dashboard sends change via `postMessage`
6. **Website receives and applies** the change in real-time

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `preview-ready` | Website → Dashboard | Website is loaded and ready |
| `setting-change` | Dashboard → Website | Single setting changed |
| `sync-all` | Dashboard → Website | All settings updated |
| `reset` | Dashboard → Website | Reset to defaults |
| `element-click` | Website → Dashboard | Element selected in preview |

## Adding New Settings

### 1. Add to Settings Model

Edit both `dashboard/src/app/models/settings.model.ts` and `website/src/app/models/settings.model.ts`:

```typescript
export interface CustomizerSettings {
  // ... existing settings
  myNewSetting: string;
}

export const DEFAULT_SETTINGS: CustomizerSettings = {
  // ... existing defaults
  myNewSetting: 'default value'
};
```

### 2. Add Control in Dashboard

Edit `dashboard/src/app/components/control-panel/control-panel.component.ts`:

```typescript
<div class="control-group">
  <label>My New Setting</label>
  <input type="text" 
         [value]="settings().myNewSetting"
         (input)="onTextChange('myNewSetting', $event)">
</div>
```

### 3. Add Handler in Website

Edit `website/src/app/services/preview.service.ts`:

```typescript
this.registerHandler('myNewSetting', (value) => {
  // Apply the setting (e.g., update CSS variable or DOM)
  document.documentElement.style.setProperty('--my-setting', value);
});
```

## Troubleshooting

### "Preview not loading"
- Ensure both apps are running on the correct ports
- Check browser console for CORS errors
- Verify environment URLs match actual running ports

### "Changes not applying"
- Open browser DevTools → Console to check for errors
- Verify the setting handler is registered in PreviewService
- Check that CSS variables are being applied correctly

### "postMessage not working"
- Verify origins match in both environment files
- Check that the Website loads with `?customize=true` parameter
- Look for security errors in browser console

## Building for Production

**Dashboard:**
```bash
cd dashboard
ng build --configuration production
```

**Website:**
```bash
cd website
ng build --configuration production
```

Deploy the `dist/` folders to your respective servers, ensuring CORS and origin configurations are updated for production URLs.
