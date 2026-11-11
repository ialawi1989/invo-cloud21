import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../models/report.model';

export type DayStatus = 'present' | 'late' | 'absent' | 'adjusted' | 'leave' | 'off' | 'not_employed' | string;

/** Attendance Trends: a status for every employee on every date of the period. */
export interface TrendsData { dates: string[]; employees: { id: string; name: string; statuses: DayStatus[] }[]; }

export interface DetailShift {
  id: string; clockedInRaw: string | null; clockedInEff: string | null; clockedOutRaw: string | null; clockedOutEff: string | null;
  adjClockedInByName?: string | null; adjClockedOutByName?: string | null; clockedInMediaUrl?: string | null; clockedOutMediaUrl?: string | null;
  hasInImage?: boolean; hasOutImage?: boolean; workedMinutes: number; status: string; clockOutReason?: string | null; wasAdjusted?: boolean; isMissingOut?: boolean;
}
export interface DetailDay {
  date: string; weekday: string; expectedStartLocal: string | null; expectedEndLocal: string | null; clockedInEff: string | null; clockedOutEff: string | null;
  workedMinutes: number; shiftCount: number; status: string; shifts: DetailShift[];
}
export interface DetailAdjustment { date: string; field: 'clockedIn' | 'clockedOut'; rawValue: string | null; adjustedValue: string | null; actorName: string | null; reason: string | null; }
export interface EmployeeDetailData {
  employee: { id: string; name: string; type?: string; branchName?: string; mediaUrl?: string | null } | null;
  period: { fromDate: string; toDate: string };
  summary: { daysPresent: number; daysScheduled: number; totalMinutes: number; totalHours: number; lateArrivals: number; adjustmentCount: number; missingClockOuts: number } | null;
  days: DetailDay[]; adjustments: DetailAdjustment[];
}

/** One adjusted punch of the Adjustments Audit. */
export interface AuditRow {
  attendanceId: string; adjustedAt: string; subjectName: string; branchName: string; rawClockedIn: string | null; adjClockedIn: string | null;
  rawClockedOut: string | null; adjClockedOut: string | null; adjClockedInByName: string | null; adjClockedOutByName: string | null; clockOutReason: string | null;
}
export interface AuditActor { managerId: string; managerName: string; adjustmentCount: string | number; }
export interface AuditData { rows: AuditRow[]; count: number; pageCount: number; actors: AuditActor[]; }

/** One absence (or run of consecutive days) of the Absence report. */
export interface AbsenceRow {
  employeeId: string; employeeName: string; branchName: string; startDate: string; endDate: string; days: number;
  leaveType?: string | null; leaveTypeRaw?: string | null; leaveDescription?: string | null; absenceType: 'authorized' | 'unauthorized';
}
export interface AbsenceData { rows: AbsenceRow[]; count: number; pageCount: number; }

/** The attendance reports that are not a plain table: `POST accounts/reports/attendance/trends` and `attendance/employeeDetail`. */
@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private api = inject(ApiService);

  private async post(route: string, filter: ReportApiFilter): Promise<any> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    return res?.data ?? res ?? {};
  }

  async audit(f: ReportApiFilter, page: number, limit: number): Promise<AuditData> {
    const raw = await this.post('attendance/audit', { ...f, page, limit });
    return {
      rows: Array.isArray(raw.list) ? raw.list : [], count: Number(raw.count ?? 0) || 0, pageCount: Number(raw.pageCount ?? 1) || 1,
      actors: Array.isArray(raw.sidePanel) ? raw.sidePanel : [],
    };
  }

  async absence(f: ReportApiFilter, page: number, limit: number): Promise<AbsenceData> {
    const raw = await this.post('attendance/absence', { ...f, page, limit });
    return { rows: Array.isArray(raw.list) ? raw.list : [], count: Number(raw.count ?? 0) || 0, pageCount: Number(raw.pageCount ?? 1) || 1 };
  }

  async trends(f: ReportApiFilter): Promise<TrendsData> {
    const raw = await this.post('attendance/trends', f);
    return { dates: Array.isArray(raw.dates) ? raw.dates : [], employees: Array.isArray(raw.employees) ? raw.employees : [] };
  }

  async employeeDetail(f: ReportApiFilter): Promise<EmployeeDetailData> {
    const raw = await this.post('attendance/employeeDetail', f);
    return {
      employee: raw.employee ?? null, period: raw.period ?? { fromDate: f.fromDate ?? '', toDate: f.toDate ?? '' }, summary: raw.summary ?? null,
      days: Array.isArray(raw.days) ? raw.days : [], adjustments: Array.isArray(raw.adjustments) ? raw.adjustments : [],
    };
  }
}
