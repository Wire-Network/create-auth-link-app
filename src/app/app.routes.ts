import { Routes } from '@angular/router';
import { CreateLinkComponent } from '../_components/create-link/create-link.component';
import { HomeComponent } from '../_components/home/home.component';

export const routes: Routes = [
    {
        path: '',
        component: HomeComponent
    },
    {
        path: 'create-link',
        component: CreateLinkComponent
    }
];
