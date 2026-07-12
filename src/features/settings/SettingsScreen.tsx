import type { GameSettings } from "../../domain/model/player";
import { db } from "../../infrastructure/db/database";
import { ScreenHeader } from "../../ui/components/ScreenHeader";
import { StorageStatus } from "../../ui/components/StorageStatus";

export function SettingsScreen({ settings, onBack, onChanged }: { settings: GameSettings; onBack: () => void; onChanged: () => Promise<void> }) {
  async function patch(changes: Partial<GameSettings>) {
    await db.settings.put({ ...settings, ...changes, updatedAt: Date.now() });
    await onChanged();
  }
  return (
    <main className="feature-screen">
      <ScreenHeader title="部屋の設定" onBack={onBack} />
      <section className="settings-list paper-panel">
        <label>文字の速さ<select value={settings.textSpeed} onChange={(event) => void patch({ textSpeed: event.target.value as GameSettings["textSpeed"] })}><option value="slow">ゆっくり</option><option value="normal">ふつう</option><option value="fast">はやい</option></select></label>
        <label>文字の大きさ<select value={settings.fontScale} onChange={(event) => void patch({ fontScale: event.target.value as GameSettings["fontScale"] })}><option value="small">小さめ</option><option value="normal">ふつう</option><option value="large">大きめ</option></select></label>
        <label className="toggle-row"><input type="checkbox" checked={settings.highContrast} onChange={(event) => void patch({ highContrast: event.target.checked })} />高いコントラスト</label>
        <label className="toggle-row"><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => void patch({ reducedMotion: event.target.checked })} />動きを減らす</label>
        <label className="toggle-row"><input type="checkbox" checked={settings.autonomousSpeech} onChange={(event) => void patch({ autonomousSpeech: event.target.checked })} />アグリちゃんから話しかける</label>
        <label>音量<input type="range" min={0} max={1} step={0.1} value={settings.volume} onChange={(event) => void patch({ volume: Number(event.target.value) })} /></label>
        <label className="toggle-row"><input type="checkbox" checked={settings.muted} onChange={(event) => void patch({ muted: event.target.checked })} />ミュート</label>
        <StorageStatus />
      </section>
    </main>
  );
}
