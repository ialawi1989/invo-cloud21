import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Permission } from './auth.models';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private permissions$ = new BehaviorSubject<Set<Permission>>(new Set());

  setPermissions(permissions: Permission[]): void { this.permissions$.next(new Set(permissions)); }
  clearPermissions(): void { this.permissions$.next(new Set()); }

  has(permission: Permission): boolean       { return this.permissions$.value.has(permission); }
  hasAny(permissions: Permission[]): boolean { return permissions.some(p => this.has(p)); }
  hasAll(permissions: Permission[]): boolean { return permissions.every(p => this.has(p)); }

  has$(permission: Permission): Observable<boolean> {
    return this.permissions$.pipe(map(set => set.has(permission)));
  }
  hasAny$(permissions: Permission[]): Observable<boolean> {
    return this.permissions$.pipe(map(set => permissions.some(p => set.has(p))));
  }
}
