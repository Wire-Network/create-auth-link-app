import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ConnectService } from '../connect/connect.service';
import { ToastService } from '../ui/toast/toast.service';
import { AddressPipe } from '../../_pipes/address.pipe';
import { IonIcon } from "@ionic/angular/standalone";
import { AccountService } from '../../_services/account.service';
import { LinkService } from '../../_services/link.service';
import { TransactionService } from '../../_services/transaction.service';
import { Subscription } from 'rxjs';
import { KeyService } from '../../_services/key.service';

@Component({
    selector: 'app-create-link',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, IonicModule, AddressPipe],
    templateUrl: './create-link.component.html',
    styleUrls: ['./create-link.component.scss']
})
export class CreateLinkComponent implements OnInit, OnDestroy {
    step: 1 | 2 | 3 = 1;
    loading = false;
    private subscriptions: Subscription[] = [];

    constructor(
        private router: Router,
        private toast: ToastService,
        public connect: ConnectService,
        public accountService: AccountService,
        private linkService: LinkService,
        private transactionService: TransactionService,
        private keyService: KeyService
    ) {}

    ngOnInit() {
        // Subscribe to link status changes
        this.subscriptions.push(
            this.linkService.linkExists$.subscribe(exists => {
                if (exists) {
                    console.log('Link exists, moving to step 3');
                    this.step = 3;
                }
            })
        );

        // Check initial link status
        if (this.accountService.username) {
            console.log('Checking initial link status for username:', this.accountService.username);
            this.linkService.checkLinkStatus();
        }
    }

    ngOnDestroy() {
        // Clean up subscriptions
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }

    async step1() {
        this.loading = true;
        try {
            console.log('Starting step 1: Creating link');
            if (!this.accountService.username) {
                throw new Error('No username available for link creation');
            }
            
            let pubKey = await this.keyService.retrievePubKey();
            console.log('Retrieved public key:', pubKey);
            
            if (!pubKey) {
                console.error('Failed to retrieve public key');
                return undefined;
            }
            debugger;
            pubKey = pubKey.startsWith('0x') ? pubKey.substring(2) : pubKey;
            
            console.log('Got public key for link creation:', pubKey);

            // Create the link transaction
            const result = await this.transactionService.createLinkTransaction(
                this.accountService.username,
                pubKey
            );

            console.log('Link transaction result:', result);

            if (result.status === 'executed') {
                console.log('Link transaction executed successfully');
                this.step = 2;
                this.toast.show({
                    header: 'Success',
                    message: 'Link created successfully!',
                    color: 'success'
                });
            } else {
                throw new Error(result.error || 'Failed to create link');
            }
        } catch (err: any) {
            console.error('Error in step1:', err);
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
            console.log('Starting step 2: Link authorization');
            if (!this.accountService.username) {
                throw new Error('No username available for link authorization');
            }
            
            const result = await this.transactionService.linkAuthTransaction(
                this.accountService.username
            );

            console.log('Link auth transaction result:', result);

            if (result.status === 'executed') {
                console.log('Link auth transaction executed successfully');
                this.step = 3;
                this.toast.show({
                    header: 'Success',
                    message: 'Link authorized successfully!',
                    color: 'success'
                });
                // Check link status after auth
                await this.linkService.checkLinkStatus();
            } else {
                throw new Error(result.error || 'Failed to authorize link');
            }
        } catch (err: any) {
            console.error('Error in step2:', err);
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
