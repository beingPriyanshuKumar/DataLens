import { Loader2 } from "lucide-react";

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 className="spinner" size={size} />;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">📭</div>
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state">
      <div className="error-state__icon">⚠️</div>
      <p>{message}</p>
    </div>
  );
}
