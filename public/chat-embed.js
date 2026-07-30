/* Excel Tech AI chat widget — embeddable on exceltech.com.bd.
 * Usage:  <script src="https://exceltechpos.netlify.app/chat-embed.js" defer></script>
 * Optional config BEFORE the script tag:
 *   <script>window.ExcelChatConfig = { title:"...", greeting:"...", brandColor:"#026a40" };</script>
 * Self-contained (no dependencies); all classes prefixed .etc- to avoid clashing with the site.
 */
(function () {
  "use strict";
  if (window.__excelChatLoaded) return;
  window.__excelChatLoaded = true;

  var cfg = window.ExcelChatConfig || {};
  var API = (cfg.api || "https://exceltechpos.netlify.app").replace(/\/$/, "") + "/api/shop/agent";
  var BRAND = cfg.brandColor || "#026a40";
  var TITLE = cfg.title || "Excel Tech Assistant";
  var SUBTITLE = cfg.subtitle || "Ask about products, price & stock";
  var GREETING = cfg.greeting || "Hi! Ask me about any product — price, colours, stock — or place an order. English, বাংলা, or 中文.";

  var messages = []; // {role:'user'|'model', text}
  var busy = false;

  var css =
    ".etc-btn{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:" + BRAND + ";color:#fff;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000;display:flex;align-items:center;justify-content:center;font-size:26px;transition:transform .15s}" +
    ".etc-btn:hover{transform:scale(1.06)}" +
    ".etc-panel{position:fixed;bottom:88px;right:20px;width:92vw;max-width:370px;height:70vh;max-height:560px;background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);z-index:2147483000;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}" +
    ".etc-open{display:flex}" +
    ".etc-hd{background:" + BRAND + ";color:#fff;padding:12px 16px;display:flex;align-items:center;gap:8px}" +
    ".etc-hd b{font-size:14px;display:block;line-height:1.2}.etc-hd span{font-size:11px;opacity:.85}" +
    ".etc-x{margin-left:auto;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:.9;line-height:1}" +
    ".etc-body{flex:1;overflow-y:auto;padding:12px;background:#f6f8f7}" +
    ".etc-row{display:flex;margin-bottom:8px}.etc-row.u{justify-content:flex-end}" +
    ".etc-msg{max-width:85%;padding:8px 12px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}" +
    ".etc-row.u .etc-msg{background:" + BRAND + ";color:#fff;border-bottom-right-radius:4px}" +
    ".etc-row.b .etc-msg{background:#fff;color:#1b2430;border:1px solid #e3e8ee;border-bottom-left-radius:4px}" +
    ".etc-greet{color:#67737f;font-size:13px;text-align:center;padding:18px 8px}" +
    ".etc-foot{display:flex;gap:8px;padding:10px;border-top:1px solid #e9edf0;background:#fff}" +
    ".etc-in{flex:1;border:1px solid #d7dde2;border-radius:10px;padding:9px 11px;font-size:13.5px;outline:none;resize:none;max-height:90px;font-family:inherit}" +
    ".etc-in:focus{border-color:" + BRAND + "}" +
    ".etc-send{background:" + BRAND + ";color:#fff;border:none;border-radius:10px;width:40px;cursor:pointer;font-size:16px}" +
    ".etc-send:disabled{opacity:.5;cursor:default}" +
    ".etc-dot{display:inline-block;width:6px;height:6px;margin:0 1px;border-radius:50%;background:#9aa5ad;animation:etc-b 1s infinite}" +
    ".etc-dot:nth-child(2){animation-delay:.15s}.etc-dot:nth-child(3){animation-delay:.3s}" +
    "@keyframes etc-b{0%,80%,100%{opacity:.3}40%{opacity:1}}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "etc-btn";
  btn.setAttribute("aria-label", "Chat with us");
  btn.innerHTML = "&#128172;";

  var panel = document.createElement("div");
  panel.className = "etc-panel";
  panel.innerHTML =
    '<div class="etc-hd"><div><b>' + esc(TITLE) + "</b><span>" + esc(SUBTITLE) + '</span></div><button class="etc-x" aria-label="Close">&times;</button></div>' +
    '<div class="etc-body"></div>' +
    '<div class="etc-foot"><textarea class="etc-in" rows="1" placeholder="Type your message…"></textarea><button class="etc-send" aria-label="Send">&#10148;</button></div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var body = panel.querySelector(".etc-body");
  var input = panel.querySelector(".etc-in");
  var sendBtn = panel.querySelector(".etc-send");

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  function toggle(show) {
    var on = show == null ? !panel.classList.contains("etc-open") : show;
    panel.classList.toggle("etc-open", on);
    btn.innerHTML = on ? "&times;" : "&#128172;";
    if (on) { render(); input.focus(); }
  }

  function render() {
    if (!messages.length) {
      body.innerHTML = '<div class="etc-greet">' + esc(GREETING) + "</div>";
    } else {
      body.innerHTML = messages
        .map(function (m) {
          return '<div class="etc-row ' + (m.role === "user" ? "u" : "b") + '"><div class="etc-msg">' + esc(m.text) + "</div></div>";
        })
        .join("");
    }
    if (busy) body.innerHTML += '<div class="etc-row b"><div class="etc-msg"><span class="etc-dot"></span><span class="etc-dot"></span><span class="etc-dot"></span></div></div>';
    body.scrollTop = body.scrollHeight;
  }

  function send() {
    var text = (input.value || "").trim();
    if (!text || busy) return;
    messages.push({ role: "user", text: text });
    input.value = "";
    busy = true;
    render();
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        messages.push({ role: "model", text: (d && d.reply) || "Sorry, please try again." });
      })
      .catch(function () {
        messages.push({ role: "model", text: "Network problem — please try again in a moment." });
      })
      .then(function () { busy = false; render(); });
  }

  btn.addEventListener("click", function () { toggle(); });
  panel.querySelector(".etc-x").addEventListener("click", function () { toggle(false); });
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
})();
