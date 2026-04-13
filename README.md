# Angular Live Customizer

A WordPress Customizer-like live preview system built with Angular. This project demonstrates real-time communication between two separate Angular applications using `postMessage` API.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard App (http://localhost:4200)                          │
│  ┌────────────────────┐    ┌──────────────────────────────────┐ │
│  │   Controls Panel   │    │  iframe (http://localhost:4300)  │ │
│  │   - Colors         │───▶│                                  │ │
│  │   - Typography     │    │   Website Preview                │ │
│  │   - Layout         │◀───│                                  │ │
│  │   - Content        │    │   Live updates via postMessage   │ │
│  └────────────────────┘    └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- ✅ Real-time live preview
- ✅ Color picker for theme customization
- ✅ Typography controls (font family, size, weight)
- ✅ Layout controls (spacing, alignment)
- ✅ Content editing (site title, tagline, etc.)
- ✅ Responsive device preview (desktop/tablet/mobile)
- ✅ Undo/Redo functionality
- ✅ Save/Reset settings
- ✅ Import/Export configurations

## Project Structure

```
angular-customizer/
├── dashboard/          # Dashboard app (controls + iframe preview)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── customizer/
│   │   │   │   ├── control-panel/
│   │   │   │   ├── preview-frame/
│   │   │   │   └── controls/
│   │   │   ├── services/
│   │   │   │   ├── customizer.service.ts
│   │   │   │   └── settings.service.ts
│   │   │   └── models/
│   │   │       └── settings.model.ts
│   │   └── environments/
│   └── package.json
│
├── website/            # Website app (preview target)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── header/
│   │   │   │   ├── hero/
│   │   │   │   └── footer/
│   │   │   ├── services/
│   │   │   │   └── preview.service.ts
│   │   │   └── models/
│   │   └── environments/
│   └── package.json
│
└── README.md
```

## Installation

### Prerequisites
- Node.js 18+
- Angular CLI 17+

```bash
npm install -g @angular/cli
```

### Setup Dashboard App

```bash
cd dashboard
npm install
ng serve --port 4200
```

### Setup Website App

```bash
cd website
npm install
ng serve --port 4300
```

## Usage

1. Open Dashboard at `http://localhost:4200`
2. The website preview loads automatically in the iframe
3. Use the controls on the left panel to customize:
   - **Colors**: Header, background, text, accent colors
   - **Typography**: Font family, sizes, weights
   - **Layout**: Spacing, container width
   - **Content**: Site title, tagline, button text
4. Changes appear instantly in the preview
5. Click "Save" to persist changes or "Reset" to restore defaults

## Communication Flow

1. **Dashboard → Website**: Settings changes via `postMessage`
2. **Website → Dashboard**: Ready signal, click events, etc.

```typescript
// Dashboard sends
window.postMessage({
  type: 'setting-change',
  key: 'headerColor',
  value: '#ff0000'
}, targetOrigin);

// Website receives and applies
window.addEventListener('message', (event) => {
  if (event.data.type === 'setting-change') {
    applyChange(event.data.key, event.data.value);
  }
});
```

## Configuration

### Changing Origins

Edit the environment files to change the allowed origins:

**Dashboard** (`dashboard/src/environments/environment.ts`):
```typescript
export const environment = {
  websiteUrl: 'http://localhost:4300'
};
```

**Website** (`website/src/environments/environment.ts`):
```typescript
export const environment = {
  dashboardUrl: 'http://localhost:4200'
};
```

## License

MIT
