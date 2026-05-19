import { Component } from '@angular/core';
import { FeedbackCompoComponent } from "../feedback-compo/feedback-compo.component";
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-feedback-pop',
  imports: [FeedbackCompoComponent],
  templateUrl: './feedback-pop.component.html',
  styleUrl: './feedback-pop.component.css'
})
export class FeedbackPopComponent {

  feedbackData={};

  constructor(
    public activeModal: NgbActiveModal,
  ) {
  }

  loadData(data: any) {
    if (data) {
      this.feedbackData = data.feedbackData;
    }
  }

  cancel() {
    this.activeModal.dismiss('');
  }

}
