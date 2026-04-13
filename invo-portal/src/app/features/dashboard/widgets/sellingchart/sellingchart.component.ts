import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  selector: 'app-sellingchart',
  templateUrl: './sellingchart.component.html',
  styleUrls: ['./sellingchart.component.scss']
})
export class SellingchartComponent implements OnInit, OnChanges {

  @Input() Chartcolor = "#00aab3";
  @Input() value = "0";

  chartData: any;

  constructor() { }

  ngOnInit(): void {
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.value || changes.Chartcolor) {
      this.initChart();
    }
  }

  initChart(): void {
    this.chartData = {
      series: [parseFloat(this.value) || 0],
      chart: {
        type: 'radialBar',
        width: 36,
        height: 36,
        sparkline: {
          enabled: true
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        }
      },
      colors: [this.Chartcolor || '#00aab3'],
      stroke: {
        lineCap: 'round'
      },
      fill: {
        type: 'solid',
        opacity: 1
      },
      plotOptions: {
        radialBar: {
          hollow: {
            margin: 0,
            size: '50%'
          },
          track: {
            margin: 0,
            background: '#e2e8f0',
            strokeWidth: '100%'
          },
          dataLabels: {
            show: false
          }
        }
      },
      dataLabels: {
        enabled: false
      }
    };
  }
}
