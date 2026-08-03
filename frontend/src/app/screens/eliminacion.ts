import { Component } from '@angular/core';
import { LegalDoc } from './legal-doc';
import { ELIMINACION } from './legal-content';

@Component({
  selector: 'app-eliminacion',
  standalone: true,
  imports: [LegalDoc],
  template: `<app-legal-doc [document]="document" />`,
})
export class Eliminacion {
  readonly document = ELIMINACION;
}
