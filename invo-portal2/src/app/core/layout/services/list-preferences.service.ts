import { Injectable, inject } from '@angular/core';
import {
  EmployeeOptionsService,
  ListPreference,
  ListColumnPref,
} from './employee-options.service';

@Injectable({ providedIn: 'root' })
export class ListPreferencesService {
  private optionsService = inject(EmployeeOptionsService);

  async load(entityType: string): Promise<ListPreference | null> {
    const opts = await this.optionsService.get();
    return opts?.lists?.[entityType] ?? null;
  }

  async save(entityType: string, columns: ListColumnPref[]): Promise<void> {
    const opts = (await this.optionsService.get()) ?? {};
    await this.optionsService.patch({
      lists: {
        ...(opts.lists ?? {}),
        [entityType]: { columns },
      },
    });
  }
}
