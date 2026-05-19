import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Product } from 'src/app/models/product.model';
import { ShopService } from 'src/app/services/shopServices/shop.service';
import { Observable, map } from 'rxjs';


type Variant = {
  key: string;
  attributes: Record<string, string>; // { color, size, fit, ... }
  price?: number;
  name?: string;
  sku: string;
  inventory: { onHand: number; branchId: string };
};

type Payload = {
  data: {
    product: { matrixBarcode: string; defaultPrice: number };
    dimensions: any[];
    variants: Variant[];
    index: { byAttr: Record<string, number[]>, byKey: Record<string, number> };
  };
};

type ResolveResult =
  | { status: "found"; variant: Variant }
  | { status: "not_found" }
  | { status: "ambiguous"; remainingDims: string[]; options: Record<string, string[]> }
  | { status: "out_of_stock"; variant: Variant };

@Component({
  selector: 'app-matrix-options',
  imports: [
    TranslateModule,
    FormsModule,
    CommonModule
  ],
  templateUrl: './matrix-options.component.html',
  styleUrl: './matrix-options.component.css'
})
export class MatrixOptionsComponent {

  private logger = inject(LoggerService);
  @Input() product !: Product | any;
  @Input() pageData: any;
  dimensions: any = [];
  selectedData: any = {};
  payload: Payload | any;

  constructor(
    private shopService: ShopService,
  ) {
    setTimeout(() => {

      this.payload = {
        data: {
          product: {
            matrixBarcode: this.product.matrixBarcode,
            defaultPrice: this.product.defaultPrice
          },
          dimensions: this.product.dimensions,
          variants: this.product.variants,
          index: this.product.index,
        }
      };

      this.dimensions = this.getDimensionsArray(this.getAvailableAttributes(this.payload, {}));

      // Add displayType to each dimension
      this.dimensions.forEach((dim: any) => {
        const originalDim = this.payload.data.dimensions.find((d: any) => d.name === dim.name);
        if (originalDim) {
          dim.displayType = originalDim.displayType;
          dim.type = originalDim.type;
        }
      });

      this.selectVariantBySKU(this.product.sku);
    }, 250);
  }

  getDimensionsArray(data: any) {
    return Object.keys(data).map(key => {
      // Find the original dimension definition to get displayType
      const originalDim = this.payload?.data?.dimensions?.find((d: any) => d.name === key);

      return {
        name: key,
        attributes: data[key], // This now includes totalAvailable, minPrice, maxPrice, enabled
        displayType: originalDim?.displayType || 'select', // Default to 'select' if not found
        type: originalDim.type || ''
      };
    });
  }

  async selectAttribute(dimensionName: string, selectedValue: string) {
    if (selectedValue && selectedValue != 'undefined') {
      this.selectedData[dimensionName] = selectedValue;
    } else {
      delete this.selectedData[dimensionName];
    }

    let tempDimensions = this.getDimensionsArray(this.getAvailableAttributes(this.payload, this.selectedData));

    // Update only the available dimensions
    for (const tempDimension of tempDimensions) {
      const existingDimension = this.dimensions.find((d: any) => d.name === tempDimension.name);
      if (existingDimension) {
        // Update attributes if the dimension exists - this will include totalAvailable
        existingDimension.attributes = tempDimension.attributes;
      } else {
        // If the dimension does not exist, you can choose to add it
        // Uncomment the next line if you want to add new dimensions
        // this.dimensions.push(tempDimension);
      }
    }

    //select the product
    let res: any = this.getVariantBySelection(this.payload, this.selectedData);
    if (res.variant) {
      this.product.selectedVariant = res.variant;
      this.product.id = res.variant.id;
      this.product.price = res.variant.inventory?.price || res.variant.price;
      this.product.quantity = res.variant.inventory?.onHand || 0;
      this.product.slideImages = [];
      if (res.variant.name) {
        this.product.name = res.variant.name;
      }
      if (res.variant.translation) {
        this.product.translation = res.variant.translation;
      }

      // Get Medias from server
      try {
        const mediaData = await this.getProductMedia(res.variant.id).toPromise();
        res.variant.medias = mediaData?.medias || [];

        // Process images
        let images = res.variant?.medias?.filter((f: any) => !f['3dUrl']) || [];
        let threeDImage = res.variant.inventory?.threeDModelUrl;
        
        
        if (threeDImage) {
          this.product.file3dUrl = threeDImage;
          if (this.product.file3dUrl) {
            this.product.file3dType = this.getFileType(this.product.file3dUrl);
          }
        }

        // Add regular images to slideImages
        if (images?.length > 0) {
          for (let i = 0; i < images.length; i++) {
            this.product.slideImages.push({
              id: i + 1,
              src: images[i].defaultUrl || 'assets/images/default-blank-image.png',
              w: 1200,
              h: 800,
              thumb: images[i].defaultUrl || 'assets/images/default-blank-image.png'
            });
          }
        } else {
          // If no images from API, use the product's mediaUrl or variant's mediaUrl
          const fallbackMediaUrl = res.variant?.mediaUrl || this.product?.mediaUrl || 'assets/images/default-blank-image.png';
          
          this.product.slideImages.push({
            id: 0,
            src: fallbackMediaUrl,
            w: 1200,
            h: 800,
            thumb: fallbackMediaUrl
          });
        }
      } catch (error: any) {
        this.logger.error(error?.message, { stack: error?.stack, context: 'MatrixOptionsComponent.fetchProductMedia' });
        
        // Use variant mediaUrl or product mediaUrl on error
        const fallbackMediaUrl = res.variant?.mediaUrl || this.product?.mediaUrl || 'assets/images/default-blank-image.png';
        
        this.product.slideImages.push({
          id: 0,
          src: fallbackMediaUrl,
          w: 1200,
          h: 800,
          thumb: fallbackMediaUrl
        });
      }
    } else {
      this.product.selectedVariant = null;
    }
  }

  /**
   * CORRECTED: Get product media images from server
   * Returns an Observable with the media data properly mapped
   * Handles errors and returns empty array if no medias found
   */
  getProductMedia(productId: string): Observable<any> {
    return this.shopService.getProductMedia(productId).pipe(
      map((response: any) => {
        
        // Handle the response structure: { success: true, data: { medias: [...] } }
        if (response && response.medias && Array.isArray(response.medias)) {
          return {
            medias: response.medias.map((media: any) => ({
              id: media.id,
              defaultUrl: media.defaultUrl || 'assets/images/default-blank-image.png',
              '3dUrl': media['3dUrl'] || null
            }))
          };
        }
        
        // If no medias found, return empty medias array
        // This will trigger the fallback to mediaUrl
        return {
          medias: []
        };
      })
    );
  }

  /**
   * Get file extension type from URL
   */
  getFileType(url: any): string {
    if (!url) return 'unknown';
    
    const lastDotIndex = url.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === url.length - 1) {
      return 'unknown';
    }
    const fileType = url.substring(lastDotIndex + 1);
    return fileType.toLowerCase();
  }

  /** ترتيب الأبعاد حسب تعريف الـpayload لبناء المفتاح بشكل صحيح */
  buildVariantKey(p: Payload, selection: Record<string, string>) {
    const parts: string[] = [p.data.product.matrixBarcode];
    for (const dim of p.data.dimensions) {
      const code = selection[dim.name];
      if (code == null) return null; // اختيار غير مكتمل
      parts.push(code);
    }
    return parts.join("_");
  }

  /** هل الاختيار يغطي كل الأبعاد؟ */
  isCompleteSelection(p: Payload, selection: Record<string, string>) {
    return p.data.dimensions.every(d => selection[d.name] != null);
  }

  selectVariantBySKU(sku: string): void {
    // Check if payload is available
    if (!this.payload || !this.payload.data || !this.payload.data.variants) {
      console.warn("Payload not available yet");
      return;
    }

    // Find the variant with matching SKU
    const variant = this.payload.data.variants.find((v: Variant) => v.sku === sku);

    if (!variant) {
      console.warn(`No variant found with SKU: ${sku}`);
      this.product.selectedVariant = null;
      this.selectedData = {};
      return;
    }

    // Set the selected variant
    this.product.selectedVariant = variant;
    this.product.id = variant.id;
    this.product.price = variant.inventory?.price || variant.price || this.payload.data.product.defaultPrice;

    // Update selectedData based on variant attributes
    this.selectedData = {};
    for (const [dimensionName, selectedValue] of Object.entries(variant.attributes)) {
      if (selectedValue && selectedValue != 'undefined') {
        this.selectedData[dimensionName] = selectedValue;
      } else {
        delete this.selectedData[dimensionName];
      }
    }

    // Refresh dimensions after selection to show current available options WITH totalAvailable
    let tempDimensions = this.getDimensionsArray(this.getAvailableAttributes(this.payload, this.selectedData));

    // Update only the available dimensions
    for (const tempDimension of tempDimensions) {
      const existingDimension = this.dimensions.find((d: any) => d.name === tempDimension.name);
      if (existingDimension) {
        // Update attributes if the dimension exists - this includes totalAvailable
        existingDimension.attributes = tempDimension.attributes;
        // Set selectedAttribute for select dropdowns
        if (this.selectedData[existingDimension.name] && this.selectedData[existingDimension.name] != 'undefined') {
          existingDimension.selectedAttribute = this.selectedData[existingDimension.name];
        } else {
          existingDimension.selectedAttribute = undefined;
        }
      } else {
        // If the dimension does not exist, you can choose to add it
        // Uncomment the next line if you want to add new dimensions
        // this.dimensions.push(tempDimension);
      }
    }
  }

  getVariantBySelection(p: Payload, selection: Record<string, string>): ResolveResult {
    // 1) اختيار كامل → byKey
    if (this.isCompleteSelection(p, selection)) {
      const key = this.buildVariantKey(p, selection);
      if (!key) return { status: "not_found" };
      const item = p.data.variants.find(f => f.sku == key);
      if (item === undefined) return { status: "not_found" };
      const v = item;
      if ((v.inventory?.onHand ?? 0) > 0) return { status: "found", variant: v };
      return { status: "out_of_stock", variant: v };
    }

    // 2) اختيار جزئي → فلترة
    const candidates = this.filterBySelection(p, selection);
    if (candidates.length === 0) return { status: "not_found" };
    if (candidates.length === 1) {
      const v = candidates[0];
      if ((v.inventory?.onHand ?? 0) > 0) return { status: "found", variant: v };
      return { status: "out_of_stock", variant: v };
    }

    // 3) ملتبس → رجّع ما تبقّى من الأبعاد وخياراتها الممكنة
    const remainingDims = p.data.dimensions
      .map(d => d.name)
      .filter(dn => selection[dn] == null);

    const options: Record<string, string[]> = {};
    for (const dim of remainingDims) {
      const set = new Set<string>();
      for (const v of candidates) {
        set.add(v.attributes[dim]);
      }
      options[dim] = Array.from(set); // قيم الأكواد المتاحة لهذا البعد
    }

    return { status: "ambiguous", remainingDims, options };
  }

  getAvailableAttributes(p: Payload, selection: Record<string, string> = {}) {
    const defaultPrice = p.data.product.defaultPrice;

    // Get ALL dimensions (not just unselected ones)
    const allDimensions = p.data.dimensions;
    
    // Result object to store aggregated data
    const result: Record<string, Record<string, { totalAvailable: number; minPrice: number; maxPrice: number }>> = {};

    // Initialize all dimensions and their attributes
    for (const dimDef of allDimensions) {
      const dimName = dimDef.name;
      result[dimName] = {};
      
      for (const attr of dimDef.attributes) {
        result[dimName][attr.code] = { 
          totalAvailable: 0, 
          minPrice: defaultPrice, 
          maxPrice: defaultPrice 
        };
      }
    }

    // Calculate totalAvailable for each attribute based on current selection
    for (const dimDef of allDimensions) {
      const dimName = dimDef.name;
      
      for (const attr of dimDef.attributes) {
        const attrCode = attr.code;
        
        // Create a temporary selection:
        // - If this dimension is already selected, replace its value with current attribute
        // - If not selected, add this attribute to the selection
        const tempSelection = { ...selection, [dimName]: attrCode };
        
        // Find all variants that match ALL the selection criteria
        let matchingVariants:any = p.data.variants.filter(variant => {
          // Check if this variant matches all selected attributes
          for (const [selectedDim, selectedCode] of Object.entries(tempSelection)) {
            if (variant.attributes[selectedDim] !== selectedCode) {
              return false;
            }
          }
          return true;
        });
        
        // Calculate aggregated values for this attribute
        let totalAvailable = 0;
        let minPrice = defaultPrice;
        let maxPrice = defaultPrice;
        let priceSet = false;

        for (const variant of matchingVariants) {
          const price =  variant.inventory?.price ? variant.inventory?.price : variant.price ? defaultPrice : 0;
          const avail = variant.inventory?.onHand ?? 0;
          
          totalAvailable += avail;
          
          if (!priceSet) {
            minPrice = price;
            maxPrice = price;
            priceSet = true;
          } else {
            minPrice = Math.min(minPrice, price);
            maxPrice = Math.max(maxPrice, price);
          }
        }

        // Update the result
        result[dimName][attrCode] = {
          totalAvailable,
          minPrice,
          maxPrice
        };
      }
    }

    // Format the result for the template
    const formatted: Record<string, any[]> = {};
    for (const [dim, codes] of Object.entries(result)) {
      formatted[dim] = Object.entries(codes).map(([code, agg]) => {
        const attribute = p.data.dimensions.find(d => d.name === dim)?.attributes.find((a: any) => a.code === code);
        return {
          code,
          name: attribute ? attribute.name : code,
          value: attribute?.value, // Add the original value property
          displayValue: attribute?.displayValue, // Add displayValue if it exists
          totalAvailable: agg.totalAvailable,
          minPrice: agg.minPrice,
          maxPrice: agg.maxPrice,
          enabled: agg.totalAvailable > 0,
          selected: selection[dim] === code // Add selected flag for template
        };
      });
    }

    return formatted;
  }

  filterBySelection(p: Payload, selection: Record<string, string>): Variant[] {
    let idxs: number[] | null = null;
    for (const [dim, code] of Object.entries(selection)) {
      const list = p.data.index.byAttr[`${dim}:${code}`] ?? [];
      idxs = idxs === null ? [...list] : idxs.filter(i => list.includes(i));
      if (idxs.length === 0) break;
    }
    return (idxs ?? []).map(i => p.data.variants[i]);
  }
}