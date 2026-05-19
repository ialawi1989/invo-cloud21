import { Component, HostListener } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-modal',
  imports: [
    TranslateModule
  ],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css'
})
export class ConfirmModalComponent {

  title: string = '';
  subtitle: string = '';
  confirmText: string = 'Confirm';
  cancelText: string = 'Cancel';

  constructor(public activeModal: NgbActiveModal) { }

  /**
   * Called by ModalService.openWithData(...) with the data payload.
   * Supports either a plain string (treated as title) or
   * { title, subtitle, confirmText, cancelText }.
   */
  loadData(data: any) {
    if (data == null) return;
    if (typeof data === 'string') {
      this.title = data;
      return;
    }
    if (data.title != null) this.title = data.title;
    if (data.subtitle != null) this.subtitle = data.subtitle;
    if (data.confirmText != null) this.confirmText = data.confirmText;
    if (data.cancelText != null) this.cancelText = data.cancelText;
  }

  @HostListener('keydown.escape')
  onEscape() {
    this.cancel();
  }

  confirm() {
    setTimeout(() => {
      this.activeModal.close(true);
    }, 75);
  }

  cancel() {
    setTimeout(() => {
      this.activeModal.close(false);
    }, 75);
  }

}
