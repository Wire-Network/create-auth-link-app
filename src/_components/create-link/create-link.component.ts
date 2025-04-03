import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ConnectService } from '../connect/connect.service';
import { SettleService } from '../../_services/settle.service';
import { ToastService } from '../ui/toast/toast.service';
import { AddressPipe } from '../../_pipes/address.pipe';
import { IonIcon } from "@ionic/angular/standalone";

@Component({
    selector: 'app-create-link',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, IonicModule, AddressPipe],
    templateUrl: './create-link.component.html',
    styleUrls: ['./create-link.component.scss']
})
export class CreateLinkComponent implements OnInit {
    step: 1 | 2 | 3 = 1;
    loading = false;

    constructor(
        private router: Router,
        public settle: SettleService,
        private toast: ToastService,
        public connect: ConnectService,
    ) {}

    ngOnInit() {
        if (this.settle.username) {
            this.checkLink();
        }
    }

    async checkLink() {
        console.log('Checking link...');
        try {
            const result = await this.settle.checkLinkByUsername(this.settle.username!);
            console.log('RESULT: ', result);
        } catch (err) {
            console.error(err);
        }
    }

    async step1() {
        this.loading = true;
        try {
            const create_link_receipt = await this.settle.createLink(this.settle.username!);
            console.log('RESULT: ', create_link_receipt);
            this.step = 2;
        } catch (err: any) {
            console.error(err);
            this.toast.show({
                header: 'Error Creating Link:',
                message: err.toString(),
                color: 'danger'
            });
        } finally {
            this.loading = false;
        }
    }

    async step2() {
        this.loading = true;
        try {
            const auth_receipt = await this.settle.linkAuthExt(this.settle.username!);
            console.log('RESULT: ', auth_receipt);
            this.step = 3;
        } catch (err: any) {
            console.error(err);
            this.toast.show({
                header: 'Error Authorizing Link:',
                message: err.toString(),
                color: 'danger'
            });
        } finally {
            this.loading = false;
        }
    }

    back() {
        this.step = 1;
    }
}

export interface ImxModalData {
    step: 1 | 2 | 3 | 4;
    email?: string;
    address?: string;
}
