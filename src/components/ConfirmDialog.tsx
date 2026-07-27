import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={22} />}
        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      </div>
    </Modal>
  );
}
