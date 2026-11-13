import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [confirming, setConfirming] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions, action: () => Promise<void>) => {
    setOptions(opts);
    setPendingAction(() => action);
    setOpen(true);
  }, []);

  async function handleConfirm() {
    if (!pendingAction) return;
    setConfirming(true);
    try {
      await pendingAction();
    } finally {
      setConfirming(false);
      setOpen(false);
      setPendingAction(null);
    }
  }

  function handleCancel() {
    setOpen(false);
    setPendingAction(null);
  }

  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title ?? 'Onay'}</AlertDialogTitle>
          <AlertDialogDescription>{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={confirming}>
            {options?.cancelText ?? 'İptal'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={confirming}
            className={
              options?.destructive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : undefined
            }
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                İşleniyor...
              </>
            ) : (
              options?.confirmText ?? 'Onayla'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
