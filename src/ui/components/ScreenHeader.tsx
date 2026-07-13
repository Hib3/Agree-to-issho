import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function ScreenHeader({
  title,
  onBack,
  aside
}: {
  title: string;
  onBack?: () => void;
  aside?: ReactNode;
}) {
  return (
    <header className="screen-header">
      {onBack ? (
        <button
          className="icon-button"
          type="button"
          aria-label="部屋へ戻る"
          title="部屋へ戻る"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
      ) : (
        <span />
      )}
      <h1>{title}</h1>
      <div>{aside}</div>
    </header>
  );
}
