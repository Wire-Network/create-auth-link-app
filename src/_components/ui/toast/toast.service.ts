import { Injectable } from '@angular/core';

export interface ToastOptions {
    header: string;
    message: string;
    color?: 'success' | 'danger' | 'warning' | 'info';
    duration?: number;
}

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    show(options: ToastOptions) {
        const { header, message, color = 'info', duration = 3000 } = options;
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${color}`;
        toast.innerHTML = `
            <div class="toast-header">${header}</div>
            <div class="toast-body">${message}</div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                min-width: 250px;
                padding: 15px;
                border-radius: 4px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
            }
            .toast-success { background-color: #4caf50; color: white; }
            .toast-danger { background-color: #f44336; color: white; }
            .toast-warning { background-color: #ff9800; color: white; }
            .toast-info { background-color: #2196f3; color: white; }
            .toast-header {
                font-weight: bold;
                margin-bottom: 5px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(toast);
        
        // Remove after duration
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(toast);
                document.head.removeChild(style);
            }, 300);
        }, duration);
    }
} 