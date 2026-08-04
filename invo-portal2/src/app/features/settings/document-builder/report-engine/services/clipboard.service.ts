import { Injectable, inject } from '@angular/core';
import { Block } from '../core/types/block.types';
import { DesignerStateService } from './designer-state.service';

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly state = inject(DesignerStateService);
  private buffer: Block[] = [];

  copy(): void {
    this.buffer = this.state.selectedBlocks().map((b) => structuredClone(b));
  }

  cut(): void {
    this.copy();
    this.state.deleteSelected();
  }

  paste(offsetX = 5, offsetY = 5): void {
    if (this.buffer.length === 0) return;
    const t = this.state.template();
    const section = this.state.activeSection();
    if (!t || !section) return;
    const newIds: string[] = [];
    const cloned: Block[] = this.buffer.map((b) => {
      const id = `b_${Math.random().toString(36).slice(2, 10)}`;
      newIds.push(id);
      return { ...structuredClone(b), id, position: { x: b.position.x + offsetX, y: b.position.y + offsetY } };
    });
    // Mutate via state to keep history aware.
    cloned.forEach((c) => {
      this.state.patchBlock(c.id, () => c);
    });
    // Append (since patchBlock can't add new items), do it via state.template manually.
    const tNow = this.state.template();
    if (!tNow) return;
    this.state.restore({
      ...tNow,
      sections: tNow.sections.map((s) =>
        s.id === section.id ? { ...s, blocks: [...s.blocks, ...cloned] } : s,
      ),
    });
    this.state.selectMany(newIds);
  }

  hasContent(): boolean {
    return this.buffer.length > 0;
  }
}
