import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CreateLinkComponent } from './create-link.component';

const routes: Routes = [
    {
        path: '',
        component: CreateLinkComponent,
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class CreateLinkRoutingModule {}
