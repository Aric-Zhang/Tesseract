import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = '<div class="placeholder-square" aria-label="initial render test"></div>';
}

