import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-neutral-400">
      <Loader2 className="h-8 w-8 animate-spin text-neutral-300" />
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
