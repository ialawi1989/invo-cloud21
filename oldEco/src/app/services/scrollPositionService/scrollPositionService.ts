import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ScrollPositionService {
  private positionMap = new Map<string, number>();

  save(url: string, scrollY: number): void {
    this.positionMap.set(url, scrollY);
  }

  get(url: string): number | undefined {
    return this.positionMap.get(url);
  }

  clear(url: string): void {
    this.positionMap.delete(url);
  }

  clearAll(): void {
    this.positionMap.clear();
  }
}