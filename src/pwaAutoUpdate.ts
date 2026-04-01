import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const registerPwaAutoUpdate = () => {
  if (!("serviceWorker" in navigator)) return;

  let isReloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isReloading) return;
    isReloading = true;
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      console.error("PWA service worker registration failed", error);
    }
  });
};
