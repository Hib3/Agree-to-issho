export type DiaryTemplate = { id: string; focus: string; text: string };

const focuses = [
  "新しい言葉",
  "選んだ答え",
  "つながり",
  "外出",
  "小さな発見",
  "気持ち",
  "人の呼び方",
  "好きなもの",
  "直したこと",
  "静かな時間"
];
const reflections = [
  "ノートに線を引いて、あとで思い出せるようにした。",
  "最初とは少し違う見え方になって、もっと知りたくなった。",
  "教えてもらった通りに覚えると、次の話が作れそうだった。",
  "間違えた所を直したら、言葉の置き場所が見つかった。",
  "今日の気分と一緒に、短いメモへ残しておいた。",
  "別の場所でも思い出せるか、今度ためしてみたい。"
];

export const diaryTemplates: DiaryTemplate[] = focuses.flatMap((focus, focusIndex) =>
  reflections.map((reflection, reflectionIndex) => ({
    id: `diary_${focusIndex}_${reflectionIndex}`,
    focus,
    text: `${focus}のことを振り返った。${reflection}`
  }))
);
