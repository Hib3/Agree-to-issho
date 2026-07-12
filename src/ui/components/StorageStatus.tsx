import { useEffect, useState } from "react";

export function StorageStatus() {
  const [text, setText] = useState("保存領域を確認中");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await navigator.storage?.persist?.();
        const estimate = await navigator.storage?.estimate?.();
        if (!active) return;
        const used = Math.round((estimate?.usage ?? 0) / 1024);
        const total = Math.round((estimate?.quota ?? 0) / 1024 / 1024);
        setText(`この端末で ${used}KB 使用 / 約${total}MB 利用可能`);
      } catch {
        if (active) setText("この端末の中へ保存します");
      }
    })();
    return () => { active = false; };
  }, []);
  return <p className="storage-status">{text}</p>;
}
