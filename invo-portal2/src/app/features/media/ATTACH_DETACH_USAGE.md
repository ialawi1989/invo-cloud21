# 📎 Attach & Detach Media Features

## الـ Components الجديدة:

### 1️⃣ AttachMediaComponent
يسمح بربط الـ media بـ entities (Invoice, Product, etc.)

### 2️⃣ DetachMediaComponent  
يعرض الـ entities المربوطة ويسمح بفك الربط

---

## 🔧 التركيب:

### الخطوة 1: أضف الـ imports
```typescript
import { AttachMediaComponent } from './components/attach-media.component';
import { DetachMediaComponent } from './components/detach-media.component';
```

### الخطوة 2: استخدمهم في الـ template

```html
<!-- في media-gallery أو media table -->
<td class="upload-to-column">
  @if (media.uploadTo && media.uploadTo.length > 0) {
    <!-- Show linked entities -->
    @for (link of media.uploadTo; track link.id) {
      <span class="link-badge">
        {{ link.reference }}: {{ link.name }}
      </span>
    }
    <!-- Detach button -->
    <button class="detach-btn" (click)="openDetachModal(media)">
      Detach
    </button>
  } @else {
    <span class="no-links">Not linked</span>
  }
  
  <!-- Attach button -->
  <button class="attach-btn" (click)="openAttachModal(media)">
    🔗 Attach
  </button>
</td>

<!-- Attach Modal -->
@if (showAttachModal()) {
  <app-attach-media
    [mediaId]="selectedMedia()?.id || ''"
    [mediaName]="selectedMedia()?.name || ''"
    (save)="onAttachSave($event)"
    (cancel)="closeAttachModal()">
  </app-attach-media>
}

<!-- Detach Modal -->
@if (showDetachModal()) {
  <app-detach-media
    [mediaId]="selectedMedia()?.id || ''"
    [mediaName]="selectedMedia()?.name || ''"
    [uploadTo]="selectedMedia()?.uploadTo || []"
    (detach)="onDetachSave($event)"
    (cancel)="closeDetachModal()">
  </app-detach-media>
}
```

---

## 📝 في Component Class:

```typescript
import { signal } from '@angular/core';
import { MediaService } from '../services/media.service';

export class MediaGalleryComponent {
  // State
  showAttachModal = signal(false);
  showDetachModal = signal(false);
  selectedMedia = signal<Media | null>(null);

  constructor(private mediaService: MediaService) {}

  // ==================== ATTACH ====================

  openAttachModal(media: Media): void {
    this.selectedMedia.set(media);
    this.showAttachModal.set(true);
  }

  closeAttachModal(): void {
    this.showAttachModal.set(false);
    this.selectedMedia.set(null);
  }

  async onAttachSave(entities: EntityOption[]): Promise<void> {
    const media = this.selectedMedia();
    if (!media) return;

    try {
      // Call API for each entity
      for (const entity of entities) {
        await this.mediaService.appendAttachment({
          reference: entity.reference,
          referenceId: entity.id,
          attachment: [{ id: media.id }]
        });
      }

      alert('Media attached successfully!');
      this.closeAttachModal();
      this.refreshMedia(); // Reload media list
    } catch (error) {
      console.error('Failed to attach:', error);
      alert('Failed to attach media');
    }
  }

  // ==================== DETACH ====================

  openDetachModal(media: Media): void {
    this.selectedMedia.set(media);
    this.showDetachModal.set(true);
  }

  closeDetachModal(): void {
    this.showDetachModal.set(false);
    this.selectedMedia.set(null);
  }

  async onDetachSave(entities: LinkedEntity[]): Promise<void> {
    const media = this.selectedMedia();
    if (!media) return;

    try {
      // Call API for each entity
      for (const entity of entities) {
        await this.mediaService.deleteAttachment({
          reference: entity.reference,
          referenceId: entity.id,
          attachmentId: media.id!
        });
      }

      alert(`Detached from ${entities.length} entities`);
      this.closeDetachModal();
      this.refreshMedia(); // Reload media list
    } catch (error) {
      console.error('Failed to detach:', error);
      alert('Failed to detach media');
    }
  }
}
```

---

## 🎨 CSS للـ Buttons:

```scss
.upload-to-column {
  .link-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #EEF2FF;
    color: #4F46E5;
    border-radius: 4px;
    font-size: 0.875rem;
    margin: 0.25rem;
  }

  .no-links {
    color: #9CA3AF;
    font-style: italic;
  }

  .attach-btn,
  .detach-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    margin: 0.25rem;
    transition: all 0.2s;
  }

  .attach-btn {
    background: #10B981;
    color: white;

    &:hover {
      background: #059669;
    }
  }

  .detach-btn {
    background: #EF4444;
    color: white;

    &:hover {
      background: #DC2626;
    }
  }
}
```

---

## 🔗 API Calls المطلوبة:

### في media.service.ts:

```typescript
// Attach media to entity
async appendAttachment(params: {
  reference: string;      // 'invoice', 'product', etc.
  referenceId: string;    // Entity ID
  attachment: { id: string }[];  // Array of media IDs
}): Promise<boolean> {
  const response = await firstValueFrom(
    this.http.post<any>(`${this.baseUrl}media/appendAttachment`, params)
  );
  return response.success || false;
}

// Get linked entities for a media
async getAttachments(params: {
  reference: string;
  referenceId: string;
}): Promise<Media[]> {
  const response = await firstValueFrom(
    this.http.post<any>(`${this.baseUrl}media/getAttachments`, params)
  );
  return (response.data?.attachment || []).map((item: any) => new Media(item));
}

// Detach media from entity
async deleteAttachment(params: {
  reference: string;
  referenceId: string;
  attachmentId: string;
}): Promise<boolean> {
  const response = await firstValueFrom(
    this.http.post<any>(`${this.baseUrl}media/deleteAttachment`, params)
  );
  return response.success || false;
}
```

---

## 🎯 Features:

✅ **Attach to multiple entities** - يمكن ربط media واحد بعدة entities
✅ **Detach from specific entities** - اختيار entities معينة لفك الربط
✅ **Visual badges** - عرض الـ links بشكل واضح
✅ **Confirmation** - قبل الحذف
✅ **Real-time updates** - تحديث القائمة بعد التعديل

---

## 📸 مثال على الاستخدام:

```typescript
// 1. User clicks "Attach" button
openAttachModal(media);

// 2. User selects entity type (Invoice)
// 3. User selects specific invoice (INV-2024-001)
// 4. User clicks "Save"

// → API Call:
appendAttachment({
  reference: 'invoice',
  referenceId: 'invoice-id-123',
  attachment: [{ id: 'media-id-456' }]
})

// 5. Media is now linked!
// → media.uploadTo = [{ id: 'invoice-id-123', name: 'INV-2024-001', reference: 'invoice' }]
```

---

**Status:** ✅ Ready to use
**Components:** attach-media.component.ts, detach-media.component.ts
