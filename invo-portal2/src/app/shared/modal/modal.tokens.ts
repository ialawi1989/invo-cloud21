import { InjectionToken } from '@angular/core';
import { ModalRef } from './modal.service';

export const MODAL_DATA = new InjectionToken<any>('MODAL_DATA');
export const MODAL_REF  = new InjectionToken<ModalRef<any>>('MODAL_REF');
