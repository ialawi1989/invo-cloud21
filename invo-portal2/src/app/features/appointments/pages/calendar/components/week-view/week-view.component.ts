import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppointmentTask, appointmentStatus } from '../../../../models/appointment.types';
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  SLOT_MINUTES,
  TIME_SLOTS,
  dateAtTime,
  formatTimeAmPm,
  isPast,
  minutesSinceMidnight,
  rangesOverlap,
  weekDates,
} from '../../../../utils/time-utils';

const SLOT_HEIGHT = 18;

export interface WeekSlotClickEvent {
  date: Date;
  tasks: AppointmentTask[];
  isOverlap: boolean;
  /** Minutes — set when the slot was created by dragging a range instead of a plain click. */
  duration?: number;
}

export interface WeekRescheduleEvent {
  task: AppointmentTask;
  startTime: Date;
}

export interface WeekResizeEvent {
  task: AppointmentTask;
  duration: number;
}

/**
 * Week view — 7 day columns (not per-employee). Appointments that overlap in
 * time within the same day are collapsed into a single "N appointments" pill
 * (Google Calendar's "+N more"); clicking it, an empty slot, or a day header
 * all hand off to the parent's agenda drawer. A single (non-overlapping)
 * appointment opens straight into the edit form, matching legacy.
 */
@Component({
  selector: 'app-week-view',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-view.component.html',
  styleUrl: './week-view.component.scss',
})
export class WeekViewComponent {
  date = input.required<Date>();
  tasks = input.required<AppointmentTask[]>();
  canEdit = input<boolean>(true);

  slotClick = output<WeekSlotClickEvent>();
  dayClick = output<Date>();
  taskClick = output<AppointmentTask>();
  reschedule = output<WeekRescheduleEvent>();
  resize = output<WeekResizeEvent>();

  readonly SLOT_HEIGHT = SLOT_HEIGHT;
  readonly timeSlots = TIME_SLOTS;
  readonly bodyHeight = TIME_SLOTS.length * SLOT_HEIGHT;

  days = computed(() => weekDates(this.date()));

  groupsByDay = computed(() => {
    const map = new Map<string, AppointmentTask[][]>();
    for (const day of this.days()) {
      map.set(dayKey(day), this.computeGroups(day));
    }
    return map;
  });

  private computeGroups(day: Date): AppointmentTask[][] {
    const key = dayKey(day);
    const tasks = this.tasks()
      .filter(t => dayKey(new Date(t.serviceDate)) === key && t.serviceDuration > 0)
      .sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime());
    if (tasks.length === 0) return [];

    const groups: AppointmentTask[][] = [];
    let current: AppointmentTask[] = [tasks[0]];
    let currentEnd = minutesSinceMidnight(new Date(tasks[0].serviceDate)) + tasks[0].serviceDuration;

    for (let i = 1; i < tasks.length; i++) {
      const t = tasks[i];
      const start = minutesSinceMidnight(new Date(t.serviceDate));
      const end = start + t.serviceDuration;
      if (start < currentEnd) {
        current.push(t);
        currentEnd = Math.max(currentEnd, end);
      } else {
        groups.push(current);
        current = [t];
        currentEnd = end;
      }
    }
    groups.push(current);
    return groups;
  }

  groupsFor(day: Date): AppointmentTask[][] {
    return this.groupsByDay().get(dayKey(day)) ?? [];
  }

  isToday(day: Date): boolean {
    return dayKey(day) === dayKey(new Date());
  }

  isSlotPast(day: Date, slot: string): boolean {
    return isPast(dateAtTime(day, slot));
  }

  dayName(day: Date): string {
    return day.toLocaleDateString(undefined, { weekday: 'short' });
  }

  statusOf(task: AppointmentTask) {
    return appointmentStatus(task);
  }

  top(task: AppointmentTask): number {
    const minutes = minutesSinceMidnight(new Date(task.serviceDate)) - CALENDAR_START_HOUR * 60;
    return (minutes / SLOT_MINUTES) * SLOT_HEIGHT;
  }

  height(task: AppointmentTask): number {
    return Math.max(SLOT_HEIGHT, (task.serviceDuration / SLOT_MINUTES) * SLOT_HEIGHT) - 2;
  }

  groupTop(group: AppointmentTask[]): number {
    const earliest = Math.min(...group.map(t => minutesSinceMidnight(new Date(t.serviceDate))));
    return ((earliest - CALENDAR_START_HOUR * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
  }

  groupHeight(group: AppointmentTask[]): number {
    const earliest = Math.min(...group.map(t => minutesSinceMidnight(new Date(t.serviceDate))));
    const latest = Math.max(...group.map(t => minutesSinceMidnight(new Date(t.serviceDate)) + t.serviceDuration));
    return Math.max(SLOT_HEIGHT, ((latest - earliest) / SLOT_MINUTES) * SLOT_HEIGHT) - 2;
  }

  timeRangeLabel(task: AppointmentTask): string {
    const start = new Date(task.serviceDate);
    const end = new Date(start.getTime() + task.serviceDuration * 60_000);
    return `${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
  }

  private intersectingTasks(day: Date, slotStart: number, slotEnd: number): AppointmentTask[] {
    return this.tasks().filter(t => {
      if (dayKey(new Date(t.serviceDate)) !== dayKey(day)) return false;
      const start = minutesSinceMidnight(new Date(t.serviceDate));
      return start < slotEnd && start + t.serviceDuration > slotStart;
    });
  }

  onGroupClick(day: Date, group: AppointmentTask[]): void {
    if (this.dragMoved) return;
    if (group.length === 1) {
      this.taskClick.emit(group[0]);
    } else {
      this.slotClick.emit({ date: day, tasks: group, isOverlap: true });
    }
  }

  trackByDay = (_: number, day: Date) => dayKey(day);
  trackByGroup = (_: number, group: AppointmentTask[]) => group.map(t => t.taskId).join('-');

  // ── Drag to reschedule a single (non-overlapping) appointment to another
  // day/time. Listeners are bound directly on the pointer-captured element,
  // not `document:pointerup`/`document:pointermove` HostListeners — once
  // `setPointerCapture` is called the spec guarantees that element keeps
  // receiving move/up/cancel for that pointer, and binding there sidesteps
  // anything else in the app that might intercept a document-level listener
  // first. ──
  private dragging: { task: AppointmentTask; el: HTMLElement; startClientY: number } | null = null;
  private dragMoved = false;

  onCardPointerDown(event: PointerEvent, task: AppointmentTask): void {
    if (!this.canEdit() || event.button !== 0) return;
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    this.dragging = { task, el, startClientY: event.clientY };
    this.dragMoved = false;

    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const dy = event.clientY - this.dragging.startClientY;
    if (Math.abs(dy) > 4) this.dragMoved = true;
    this.dragging.el.style.transform = `translateY(${dy}px)`;
    this.dragging.el.style.zIndex = '50';
    this.dragging.el.style.opacity = '0.85';
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const { task, el } = this.dragging;
    this.detachDragListeners(el);
    el.style.transform = '';
    el.style.zIndex = '';
    el.style.opacity = '';

    if (this.dragMoved) {
      const targetEl = document.elementFromPoint(event.clientX, event.clientY);
      const columnEl = targetEl?.closest<HTMLElement>('[data-day-key]');
      const bodyEl = columnEl?.querySelector<HTMLElement>('.week-grid__overlay');
      const targetDay = this.days().find(d => dayKey(d) === columnEl?.dataset['dayKey']);

      if (targetDay && bodyEl) {
        const y = event.clientY - bodyEl.getBoundingClientRect().top;
        const rawMinutes = CALENDAR_START_HOUR * 60 + Math.round(y / SLOT_HEIGHT) * SLOT_MINUTES;
        const snapped = Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
        const clamped = Math.max(CALENDAR_START_HOUR * 60, Math.min(snapped, CALENDAR_END_HOUR * 60 - task.serviceDuration));
        const startTime = dateAtTime(targetDay, `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`);

        if (this.canDrop(task, startTime)) {
          this.reschedule.emit({ task, startTime });
        }
      }
    }

    this.dragging = null;
    setTimeout(() => { this.dragMoved = false; }, 0);
  };

  private onPointerCancel = (): void => {
    if (!this.dragging) return;
    const { el } = this.dragging;
    this.detachDragListeners(el);
    el.style.transform = '';
    el.style.zIndex = '';
    el.style.opacity = '';
    this.dragging = null;
    this.dragMoved = false;
  };

  private detachDragListeners(el: HTMLElement): void {
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
  }

  private canDrop(task: AppointmentTask, startTime: Date): boolean {
    if (isPast(startTime)) return false;
    const newStart = minutesSinceMidnight(startTime);
    const newEnd = newStart + task.serviceDuration;
    const siblings = this.tasks().filter(
      t => t.taskId !== task.taskId && t.employeeId === task.employeeId && dayKey(new Date(t.serviceDate)) === dayKey(startTime),
    );
    return !siblings.some(s => {
      const sStart = minutesSinceMidnight(new Date(s.serviceDate));
      return rangesOverlap(newStart, newEnd, sStart, sStart + s.serviceDuration);
    });
  }

  // ── Click-or-drag-to-create on an empty part of a day column — same
  // gesture as the Day view. Dragging over any existing appointment isn't
  // meaningful here (columns aren't per-employee), so this only ever starts
  // from a genuinely empty spot; the pointerdown handler checks for that. ──
  private creating: { day: Date; colEl: HTMLElement; startSlotIndex: number } | null = null;
  creatingPreview = signal<{ dayKeyValue: string; top: number; height: number } | null>(null);

  onColumnPointerDown(event: PointerEvent, day: Date): void {
    if (!this.canEdit() || event.button !== 0 || this.dragging) return;
    if ((event.target as HTMLElement).closest('.week-appt')) return;
    const colEl = event.currentTarget as HTMLElement;
    const overlayEl = colEl.querySelector<HTMLElement>('.week-grid__overlay')!;
    const y = event.clientY - overlayEl.getBoundingClientRect().top;
    const startSlotIndex = this.clampSlotIndex(Math.floor(y / SLOT_HEIGHT));

    const slotStart = CALENDAR_START_HOUR * 60 + startSlotIndex * SLOT_MINUTES;
    if (this.intersectingTasks(day, slotStart, slotStart + SLOT_MINUTES).length > 0) return;
    // Don't even start the gesture on a past slot — the hatched styling
    // already shows it's disabled; starting a preview that always reverts
    // on release just looks broken.
    if (isPast(dateAtTime(day, TIME_SLOTS[startSlotIndex]))) return;

    colEl.setPointerCapture(event.pointerId);
    this.creating = { day, colEl, startSlotIndex };
    this.creatingPreview.set({ dayKeyValue: dayKey(day), top: startSlotIndex * SLOT_HEIGHT, height: SLOT_HEIGHT });

    colEl.addEventListener('pointermove', this.onCreatingPointerMove);
    colEl.addEventListener('pointerup', this.onCreatingPointerUp);
    colEl.addEventListener('pointercancel', this.onCreatingPointerCancel);
  }

  private onCreatingPointerMove = (event: PointerEvent): void => {
    if (!this.creating) return;
    const { colEl, startSlotIndex } = this.creating;
    const overlayEl = colEl.querySelector<HTMLElement>('.week-grid__overlay')!;
    const y = event.clientY - overlayEl.getBoundingClientRect().top;
    const currentSlotIndex = this.clampSlotIndex(Math.floor(y / SLOT_HEIGHT));
    const fromIndex = Math.min(startSlotIndex, currentSlotIndex);
    const toIndex = Math.max(startSlotIndex, currentSlotIndex);
    this.creatingPreview.set({
      dayKeyValue: dayKey(this.creating.day),
      top: fromIndex * SLOT_HEIGHT,
      height: (toIndex - fromIndex + 1) * SLOT_HEIGHT,
    });
  };

  private onCreatingPointerUp = (): void => {
    if (!this.creating) return;
    const { day, colEl } = this.creating;
    this.detachCreatingListeners(colEl);
    const preview = this.creatingPreview();
    this.creating = null;
    this.creatingPreview.set(null);
    if (!preview) return;

    const fromIndex = Math.round(preview.top / SLOT_HEIGHT);
    const slotCount = Math.round(preview.height / SLOT_HEIGHT);
    const slotStart = CALENDAR_START_HOUR * 60 + fromIndex * SLOT_MINUTES;
    const startTime = dateAtTime(day, `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`);
    if (isPast(startTime)) return;

    const duration = slotCount * SLOT_MINUTES;
    const intersecting = this.intersectingTasks(day, slotStart, slotStart + duration);
    this.slotClick.emit({
      date: startTime,
      tasks: intersecting,
      isOverlap: intersecting.length > 1,
      duration: intersecting.length === 0 && slotCount > 1 ? duration : undefined,
    });
  };

  private onCreatingPointerCancel = (): void => {
    if (!this.creating) return;
    this.detachCreatingListeners(this.creating.colEl);
    this.creating = null;
    this.creatingPreview.set(null);
  };

  private detachCreatingListeners(colEl: HTMLElement): void {
    colEl.removeEventListener('pointermove', this.onCreatingPointerMove);
    colEl.removeEventListener('pointerup', this.onCreatingPointerUp);
    colEl.removeEventListener('pointercancel', this.onCreatingPointerCancel);
  }

  private clampSlotIndex(index: number): number {
    return Math.max(0, Math.min(index, TIME_SLOTS.length - 1));
  }

  // ── Resize the bottom edge of a single (non-overlapping) card — booked
  // (not yet invoiced) appointments only; see AppointmentsService.resizeTask
  // for why there's no equivalent for a checked-in task. ──
  private resizing: { task: AppointmentTask; cardEl: HTMLElement; handleEl: HTMLElement; startHeight: number; startClientY: number } | null = null;
  resizingPreviewHeight = signal<number | null>(null);

  onResizeHandlePointerDown(event: PointerEvent, task: AppointmentTask): void {
    if (!this.canEdit() || event.button !== 0) return;
    event.stopPropagation();
    const handleEl = event.currentTarget as HTMLElement;
    handleEl.setPointerCapture(event.pointerId);
    const cardEl = handleEl.closest<HTMLElement>('.week-appt')!;
    this.resizing = { task, cardEl, handleEl, startHeight: this.height(task), startClientY: event.clientY };
    this.resizingPreviewHeight.set(this.resizing.startHeight);

    handleEl.addEventListener('pointermove', this.onResizePointerMove);
    handleEl.addEventListener('pointerup', this.onResizePointerUp);
    handleEl.addEventListener('pointercancel', this.onResizePointerCancel);
  }

  private onResizePointerMove = (event: PointerEvent): void => {
    if (!this.resizing) return;
    const dy = event.clientY - this.resizing.startClientY;
    const rawHeight = Math.max(SLOT_HEIGHT, this.resizing.startHeight + dy);
    const snappedHeight = Math.round(rawHeight / SLOT_HEIGHT) * SLOT_HEIGHT;
    this.resizingPreviewHeight.set(snappedHeight);
    this.resizing.cardEl.style.height = `${snappedHeight}px`;
  };

  private onResizePointerUp = (): void => {
    if (!this.resizing) return;
    const { task, cardEl, handleEl } = this.resizing;
    this.detachResizeListeners(handleEl);
    const finalHeight = this.resizingPreviewHeight() ?? this.resizing.startHeight;
    this.resizing = null;
    this.resizingPreviewHeight.set(null);
    cardEl.style.height = '';

    const newDuration = Math.max(SLOT_MINUTES, Math.round(finalHeight / SLOT_HEIGHT) * SLOT_MINUTES);
    if (newDuration !== task.serviceDuration) {
      this.resize.emit({ task, duration: newDuration });
    }
  };

  private onResizePointerCancel = (): void => {
    if (!this.resizing) return;
    const { cardEl, handleEl } = this.resizing;
    this.detachResizeListeners(handleEl);
    cardEl.style.height = '';
    this.resizing = null;
    this.resizingPreviewHeight.set(null);
  };

  private detachResizeListeners(handleEl: HTMLElement): void {
    handleEl.removeEventListener('pointermove', this.onResizePointerMove);
    handleEl.removeEventListener('pointerup', this.onResizePointerUp);
    handleEl.removeEventListener('pointercancel', this.onResizePointerCancel);
  }
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
