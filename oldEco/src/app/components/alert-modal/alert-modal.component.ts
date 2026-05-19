import { Component, HostListener } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-alert-modal',
  imports: [
    TranslateModule
  ],
  templateUrl: './alert-modal.component.html',
  styleUrl: './alert-modal.component.css'
})
export class AlertModalComponent {

  title: string = '';
  subtitle: string = '';
  confirmText: string = 'Got It';

  constructor(public activeModal: NgbActiveModal) { }

  /**
   * Called by ModalService.openWithData(...) with the data payload.
   * Supports either a plain string (treated as title) or
   * { title, subtitle, confirmText }.
   *
   * Note: also tolerates the legacy shape passed to AlertService.showAlert
   * (which is { title, subtitle }) so existing call sites keep working.
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
  }

  @HostListener('keydown.escape')
  onEscape() {
    this.confirm();
  }

  confirm() {
    setTimeout(() => {
      this.activeModal.close(true);
    }, 75);
  }

}
