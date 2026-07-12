import type { ReactNode } from "react";

export function ScreenHeader({ title, onBack, aside }: { title: string; onBack?: () => void; aside?: ReactNode }) {
  return (
    <header className="screen-header">
      {onBack ? <button type="button" aria-label="戻る" onClick={onBack}>←</button> : <span />}
      <h1>{title}</h1>
      <div>{aside}</div>
    </header>
  );
}
