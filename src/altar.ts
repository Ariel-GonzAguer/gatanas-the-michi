/**
 * El altar de regalos: la página que sirve el Sprite en su URL.
 *
 * Estética: gato callejero, servidor viejo, noche. Sin frameworks, sin CDNs,
 * sin build: una sola página HTML con su CSS y su JS. El gato lo revisa desde
 * el chat, no con formularios.
 */
import type { Gift } from "./prey.js";
import { giftGlyph, giftLabel } from "./prey.js";
import type { GatanasMemory } from "./memory.js";
import { titleFor, TREAT_PUZZLE } from "./opinion.js";
import { NineLives } from "./lives.js";

export interface AltarSnapshot {
  name: string;
  memory: GatanasMemory;
  alive: boolean;
  awake: boolean;
  lastWatchAt: string | null;
  voiceOk: boolean;
  lives: number;
  purrDrought: number;
  now: string;
}

export function altarHtml(s: AltarSnapshot): string {
  // El gato se dibuja según lo que está pasando. Los estados los decide el
  // servidor; el cliente solo los pinta.
  const cat = s.alive ? (s.awake ? CAT_AWAKE : CAT_SLEEP) : CAT_TRANCE;
  const living = s.memory.gifts.filter((g) => !g.rejected);
  const gpus = living.filter((g) => g.kind === "gpu").length;
  const tofu = living.filter((g) => g.kind === "tofu").length;
  const leaves = living.filter((g) => g.kind === "leaf").length;
  const title = titleFor(s.memory, s.purrDrought);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.name)} · el altar de regalos</title>
<meta name="description" content="Un gato callejero vive en un Sprite de Fly.io y te trae regalos de valor dudoso.">
<meta property="og:title" content="${esc(s.name)} · el altar de regalos">
<meta property="og:description" content="${esc(s.memory.opinion?.quote ?? "El gato aún te mira sin opinar.")}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(CAT_FAVICON)}">
<style>${CSS}</style>
</head>
<body>
<main>
  <header class="masthead">
    <div class="catface" aria-hidden="true">${cat}</div>
    <h1>${esc(s.name)}</h1>
    <p class="tagline">Hola, soy ${esc(s.name)}. Vivo dentro de este Sprite. Cazo de noche y te traigo regalos de valor dudoso. Estás viendo mi altar.</p>
    <p class="status ${s.alive ? "ok" : "bad"}">
      ${s.alive
        ? s.awake
          ? "el gato está aquí, vigilando"
          : "el gato duerme. el Sprite duerme. todo en orden"
        : "el gato está en trance: se está restaurando desde una de sus vidas"}
      <span class="dot"></span>
    </p>
    <p class="human">Título honorífico: <strong>${esc(title)}</strong></p>
  </header>

  <section class="opinion" aria-label="La opinión del gato sobre ti">
    <h2>Mi opinión sobre mi humano</h2>
    <p>${s.memory.opinion ? esc(s.memory.opinion.quote) : "Este humano todavía no me ha dado motivos para opinar. Eso es, de hecho, una opinión."}</p>
  </section>

  <section class="altar" aria-label="El altar de regalos">
    <h2>El altar</h2>
    ${living.length === 0 ? emptyAltar(s) : living.slice(0, 30).map(giftCard).join("\n")}
  </section>

  <section class="stats" aria-label="Cifras del gato">
    <div><span class="n">${s.lives}</span><span class="l">vidas</span></div>
    <div><span class="n">${s.memory.purrs}</span><span class="l">caricias</span></div>
    <div><span class="n">${s.memory.hunts}</span><span class="l">rondas de cacería</span></div>
    <div><span class="n">${gpus}</span><span class="l">GPUs encontradas</span></div>
    <div><span class="n">${tofu}</span><span class="l">tofus fermentados</span></div>
    <div><span class="n">${leaves}</span><span class="l">hojas de árbol</span></div>
  </section>

  <section class="chat" aria-label="Habla con el gato">
    <h2>Hablarle al gato</h2>
    <div id="hilo" class="fila"></div>
    <form id="form" autocomplete="off">
      <label class="sr" for="msg">Tu mensaje</label>
      <textarea id="msg" rows="2" maxlength="1200" placeholder="Decile algo. No muerde, pero tampoco perdona." required></textarea>
      <div class="botonera">
        <button type="submit">Maullar</button>
        <button type="button" id="purr" class="sec">Acariciar</button>
      </div>
    </form>
    <p class="disclaimer">${esc(TREAT_PUZZLE(s.purrDrought))}</p>
  </section>

  <footer>
    <p>Corre en <a href="https://fly.io/sprites">Fly.io Sprites</a> · habla por el gateway de conectores de Sprites (OpenRouter) · guarda su acta en su propio disco.</p>
    <p class="pico">${esc(s.name)} · vidas: ${s.lives} · última ronda: ${s.memory.lastHuntAt ? esc(timeAgo(s.memory.lastHuntAt, s.now)) : "nunca"} · despierto desde ${s.lastWatchAt ? esc(timeAgo(s.lastWatchAt, s.now)) : "que nació"}</p>
  </footer>
</main>
<script>${JS}</script>
</body>
</html>`;
}

function giftCard(g: Gift): string {
  return `<article class="gift ${g.kind}">
  <span class="emoji">${giftGlyph(g.kind)}</span>
      <div class="body">
        <h3>${esc(giftLabel(g.kind))}</h3>
    <p class="narration">${esc(g.narration)}</p>
    <p class="meta">cazado ${esc(g.preyTitle)} · ${esc(timeAgo(g.at, new Date().toISOString()))}</p>
    ${g.kind !== "leaf" ? `<p class="advice">Disección: ${esc(g.advice)}</p>` : ""}
  </div>
</article>`;
}

function emptyAltar(s: AltarSnapshot): string {
  return `<p class="empty">El altar está vacío. El gato está en su primera noche de cacería. Volvé en un rato, o llamalo por el chat a ver si encuentra algo.</p>
<p class="empty small">Mientras esperás: este Sprite lleva ${s.memory.watches} vigilias. Cada vigilia es un meow. Nadie los escucha, pero ahí quedan.</p>`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function timeAgo(iso: string, nowIso: string): string {
  const diff = (Date.parse(nowIso) - Date.parse(iso)) / 1000;
  if (!Number.isFinite(diff)) return "en un tiempo raro";
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  return `hace ${Math.round(diff / 86400)} días`;
}

const CAT_AWAKE = `<pre class="art">  /\\_/\\    <span class="eye">o.o</span>
 (  ^  )   Gatanás, despierto
  &gt; ^ &lt;</pre>`;

const CAT_SLEEP = `<pre class="art">  /\\_/\\
 ( -.- )   zZz
  &gt; ^ &lt;</pre>`;

const CAT_TRANCE = `<pre class="art">  /\\_/\\
 ( x.x )   nahualada
  &gt; ^ &lt;</pre>`;

const CAT_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐈‍⬛</text></svg>`;

const CSS = `
:root{--bg:#0b0908;--ink:#e8ded0;--dim:#a4958a;--line:#2a2421;--gpu:#c9a227;--tofu:#8fb59a;--leaf:#8a6b4a;--hot:#e06a3b}
*{box-sizing:border-box}
html{background:var(--bg);color:var(--ink);font:16px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
body{margin:0;background-image:radial-gradient(circle at 20% -10%,#1b1410 0,transparent 45%),radial-gradient(circle at 90% 110%,#141a16 0,transparent 40%);min-height:100vh}
main{max-width:820px;margin:0 auto;padding:48px 20px 64px}
h1{font-size:2.1rem;letter-spacing:-.02em;margin:.2em 0}
h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.22em;color:var(--dim);font-weight:600;margin:0 0 14px}
.catface{color:var(--dim)}
.art{margin:0;font-size:.85rem;line-height:1.15;color:var(--dim)}
.eye{color:var(--gpu)}
.tagline{color:var(--dim);max-width:60ch}
.status{font-size:.85rem;display:flex;align-items:center;gap:10px;color:var(--dim)}
.status.ok .dot{background:var(--tofu);box-shadow:0 0 12px var(--tofu)}
.status.bad .dot{background:var(--hot);box-shadow:0 0 12px var(--hot)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--dim);animation:pulse 2.4s infinite}
@keyframes pulse{50%{opacity:.35}}
.human{font-size:.85rem;color:var(--dim)}
.opinion{border-left:3px solid var(--gpu);padding:4px 0 4px 18px;margin:40px 0}
.opinion p{font-size:1.05rem;font-style:italic;margin:0}
.altar{margin:48px 0}
.gift{display:grid;grid-template-columns:3rem 1fr;gap:14px;border:1px solid var(--line);border-radius:6px;padding:16px;margin-bottom:12px;background:#0f0c0b}
.gift .emoji{line-height:1;align-self:start}
.glyph{width:40px;height:40px;display:block}
.gift h3{margin:0 0 4px;font-size:1rem}
.gift.gpu{border-left:3px solid var(--gpu)}
.gift.tofu{border-left:3px solid var(--tofu)}
.gift.leaf{border-left:3px solid var(--leaf)}
.narration{margin:0 0 8px;color:var(--ink)}
.meta,.advice{font-size:.78rem;color:var(--dim);margin:2px 0}
.advice{border-top:1px dashed var(--line);padding-top:6px;margin-top:8px}
.empty{color:var(--dim);border:1px dashed var(--line);padding:20px;border-radius:6px}
.empty.small{font-size:.85rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:40px 0}
.stats div{border:1px solid var(--line);border-radius:6px;padding:12px}
.stats .n{display:block;font-size:1.5rem;color:var(--gpu)}
.stats .l{display:block;font-size:.72rem;color:var(--dim);text-transform:uppercase;letter-spacing:.12em}
.chat{margin:48px 0;border-top:1px solid var(--line);padding-top:32px}
.fila{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.turn{border:1px solid var(--line);border-radius:6px;padding:10px 14px;max-width:92%}
.turn.user{align-self:flex-end;background:#171210;color:var(--dim)}
.turn.cat{align-self:flex-start;background:#0f1410}
form{display:flex;flex-direction:column;gap:10px}
textarea{width:100%;background:#0f0c0b;border:1px solid var(--line);color:var(--ink);font:inherit;padding:12px;border-radius:6px;resize:vertical}
textarea:focus,input:focus,button:focus{outline:2px solid var(--gpu);outline-offset:2px}
.botonera{display:flex;gap:10px}
button{font:inherit;background:var(--gpu);color:#0b0908;border:0;border-radius:6px;padding:10px 18px;cursor:pointer;font-weight:600}
button.sec{background:transparent;color:var(--ink);border:1px solid var(--line)}
button:hover{filter:brightness(1.1)}
button[disabled]{opacity:.5;cursor:wait}
.disclaimer{font-size:.8rem;color:var(--dim)}
footer{margin-top:56px;border-top:1px solid var(--line);padding-top:18px;font-size:.78rem;color:var(--dim)}
a{color:var(--tofu)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.dot{animation:none}}
`;

const JS = `
const hilo=document.getElementById('hilo');
const form=document.getElementById('form');
const msg=document.getElementById('msg');
const purr=document.getElementById('purr');
function turn(who,text){
  const d=document.createElement('div');
  d.className='turn '+who;
  d.textContent=text;
  hilo.appendChild(d);
  d.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function post(url,body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  const j=await r.json().catch(()=>({reply:'mrrp (error de cable)'}));
  return j;
}
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const text=msg.value.trim();
  if(!text)return;
  turn('user',text);
  msg.value='';
  form.querySelector('button[type=submit]').disabled=true;
  try{
    const j=await post('/api/chat',{message:text});
    turn('cat',j.reply||'mrrp.');
  }catch{ turn('cat','No me oigo a mí mismo. Prueba otra vez.'); }
  finally{ form.querySelector('button[type=submit]').disabled=false; }
});
purr.addEventListener('click',async()=>{
  purr.disabled=true;
  try{ const j=await post('/api/purr'); turn('cat',j.reply||'Prrrr.'); document.querySelectorAll('.stats .n')[1].textContent=j.purrs; }
  catch{ turn('cat','Me hiciste una caricia al aire. miau.'); }
  finally{ purr.disabled=false; }
});
`;
