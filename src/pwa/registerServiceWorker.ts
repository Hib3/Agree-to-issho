export function getServiceWorkerUrl(baseUrl: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}sw.js`;
}

export function registerServiceWorker(baseUrl: string): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(getServiceWorkerUrl(baseUrl), { scope: baseUrl }).catch((error: unknown) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
