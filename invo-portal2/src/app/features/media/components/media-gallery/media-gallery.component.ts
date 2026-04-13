import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Media } from '../../models/media.model';
import { ModalService } from '../../../../shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '../../../../shared/modal/demo/confirm-modal.component';

/**
 * Media Gallery Component - Final version matching exact Media model
 * Displays media in grid or list view with individual action buttons
 */
@Component({
  selector: 'app-media-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-gallery.component.html',
  styleUrls: ['./media-gallery.component.scss']
})
export class MediaGalleryComponent {
  @Input() media: Media[] = [];
  @Input() viewMode: 'grid' | 'list' = 'grid';
  @Input() selectedItems: string[] = [];

  @Output() mediaEdit = new EventEmitter<Media>();
  @Output() mediaDetach = new EventEmitter<Media>();
  @Output() selectionChange = new EventEmitter<string[]>();

  private modalService = inject(ModalService);

  // Track selected items locally
  private _selectedItems = signal<string[]>([]);

  ngOnInit() {
    this._selectedItems.set(this.selectedItems);
  }

  ngOnChanges() {
    this._selectedItems.set(this.selectedItems);
  }

  /**
   * Check if an item is selected
   */
  isSelected(itemId: string): boolean {
    return this._selectedItems().includes(itemId);
  }

  /**
   * Toggle item selection
   */
  toggleSelection(itemId: string): void {
    const currentSelected = this._selectedItems();
    let newSelected: string[];

    if (currentSelected.includes(itemId)) {
      newSelected = currentSelected.filter(id => id !== itemId);
    } else {
      newSelected = [...currentSelected, itemId];
    }

    this._selectedItems.set(newSelected);
    this.selectionChange.emit(newSelected);
  }

  /**
   * Get file type based on file extension (no mimeType available)
   */
  getFileType(media: Media): string {
    // Prefer the API-provided type fields, fall back to extension sniffing.
    const apiType = (
      (media as any)?.contentType ||
      (media as any)?.mediaType?.fileType ||
      ''
    ).toString().toLowerCase();

    const knownTypes = ['image', 'video', 'audio', 'document', 'model'];
    if (knownTypes.includes(apiType)) return apiType;
    if (apiType === 'doc' || apiType === 'docs') return 'document';

    // Fall back to extension from name or mediaType.extension
    const extFromName = media.name?.split('.').pop()?.toLowerCase() || '';
    const extFromType = ((media as any)?.mediaType?.extension || '').toString().toLowerCase();
    const extension = extFromType || extFromName;

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    const documentExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'];
    const modelExts = ['obj', 'fbx', 'glb', 'gltf', '3ds', 'dae', 'blend'];

    if (imageExts.includes(extension)) return 'image';
    if (videoExts.includes(extension)) return 'video';
    if (audioExts.includes(extension)) return 'audio';
    if (documentExts.includes(extension)) return 'document';
    if (modelExts.includes(extension)) return 'model';

    return 'document';
  }

  /**
   * Get color class for file type background
   */
  getTypeColorClass(type: string): string {
    switch (type) {
      case 'document':
        return 'bg-orange-50 border-orange-100';
      case 'video':
        return 'bg-red-50 border-red-100';
      case 'audio':
        return 'bg-green-50 border-green-100';
      case 'model':
        return 'bg-purple-50 border-purple-100';
      case 'image':
        return 'bg-sky-50 border-sky-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  }

  /**
   * Get badge color class for file type
   */
  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'document':
        return 'bg-orange-100 text-orange-700';
      case 'video':
        return 'bg-red-100 text-red-700';
      case 'audio':
        return 'bg-green-100 text-green-700';
      case 'model':
        return 'bg-purple-100 text-purple-700';
      case 'image':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  /**
   * Handle edit action
   */
  onEdit(media: Media): void {
    this.mediaEdit.emit(media);
  }

  /**
   * Handle detach action
   */
  onDetach(media: Media): void {
    this.mediaDetach.emit(media);
  }

  /**
   * Handle delete action
   */
  async onDelete(media: Media): Promise<void> {
    const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: 'Delete media',
          message: `Are you sure you want to delete "${media.name}"? This cannot be undone.`,
          confirm: 'Delete',
          danger: true,
        },
      }
    );

    const confirmed = await ref.afterClosed();
    if (confirmed) {
      try {
        // Call delete API here
        console.log('Deleting media:', media);

        // Remove from selection if selected
        if (media.id && this.isSelected(media.id)) {
          this.toggleSelection(media.id);
        }

        // Emit delete event (handled by parent)
        // You can add a delete event emitter if needed
      } catch (error) {
        console.error('Error deleting media:', error);
      }
    }
  }

  /**
   * Format file size for display - handles IMediaSize type
   */
  formatFileSize(size: any): string {
    // Handle IMediaSize type - extract the actual number value
    let bytes: number = 0;

    if (size && typeof size === 'object') {
      // If it's an IMediaSize object, try to get the value
      bytes = size.value || size.bytes || size.size || 0;
    } else if (typeof size === 'number') {
      bytes = size;
    } else if (typeof size === 'string') {
      bytes = parseInt(size) || 0;
    }

    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format date for display - uses createdDate property
   */
  formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'Unknown';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  }
}
