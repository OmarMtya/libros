import { Component } from '@angular/core';
import { LegalDoc } from './legal-doc';
import { TERMINOS } from './legal-content';

@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [LegalDoc],
  template: `<app-legal-doc [document]="document" />`,
})
export class Terminos {
  readonly document = TERMINOS;
}
