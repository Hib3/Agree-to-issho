import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const files = walk(join(root, "src")).filter((path) => [".ts", ".tsx", ".css", ".json"].includes(extname(path)));
const errors: string[] = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (/\b(?:TODO|FIXME|DUMMY_DATA|PLACEHOLDER_TEXT)\b/i.test(text)) errors.push(`${relative(root, file)} contains unfinished marker`);
  if (/legacy\/|from\s+["'][^"']*old|from\s+["'][^"']*game\//i.test(text)) errors.push(`${relative(root, file)} imports legacy runtime code`);
}

const publicFiles = walk(join(root, "public")).map((path) => relative(join(root, "public"), path).replaceAll("\\", "/"));
const allowedPublic = new Set([
  "assets/characters/main/fullbody/approved/aguri_normal.png",
  "assets/characters/main/fullbody/approved/aguri_talk_happy.png",
  "assets/characters/main/fullbody/approved/aguri_thinking.png",
  "assets/characters/main/fullbody/approved/aguri_confused.png",
  "assets/characters/main/fullbody/approved/aguri_sleepy.png",
  "assets/characters/main/fullbody/approved/aguri_embarrassed.png",
  "assets/characters/main/fullbody/approved/aguri_idle_blink.png",
  "assets/characters/main/fullbody/approved/aguri_lonely.png",
  "assets/characters/main/fullbody/approved/aguri_proud.png",
  "assets/characters/main/fullbody/approved/aguri_surprised.png",
  "assets/characters/main/fullbody/approved/aguri_talk_normal.png",
  "assets/backgrounds/aguri_room_day.webp",
  "assets/backgrounds/aguri_room_evening.webp",
  "assets/backgrounds/aguri_room_night.webp",
  "assets/backgrounds/aguri_room_rainy.webp",
  "assets/backgrounds/aguri_street_day.webp",
  "assets/backgrounds/aguri_rooftop_evening.webp",
  "assets/ui/textures/dialogue-paper.webp",
  "assets/ui/textures/choice-paper.webp",
  "assets/ui/textures/primary-fabric.webp"
]);
for (const file of publicFiles) if (!allowedPublic.has(file)) errors.push(`unapproved public runtime file: ${file}`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`clean-room verified: ${files.length} source files, ${publicFiles.length} approved public assets`);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
