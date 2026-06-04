import "./app/styles";
import { createWallpaperApp } from "./app/create-wallpaper-app";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const wallpaperApp = createWallpaperApp(app);
  const dispose = () => {
    window.removeEventListener("beforeunload", dispose);
    wallpaperApp.dispose();
  };
  window.addEventListener("beforeunload", dispose);
}
