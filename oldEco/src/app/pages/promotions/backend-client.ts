import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { AuthService } from 'src/app/services/authService/auth.service';
import { AppConfigService } from 'src/app/services/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class BackendClient {
  authToken = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private config: AppConfigService,
    private router: Router,
    private store: Store<any> // Change 'any' to 'AppState' if you have an AppState interface
  ) {
    // on service init  set access token
    auth.currentToken.subscribe((authToken) => {
      this.authToken = authToken;
    });
  }
  get baseUrl() {
    return `${this.config.baseUrl}`;
  }

  async put<T>(url: string, body: any): Promise<T> {
    const header = new HttpHeaders({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Auth-Token': this.authToken,
    });

    try {
      const response = await firstValueFrom(
        this.http.put<T>(`${this.baseUrl}${url}`, body, {
          headers: header,
          responseType: 'text' as 'json',
        })
      );

      return response;
    } catch (error: any) {
      if (error.status === 401) {
        this.auth.logout();
        this.router.navigateByUrl('login');
      }
      throw error;
    }
  }

  async post<T>(url: string, body: any): Promise<T> {
    const header = new HttpHeaders({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Auth-Token': this.authToken,
    });

    try {
      const response = await firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${url}`, body, {
          headers: header,
          responseType: 'text' as 'json',
        })
      );

      return response;
    } catch (error: any) {
      if (error.status === 401) {
        this.auth.logout();
        this.router.navigateByUrl('login');
      }
      throw error;
    }
  }

  async patch<T>(url: string, body: any): Promise<T> {
    const header = new HttpHeaders({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Auth-Token': this.authToken,
    });

    try {
      const response = await firstValueFrom(
        this.http.patch<T>(`${this.baseUrl}${url}`, body, {
          headers: header,
          responseType: 'text' as 'json',
        })
      );

      return response;
    } catch (error: any) {
      if (error.status === 401) {
        this.auth.logout();
        this.router.navigateByUrl('login');
      }
      throw error;
    }
  }

  public async get<T>(url: string): Promise<T> {
    let header!:HttpHeaders;
    if (this.authToken) {
      header = new HttpHeaders({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Auth-Token': this.authToken,
      });
    } else {
      header = new HttpHeaders();
    }

    try {
      //TODO when T is a string add ,responseType: 'text' as 'json'  after headers: header
      const response = await firstValueFrom(
        this.http.get<T>(`${this.baseUrl}${url}`, { headers: header })
      );

      return response;
    } catch (error: any) {
      if (error.status === 401) {
        this.auth.logout();
        this.router.navigateByUrl('login');
      }
      throw error;
    }
  }



}
