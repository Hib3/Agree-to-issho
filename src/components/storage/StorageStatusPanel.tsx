import { useEffect, useState } from "react";

type StorageEstimate = {
  quota?: number;
  usage?: number;
  persisted: boolean;
};

export function StorageStatusPanel() {
  const [estimate, setEstimate] = useState<StorageEstimate>({ persisted: false });

  useEffect(() => {
    async function load() {
      const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
      if (navigator.storage?.persist) {
        await navigator.storage.persist().catch(() => false);
      }
      const usage = navigator.storage?.estimate ? await navigator.storage.estimate() : {};
      setEstimate({ quota: usage.quota, usage: usage.usage, persisted });
    }
    void load();
  }, []);

  return (
    <section className="panel storage-panel">
      <h2>この端末の保存</h2>
      <p>長く残す設定: {estimate.persisted ? "有効" : "確認中"}</p>
      <p>使っている容量: {formatBytes(estimate.usage)} / {formatBytes(estimate.quota)}</p>
    </section>
  );
}

function formatBytes(value?: number): string {
  if (!value) return "不明";
  return `${Math.round(value / 1024)} KB`;
}
