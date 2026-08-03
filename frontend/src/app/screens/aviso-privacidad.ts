import { Component } from '@angular/core';
import { LegalDoc } from './legal-doc';
import { AVISO_PRIVACIDAD } from './legal-content';

@Component({
  selector: 'app-aviso-privacidad',
  standalone: true,
  imports: [LegalDoc],
  template: `<app-legal-doc [document]="document" />`,
})
export class AvisoPrivacidad {
  readonly document = AVISO_PRIVACIDAD;
}
