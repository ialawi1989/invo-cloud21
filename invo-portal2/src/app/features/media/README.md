# Media Feature Module

Comprehensive media management feature for the Invo Portal with modern Angular 21 architecture.

## 🎯 Overview

The Media Feature provides a complete solution for managing media assets including:
- Image upload and management
- Document handling (PDF, Word, Excel, PowerPoint)
- Video and audio support
- Drag & drop interface
- Image compression
- Progress tracking
- Preview capabilities

## 📁 Structure

```
media/
├── components/          # Reusable UI components
│   ├── media-upload.component.*      # Upload interface with drag & drop
│   ├── media-gallery.component.*     # Gallery view with filtering
│   └── media-preview.component.*     # Preview modal for media
├── models/             # TypeScript models and interfaces
│   └── media.model.ts               # Media data models
├── pages/              # Feature pages
│   └── media-manager.component.*    # Main media management page
├── services/           # Business logic services
│   ├── media.service.ts             # Core media operations
│   └── image-compression.service.ts # Image compression utilities
├── utils/              # Utility functions
├── guards/             # Route guards
├── interceptors/       # HTTP interceptors
├── index.ts            # Public API exports
├── media.routes.ts     # Feature routing
└── README.md           # This file
```

## 🚀 Features

### 1. **Media Upload Component**
- Drag & drop file upload
- Multiple file support
- File validation
- Progress tracking
- Auto-upload option
- Image compression

### 2. **Media Gallery Component**
- Grid and list view modes
- Advanced filtering
- Multi-select capability
- Sorting options
- Search functionality
- Bulk operations

### 3. **Media Preview Component**
- Image preview with zoom
- Document viewer (PDF, Office)
- Video/audio playback
- Navigation between media
- Download capability
- Keyboard shortcuts

### 4. **Image Compression Service**
- Configurable quality settings
- Dimension constraints
- Batch processing
- Progressive compression
- Format conversion

### 5. **Media Service**
- Upload management
- File validation
- Progress tracking
- Queue management
- Attachment handling
- Download utilities

## 📦 Installation

### 1. Add to App Routes

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'media',
    loadChildren: () => import('./features/media').then(m => m.MEDIA_ROUTES)
  }
];
```

### 2. Configure Services

```typescript
// Configure base URL and auth token
import { MediaService } from './features/media';

constructor(private mediaService: MediaService) {
  this.mediaService.setBaseUrl('https://api.example.com/');
  this.mediaService.setAuthToken('your-auth-token');
}
```

## 💡 Usage Examples

### Upload Component

```html
<app-media-upload
  [config]="uploadConfig"
  [allowMultiple]="true"
  [showPreview]="true"
  [autoUpload]="false"
  (filesSelected)="onFilesSelected($event)"
  (uploadComplete)="onUploadComplete($event)"
  (uploadError)="onUploadError($event)"
/>
```

```typescript
uploadConfig: IMediaUploadConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  compressionEnabled: true,
  compressionQuality: 0.8,
  maxDimensions: { width: 1920, height: 1920 }
};
```

### Gallery Component

```html
<app-media-gallery
  [selectionMode]="'multiple'"
  [allowedTypes]="['image', 'docs']"
  [showUploadButton]="true"
  [showFilters]="true"
  (mediaSelected)="onMediaSelected($event)"
  (mediaDeleted)="onMediaDeleted($event)"
/>
```

### Preview Modal

```typescript
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MediaPreviewComponent } from './features/media';

constructor(private modalService: NgbModal) {}

openPreview(media: Media) {
  const modalRef = this.modalService.open(MediaPreviewComponent, {
    centered: true,
    size: 'xl',
    windowClass: 'media-preview-modal-window'
  });

  modalRef.componentInstance.media = media;
  modalRef.componentInstance.mediaList = [media];
}
```

### Direct Service Usage

```typescript
import { MediaService } from './features/media';

constructor(private mediaService: MediaService) {}

// Upload file
uploadFile(file: File) {
  this.mediaService.uploadFile(file, this.uploadConfig)
    .subscribe({
      next: (result) => {
        if (result.success) {
          console.log('Upload completed:', result.data);
        }
      },
      error: (error) => {
        console.error('Upload failed:', error);
      }
    });
}

// Get all media
loadMedia() {
  this.mediaService.getAllMedia()
    .subscribe(media => {
      console.log('Media items:', media);
    });
}

// Delete media
deleteMedia(id: string) {
  this.mediaService.deleteMedia(id)
    .subscribe(success => {
      console.log('Delete success:', success);
    });
}
```

## 🎨 Customization

### Styling

The media feature uses CSS variables for easy theming:

```scss
:root {
  --media-primary-color: #3b82f6;
  --media-bg-color: #ffffff;
  --media-border-color: #e5e7eb;
  --media-text-color: #111827;
  --media-hover-bg: #f3f4f6;
}
```

### Configuration

```typescript
// Custom upload configuration
const customConfig: IMediaUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  compressionEnabled: true,
  compressionQuality: 0.9,
  maxDimensions: { width: 2560, height: 2560 }
};
```

## 🔧 Advanced Features

### Image Compression

```typescript
import { ImageCompressionService } from './features/media';

constructor(private compression: ImageCompressionService) {}

compressImage(file: File) {
  this.compression.compress(file, {
    maxFileSizeBytes: 1024 * 1024,
    maxWidthPixels: 1920,
    qualityRatio: 0.8
  }).subscribe(compressedFile => {
    console.log('Compressed:', compressedFile);
  });
}
```

### Attachment Management

```typescript
// Append attachments to an entity
appendAttachment(referenceId: string) {
  this.mediaService.appendAttachment({
    reference: 'invoice',
    referenceId: referenceId,
    attachment: [{ id: 'media-id-1' }, { id: 'media-id-2' }]
  }).subscribe(success => {
    console.log('Attached:', success);
  });
}

// Get attachments
getAttachments(referenceId: string) {
  this.mediaService.getAttachments({
    reference: 'invoice',
    referenceId: referenceId
  }).subscribe(attachments => {
    console.log('Attachments:', attachments);
  });
}
```

## 🛠️ Development

### Building

```bash
ng build
```

### Testing

```bash
ng test
```

### Linting

```bash
ng lint
```

## 📱 Responsive Design

The media feature is fully responsive and optimized for:
- Desktop (1920px and above)
- Laptop (1200px - 1919px)
- Tablet (768px - 1199px)
- Mobile (below 768px)

## ♿ Accessibility

- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support

## 🔒 Security

- File type validation
- Size limit enforcement
- XSS protection
- CSRF token support
- Secure file URLs

## 🌐 Internationalization

Ready for i18n with ngx-translate:

```typescript
// Add translations
{
  "MEDIA": {
    "UPLOAD": "Upload Media",
    "DELETE": "Delete",
    "DOWNLOAD": "Download",
    "SELECT_ALL": "Select All"
  }
}
```

## 📊 Performance

- Lazy loading
- Virtual scrolling for large lists
- Image optimization
- Progressive loading
- Efficient state management

## 🔄 Updates & Migration

### From Angular 16 to 21

This module has been upgraded from Angular 16 to Angular 21 with:
- ✅ Standalone components
- ✅ Signals for reactive state
- ✅ Modern inject() DI
- ✅ Control flow syntax (@if, @for)
- ✅ RxJS 7+ patterns
- ✅ TypeScript 5.9

### Breaking Changes

1. **Standalone Components**: All components are now standalone
2. **Signals**: State management uses signals instead of BehaviorSubject
3. **Control Flow**: Template syntax updated to @if/@for

## 📝 License

Part of the Invo Portal project.

## 👥 Contributors

Developed for Invo Portal with modern Angular 21 best practices.

## 🆘 Support

For issues or questions, please refer to the main Invo Portal documentation.
