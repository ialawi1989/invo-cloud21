import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-no-connection-style-2',
  imports: [],
  templateUrl: './no-connection-style-2.component.html',
  styleUrl: './no-connection-style-2.component.css'
})
export class NoConnectionStyle2Component {
  @Input() errData: any;
  @Input() slugList: any[] = [];
}
