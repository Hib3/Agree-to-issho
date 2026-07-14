import type { CharacterState } from "../../domain/model/character";
import { locations } from "../../data/locations/locations";
import { db } from "../../infrastructure/db/database";
import { ScreenHeader } from "../../ui/components/ScreenHeader";

export function LocationsScreen({
  character,
  onBack,
  onChanged
}: {
  character: CharacterState;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  async function move(locationId: CharacterState["currentLocationId"], now: number) {
    await db.character.put({
      ...character,
      currentLocationId: locationId,
      emotion: locationId === "rooftop" ? "calm" : "curious",
      updatedAt: now
    });
    await onChanged();
    onBack();
  }
  return (
    <main className="feature-screen">
      <ScreenHeader title="どこで話す？" onBack={onBack} />
      <div className="location-list">
        {locations.map((location) => (
          <button
            className={`location-ticket location-${location.id}`}
            type="button"
            key={location.id}
            aria-pressed={character.currentLocationId === location.id}
            onClick={() => void move(location.id, Date.now())}
          >
            <strong>{location.name}</strong>
            <span>{location.description}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
