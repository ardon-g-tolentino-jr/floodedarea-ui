import React from 'react';

export interface ToastData {
  msg: string;
  actionLabel?: string;
  onAction?: () => void;
}

const Toast: React.FC<{ toast: ToastData }> = ({ toast }) => (
  <div
    style={{
      position: 'fixed',
      bottom: 26,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1300,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 18px',
      background: '#0F172A',
      color: '#fff',
      borderRadius: 13,
      boxShadow: '0 12px 34px rgba(15,23,42,.4)',
      fontSize: 13.5,
      fontWeight: 700,
      animation: 'toastIn .2s ease-out',
      maxWidth: '92vw',
    }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', flex: 'none' }} />
      {toast.msg}
    </span>
    {toast.actionLabel && toast.onAction && (
      <button
        onClick={toast.onAction}
        style={{ border: 0, background: 'rgba(255,255,255,.16)', color: '#fff', padding: '6px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', flex: 'none' }}
      >
        {toast.actionLabel}
      </button>
    )}
  </div>
);

export default Toast;
