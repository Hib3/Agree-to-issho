import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
  return registerSW({
    immediate: true
  });
}
