import { StorageStatusPanel } from "../components/storage/StorageStatusPanel";
import type { GameSettings } from "../types/domain";

type SettingsScreenProps = {
  settings: GameSettings | null;
  onChange: (patch: Partial<GameSettings>) => void;
  onBack: () => void;
};

export function SettingsScreen({ settings, onChange, onBack }: SettingsScreenProps) {
  return (
    <main className="screen narrow-screen">
      <div className="topbar">
        <h1>設定</h1>
        <button type="button" onClick={onBack}>戻る</button>
      </div>
      <section className="panel form-stack">
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(settings?.reduce_motion)}
            onChange={(event) => onChange({ reduce_motion: event.target.checked })}
          />
          動きを控えめにする
        </label>
        <label>
          文字速度
          <select value={settings?.text_speed ?? "normal"} onChange={(event) => onChange({ text_speed: event.target.value as GameSettings["text_speed"] })}>
            <option value="slow">ゆっくり</option>
            <option value="normal">ふつう</option>
            <option value="fast">はやい</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(settings?.debug_panel)}
            onChange={(event) => onChange({ debug_panel: event.target.checked })}
          />
          おためし準備を表示
        </label>
      </section>
      <StorageStatusPanel />
    </main>
  );
}
