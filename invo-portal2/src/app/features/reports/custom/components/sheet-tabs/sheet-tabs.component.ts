import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetConfig } from '../../shared/models/custom-report.model';

@Component({
  selector: 'app-sheet-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sheet-tabs.component.html',
  styleUrls: ['./sheet-tabs.component.scss'],
})
export class SheetTabsComponent {
  @Input() sheets: SheetConfig[] = [];
  @Input() activeSheetId = '';
  /** When false, hides add / rename / delete affordances (read-only viewers). */
  @Input() canEdit = true;
  @Output() selectSheet = new EventEmitter<string>();
  @Output() addSheet = new EventEmitter<void>();
  @Output() removeSheet = new EventEmitter<string>();
  @Output() renameSheet = new EventEmitter<{ id: string; name: string }>();

  editingId: string | null = null;
  editingName = '';
  contextMenuId: string | null = null;

  onSelectSheet(id: string): void {
    if (this.editingId) return;
    this.selectSheet.emit(id);
  }

  onAddSheet(): void {
    this.addSheet.emit();
  }

  startRename(sheet: SheetConfig, event: Event): void {
    event.stopPropagation();
    this.editingId = sheet.id;
    this.editingName = sheet.name;
    this.contextMenuId = null;
  }

  finishRename(): void {
    if (this.editingId && this.editingName.trim()) {
      this.renameSheet.emit({ id: this.editingId, name: this.editingName.trim() });
    }
    this.editingId = null;
  }

  onRenameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.finishRename();
    if (event.key === 'Escape') this.editingId = null;
  }

  showContextMenu(id: string, event: MouseEvent): void {
    event.preventDefault();
    if (!this.canEdit) return;
    this.contextMenuId = this.contextMenuId === id ? null : id;
  }

  onRemoveSheet(id: string): void {
    this.contextMenuId = null;
    this.removeSheet.emit(id);
  }

  closeContextMenu(): void {
    this.contextMenuId = null;
  }
}
