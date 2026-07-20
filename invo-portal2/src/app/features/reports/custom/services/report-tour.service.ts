import { Injectable } from '@angular/core';
import { driver, Driver, DriveStep } from 'driver.js';

/**
 * Thin wrapper around driver.js for the custom-report builder walkthrough.
 * Keeps the library and its "seen once" bookkeeping out of the component.
 */
@Injectable({ providedIn: 'root' })
export class ReportTourService {
  private active: Driver | null = null;

  /** True once the tour identified by `key` has been auto-shown / completed. */
  hasSeen(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  markSeen(key: string): void {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable (private mode) — the tour just re-shows next time */
    }
  }

  clearSeen(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* no-op */
    }
  }

  isRunning(): boolean {
    return this.active !== null;
  }

  /**
   * Run a guided tour. Steps whose `element` selector isn't currently in the
   * DOM are dropped, so conditionally-rendered anchors (pagination, popovers)
   * never break the flow.
   *
   * `opts.dontShowAgain` injects a "Don't show this again" checkbox into every
   * popover; its `isChecked`/`onToggle` let the caller persist the choice.
   * `opts.onDone` fires when the tour ends or is dismissed.
   */
  run(
    steps: DriveStep[],
    opts?: {
      onDone?: () => void;
      dontShowAgain?: { isChecked: () => boolean; onToggle: (checked: boolean) => void };
    }
  ): void {
    const valid = steps.filter(
      (s) => !s.element || !!document.querySelector(s.element as string)
    );
    if (valid.length === 0) {
      opts?.onDone?.();
      return;
    }

    this.stop();

    this.active = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.65)',
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: 'crb-tour',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Got it',
      progressText: '{{current}} of {{total}}',
      steps: valid,
      onPopoverRender: (popover) => {
        const dsa = opts?.dontShowAgain;
        if (!dsa || !popover?.wrapper) return;

        const row = document.createElement('div');
        row.className = 'crb-tour-dsa-row';

        const label = document.createElement('label');
        label.className = 'crb-tour-dsa';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = dsa.isChecked();
        cb.addEventListener('change', () => dsa.onToggle(cb.checked));

        label.appendChild(cb);
        label.appendChild(document.createTextNode("Don't show this again"));
        row.appendChild(label);

        // Sit the checkbox on its own line, just above the nav buttons.
        if (popover.footer) {
          popover.wrapper.insertBefore(row, popover.footer);
        } else {
          popover.wrapper.appendChild(row);
        }
      },
      onDestroyed: () => {
        this.active = null;
        opts?.onDone?.();
      },
    });

    this.active.drive();
  }

  stop(): void {
    if (this.active) {
      this.active.destroy();
      this.active = null;
    }
  }
}
