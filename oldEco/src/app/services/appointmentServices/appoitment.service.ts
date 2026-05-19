import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppConfigService } from '../app-config.service';
import { Team } from '../../models/team.model';
import { Service } from '../../models/service.model';
import { AppServices } from '../appServices';
import { LoggerService } from '../logger/logger.service';


@Injectable({
  providedIn: 'root'
})

export class AppointmentService {

  private logger = inject(LoggerService);

  constructor(private http: HttpClient, private config: AppConfigService, private appService: AppServices) { }

  getTeamList(body: any): Observable<Team[] | null> {
    const url = `${this.config.baseUrl}employee/getEmployeesScheduleForAppointment`;

    return this.http.post<any>(url, body, { headers: this.appService.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.map((teamData: any) => { const _inst = new Team(); _inst.ParseJson(teamData); return _inst; });
        }
        return null;
      }),
      catchError(error => {
        this.logger.error(error, { context: 'AppointmentService.getTeamList' });
        throw new Error('Failed to load team');
      })
    );
  }

  getServiceList(body: any): Observable<Service[] | null> {
    const url = `${this.config.baseUrl}shop/getServicesList`;

    return this.http.post<any>(url, body, { headers: this.appService.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.map((serviceData: any) => { const _inst = new Service(); _inst.ParseJson(serviceData); return _inst; });
        }
        return null;
      }),
      catchError(error => {
        this.logger.error(error, { context: 'AppointmentService.getServiceList' });
        throw new Error('Failed to load services');
      })
    );
  }


}