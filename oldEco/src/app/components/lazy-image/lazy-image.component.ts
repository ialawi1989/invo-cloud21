//lazy-image-ts
import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, Renderer2, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-lazy-image',
  templateUrl: './lazy-image.component.html',
  styleUrl: './lazy-image.component.css'
})
export class LazyImageComponent implements OnInit, OnDestroy, OnChanges {
  @Input() src!: string;
  @Input() alt: string = '';
  @Input() width: string = '100%';
  @Input() height: string = 'auto';
  @Input() placeholder: string = 'assets/images/default-blank-image.png';
  @Input() objectFit: string = 'cover';
  @Input() borderRadius: string = '';
  
  // NEW: Configurable preload margin (in pixels)
  // Images will start loading when they're 900px away from viewport
  @Input() preloadMargin: string = '900px';

  private observer?: IntersectionObserver;
  currentSrc!: string;
  imageLoaded = false;
  private hasIntersected = false;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit(): void {
    this.currentSrc = this.placeholder;
    this.initObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] && !changes['src'].firstChange) {
      this.hasIntersected = false;
      this.imageLoaded = false;
      this.currentSrc = this.placeholder;
      this.initObserver();
    }
  }

  private initObserver(): void {
    this.observer?.disconnect();

    // UPDATED: Use rootMargin to trigger loading 500px before image enters viewport
    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.hasIntersected) {
            this.loadImage();
            this.hasIntersected = true;
            this.observer?.unobserve(this.el.nativeElement);
          }
        });
      },
      {
        // rootMargin adds buffer space around viewport
        // '500px 0px 500px 0px' = 500px above and below
        rootMargin: this.preloadMargin + ' 0px ' + this.preloadMargin + ' 0px'
      }
    );

    this.observer.observe(this.el.nativeElement);
  }

  private loadImage() {
    const img = this.el.nativeElement.querySelector('img');
    if (img && this.src) {
      this.renderer.setAttribute(img, 'src', this.src);
    }
  }

  onImageLoad(): void {
    this.imageLoaded = true;
  }

  onImageError(): void {
    const img = this.el.nativeElement.querySelector('img');
    if (img) {
      this.renderer.setAttribute(img, 'src', this.placeholder);
    }
    this.imageLoaded = true; 
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.unobserve(this.el.nativeElement);
      this.observer.disconnect();
      this.observer = undefined;
    }
  }
}