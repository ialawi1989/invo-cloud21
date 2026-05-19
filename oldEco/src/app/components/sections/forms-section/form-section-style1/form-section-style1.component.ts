import { Component, Input } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { LoadingService } from '../../../../services/loadingService/loading.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-section-style1',
  imports: [FormsModule],
  templateUrl: './form-section-style1.component.html',
  styleUrl: './form-section-style1.component.css'
})
export class FormSectionStyle1Component {

  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  formData: any = { comment: '', name: '', email: '' };

  constructor(private loadingService: LoadingService) {}

  getBackground(): string { return this.background; }

  submit() {
    this.loadingService.showLoadingSpinner();
    setTimeout(() => this.loadingService.hideLoadingSpinner(), 250);
  }
}
