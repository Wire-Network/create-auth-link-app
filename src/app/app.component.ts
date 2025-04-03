import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConnectComponent } from '../_components/connect/connect.component';
import { ChainSelectorComponent } from '../_components/chain-selector/chain-selector.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConnectComponent, ChainSelectorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'wallet-connect-app';
}
