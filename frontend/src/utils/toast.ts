export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export function showToast(message: string, type: Toast['type'] = 'info') {
  const event = new CustomEvent('app-toast', {
    detail: { message, type }
  });
  window.dispatchEvent(event);
}
