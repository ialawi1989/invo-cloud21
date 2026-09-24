import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Country { name: string; dial_code: string; code: string }

/** Countries + dial codes (`public/Countries.json`), loaded once and shared. */
@Injectable({ providedIn: 'root' })
export class CountriesService {
  private http = inject(HttpClient);
  private cache: Promise<Country[]> | null = null;

  load(): Promise<Country[]> {
    if (!this.cache) {
      this.cache = firstValueFrom(this.http.get<Country[]>('Countries.json')).catch(err => {
        this.cache = null; // don't cache a failure — the next caller retries
        throw err;
      });
    }
    return this.cache;
  }
}
