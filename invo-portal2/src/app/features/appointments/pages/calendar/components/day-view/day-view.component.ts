import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppointmentTask, appointmentStatus, EmployeeLite } from '../../../../models/appointment.types';
import { employeeColor } from '../../../../utils/employee-color';
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
} from '../../../../utils/time-utils';

const SLOT_HEIGHT = 48;

export interface SlotClickEvent {
  employeeId: string;
  startTime: Date;
  /** Minutes — set when the slot was created by dragging a range instead of a plain click. */
  duration?: number;
}

export interface RescheduleEvent {
  task: AppointmentTask;
  employeeId: string;
  startTime: Date;
}

export interface ResizeEvent {
  task: AppointmentTask;
  duration: number;
}

/**
 * Day view — one column per employee (like Google Calendar's "day, split by
 * person"), a 15-minute-slot timeline, click-anywhere-on-the-grid to create,
 * and pointer-based drag-to-reschedule.
 *
 * Ported from legacy `DailyGridComponent` with two deliberate changes:
 *  - drag uses native Pointer Events + a CSS transform on the real card
 *    (via `ElementRef`), not a cloned "ghost" element tracked through raw
 *    `document.elementsFromPoint` polling — same end-user gesture, far less
 *    DOM manipulation.
 *  - overlap/past checks reuse `time-utils.ts` instead of being duplicated
 *    inline (legacy repeated this exact math in daily-grid AND the booking
 *    form).
 */
@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  styleUrl: './day-view.component.scss',
})
export class DayViewComponent implements OnChanges, OnDestroy {
  date = input.required<Date>();
  employees = input.required<EmployeeLite[]>();
  tasks = input.required<AppointmentTask[]>();
  canEdit = input<boolean>(true);

  slotClick = output<SlotClickEvent>();
  taskClick = output<AppointmentTask>();
  reschedule = output<RescheduleEvent>();
  resize = output<ResizeEvent>();

  private gridEl = viewChild<ElementRef<HTMLElement>>('gridEl');

  readonly SLOT_HEIGHT = SLOT_HEIGHT;
  readonly timeSlots = TIME_SLOTS;
  readonly bodyHeight = TIME_SLOTS.length * SLOT_HEIGHT;

  now = signal(new Date());
  private nowTimer = setInterval(() => this.now.set(new Date()), 60_000);

  ngOnDestroy(): void {
    clearInterval(this.nowTimer);
  }

  isToday = computed(() => isSameDay(this.date(), this.now()));

  nowTop = computed(() => {
    const minutes = minutesSinceMidnight(this.now()) - CALENDAR_START_HOUR * 60;
    return (minutes / SLOT_MINUTES) * SLOT_HEIGHT;
  });

  tasksByEmployee = computed(() => {
    const map = new Map<string, AppointmentTask[]>();
    for (const t of this.tasks()) {
      if (!map.has(t.employeeId)) map.set(t.employeeId, []);
      map.get(t.employeeId)!.push(t);
    }
    return map;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['date'] && this.isToday()) {
      queueMicrotask(() => this.scrollToNow());
    }
  }

  private scrollToNow(): void {
    const el = this.gridEl()?.nativeElement;
    if (!el) return;
    el.scrollTop = Math.max(0, this.nowTop() - 120);
  }

  tasksFor(employeeId: string): AppointmentTask[] {
    return this.tasksByEmployee().get(employeeId) ?? [];
  }

  color(employeeId: string): string {
    return employeeColor(employeeId);
  }

  initials(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  statusOf(task: AppointmentTask) {
    return appointmentStatus(task);
  }

  timeRangeLabel(task: AppointmentTask): string {
    const start = new Date(task.serviceDate);
    const end = new Date(start.getTime() + task.serviceDuration * 60_000);
    return `${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
  }

  topFor(task: AppointmentTask): number {
    const start = new Date(task.serviceDate);
    const minutes = minutesSinceMidnight(start) - CALENDAR_START_HOUR * 60;
    return (minutes / SLOT_MINUTES) * SLOT_HEIGHT;
  }

  heightFor(task: AppointmentTask): number {
    return Math.max(SLOT_HEIGHT * 0.6, (task.serviceDuration / SLOT_MINUTES) * SLOT_HEIGHT);
  }

  isSlotPast(slot: string): boolean {
    return isPast(dateAtTime(this.date(), slot), this.now());
  }

  onCardClick(event: MouseEvent, task: AppointmentTask): void {
    event.stopPropagation();
    if (this.dragMoved) return;
    this.taskClick.emit(task);
  }

  // ── Click-or-drag-to-create — a plain click creates a default-length slot;
  // dragging across the grid selects a start/end range (Google Calendar's
  // "click and drag to pick a time range" gesture). ──
  //
  // Listeners are bound directly on the element that captured the pointer
  // (not `document:pointerup`/`document:pointermove` HostListeners) — once
  // `setPointerCapture` is called, the spec guarantees that element keeps
  // receiving move/up/cancel for that pointer even outside its bounds, and
  // binding there sidesteps anything else in the app (CDK overlays, other
  // global listeners) that might intercept a document-level listener first.
  private creating: { employeeId: string; bodyEl: HTMLElement; startSlotIndex: number } | null = null;
  creatingPreview = signal<{ employeeId: string; top: number; height: number } | null>(null);

  onBodyPointerDown(event: PointerEvent, employee: EmployeeLite): void {
    if (!this.canEdit() || event.button !== 0 || this.dragging) return;
    if ((event.target as HTMLElement).closest('.appt-card')) return;
    const bodyEl = event.currentTarget as HTMLElement;
    const y = event.clientY - bodyEl.getBoundingClientRect().top + bodyEl.scrollTop;
    const startSlotIndex = this.clampSlotIndex(Math.floor(y / SLOT_HEIGHT));
    // Don't even start the gesture on a past slot — the hatched styling
    // already shows it's disabled; starting a preview that always reverts
    // on release just looks broken.
    if (isPast(dateAtTime(this.date(), TIME_SLOTS[startSlotIndex]), this.now())) return;

    bodyEl.setPointerCapture(event.pointerId);
    this.creating = { employeeId: employee.id, bodyEl, startSlotIndex };
    this.creatingPreview.set({ employeeId: employee.id, top: startSlotIndex * SLOT_HEIGHT, height: SLOT_HEIGHT });

    bodyEl.addEventListener('pointermove', this.onCreatingPointerMove);
    bodyEl.addEventListener('pointerup', this.onCreatingPointerUp);
    bodyEl.addEventListener('pointercancel', this.onCreatingPointerCancel);
  }

  private onCreatingPointerMove = (event: PointerEvent): void => {
    if (!this.creating) return;
    const { bodyEl, employeeId, startSlotIndex } = this.creating;
    const y = event.clientY - bodyEl.getBoundingClientRect().top + bodyEl.scrollTop;
    const currentSlotIndex = this.clampSlotIndex(Math.floor(y / SLOT_HEIGHT));
    const fromIndex = Math.min(startSlotIndex, currentSlotIndex);
    const toIndex = Math.max(startSlotIndex, currentSlotIndex);
    this.creatingPreview.set({
      employeeId,
      top: fromIndex * SLOT_HEIGHT,
      height: (toIndex - fromIndex + 1) * SLOT_HEIGHT,
    });
  };

  private onCreatingPointerUp = (): void => {
    if (!this.creating) return;
    const { employeeId, bodyEl } = this.creating;
    this.detachCreatingListeners(bodyEl);
    const preview = this.creatingPreview();
    this.creating = null;
    this.creatingPreview.set(null);
    if (!preview) return;

    const fromIndex = Math.round(preview.top / SLOT_HEIGHT);
    const slotCount = Math.round(preview.height / SLOT_HEIGHT);
    const startTime = dateAtTime(this.date(), TIME_SLOTS[fromIndex]);
    if (isPast(startTime, this.now())) return;

    const duration = slotCount * SLOT_MINUTES;
    this.slotClick.emit({
      employeeId,
      startTime,
      // Only pass an explicit duration when the user actually dragged a range —
      // a plain click (single slot) keeps the form's own default duration.
      duration: slotCount > 1 ? duration : undefined,
    });
  };

  private onCreatingPointerCancel = (): void => {
    if (!this.creating) return;
    this.detachCreatingListeners(this.creating.bodyEl);
    this.creating = null;
    this.creatingPreview.set(null);
  };

  private detachCreatingListeners(bodyEl: HTMLElement): void {
    bodyEl.removeEventListener('pointermove', this.onCreatingPointerMove);
    bodyEl.removeEventListener('pointerup', this.onCreatingPointerUp);
    bodyEl.removeEventListener('pointercancel', this.onCreatingPointerCancel);
  }

  private clampSlotIndex(index: number): number {
    return Math.max(0, Math.min(index, TIME_SLOTS.length - 1));
  }

  // ── Drag to reschedule (pointer events + CSS transform; no DOM cloning) ──
  private dragging: { task: AppointmentTask; el: HTMLElement; startY: number; startClientY: number } | null = null;
  private dragMoved = false;

  onCardPointerDown(event: PointerEvent, task: AppointmentTask): void {
    if (!this.canEdit() || event.button !== 0) return;
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    this.dragging = { task, el, startY: el.offsetTop, startClientY: event.clientY };
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
      const columnEl = targetEl?.closest<HTMLElement>('[data-employee-id]');
      const targetEmployeeId = columnEl?.dataset['employeeId'];
      const bodyEl = columnEl?.querySelector<HTMLElement>('.day-col__body');

      if (targetEmployeeId && bodyEl) {
        const y = event.clientY - bodyEl.getBoundingClientRect().top + bodyEl.scrollTop;
        const rawMinutes = CALENDAR_START_HOUR * 60 + Math.round(y / SLOT_HEIGHT) * SLOT_MINUTES;
        const snapped = Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
        const clamped = Math.max(CALENDAR_START_HOUR * 60, Math.min(snapped, CALENDAR_END_HOUR * 60 - task.serviceDuration));
        const startTime = dateAtTime(this.date(), `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`);

        if (this.canDrop(task, targetEmployeeId, startTime)) {
          this.reschedule.emit({ task, employeeId: targetEmployeeId, startTime });
        }
      }
    }

    this.dragging = null;
    // Let the click handler that immediately follows pointerup see the final drag state, then clear it.
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

  // ── Resize the bottom edge to change duration — booked (not yet invoiced)
  // appointments only, since `saveAppointment` (the only write path with a
  // duration field) always writes through the Estimate side. ──
  private resizing: { task: AppointmentTask; cardEl: HTMLElement; handleEl: HTMLElement; startHeight: number; startClientY: number } | null = null;
  resizingPreviewHeight = signal<number | null>(null);

  onResizeHandlePointerDown(event: PointerEvent, task: AppointmentTask): void {
    if (!this.canEdit() || event.button !== 0) return;
    event.stopPropagation();
    const handleEl = event.currentTarget as HTMLElement;
    handleEl.setPointerCapture(event.pointerId);
    const cardEl = handleEl.closest<HTMLElement>('.appt-card')!;
    this.resizing = { task, cardEl, handleEl, startHeight: this.heightFor(task), startClientY: event.clientY };
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

  private canDrop(task: AppointmentTask, targetEmployeeId: string, startTime: Date): boolean {
    if (isPast(startTime, this.now())) return false;
    const newStart = minutesSinceMidnight(startTime);
    const newEnd = newStart + task.serviceDuration;
    const siblings = this.tasksFor(targetEmployeeId).filter(t => t.taskId !== task.taskId);
    return !siblings.some(s => {
      const sStart = minutesSinceMidnight(new Date(s.serviceDate));
      return rangesOverlap(newStart, newEnd, sStart, sStart + s.serviceDuration);
    });
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
