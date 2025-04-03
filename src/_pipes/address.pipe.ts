import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'address',
    standalone: true
})
export class AddressPipe implements PipeTransform {
    transform(value: string | undefined): string {
        if (!value) return '';
        return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
    }
} 