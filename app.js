(() => {
  "use strict";

  function byId(id){
    const el = document.getElementById(id);
    if(!el) throw new Error(`No existe #${id} en el DOM`);
    return el;
  }

  function logLine(msg){
    const log = byId("log");
    const now = new Date().toLocaleTimeString();
    log.textContent += `[${now}] ${msg}\n`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const status = byId("status");
    const clicks = byId("clicks");
    const btnPing = byId("btnPing");
    const btnReset = byId("btnReset");
    const path = byId("path");

    path.textContent = location.href;

    let n = 0;

    status.textContent = "JS OK ✅";
    logLine("DOMContentLoaded OK");
    logLine("JS inicializado sin errores");

    btnPing.addEventListener("click", () => {
      n++;
      clicks.textContent = String(n);
      status.textContent = "PING ✅";
      logLine("PING pulsado");
    });

    btnReset.addEventListener("click", () => {
      n = 0;
      clicks.textContent = "0";
      status.textContent = "JS OK ✅";
      byId("log").textContent = "";
      logLine("RESET");
    });
  });

  window.addEventListener("error", (e) => {
    // Si algo revienta, lo verás en pantalla sí o sí
    try {
      const box = document.createElement("div");
      box.style.position = "fixed";
      box.style.left = "12px";
      box.style.right = "12px";
      box.style.bottom = "12px";
      box.style.padding = "12px";
      box.style.borderRadius = "12px";
      box.style.background = "rgba(220,38,38,.92)";
      box.style.color = "white";
      box.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
      box.style.zIndex = "999999";
      box.textContent = `ERROR JS: ${e.message}`;
      document.body.appendChild(box);
    } catch {}
  });
})();
