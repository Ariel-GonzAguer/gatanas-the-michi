/**
 * La guarida de regalos: la página que sirve el Sprite en su URL.
 *
 * Estética: gato callejero, servidor viejo, noche. Sin frameworks, sin CDNs,
 * sin build: una sola página HTML con su CSS y su JS. El gato lo revisa desde
 * el chat, no con formularios. Todo lo visible está en inglés para los jueces;
 * el navegador lo traduce nativamente a cualquier otro idioma.
 */
import type { Gift } from "./prey.js";
import { giftGlyph, giftLabel } from "./prey.js";
import { opinionBody } from "./opinion.js";
import type { GatanasMemory } from "./memory.js";

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

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.name)} · the lair of gifts</title>
<meta name="description" content="A street cat lives inside a Fly.io Sprite and brings you gifts of dubious value.">
<meta property="og:title" content="${esc(s.name)} · the lair of gifts">
<meta property="og:description" content="${esc(s.memory.opinion ? opinionBody(s.memory.opinion.quote) : "The cat still watches you without an opinion.")}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(CAT_FAVICON)}">
<style>${CSS}</style>
</head>
<body>
<main>
  <header class="masthead">
    <div class="catface" role="button" tabindex="0" aria-label="Pet the cat" data-mood="${s.alive ? (s.awake ? "awake" : "sleep") : "trance"}">${cat}</div>
    <h1>${esc(s.name)}</h1>
    <p class="tagline">Hi, I'm ${esc(s.name)}. I live inside this Sprite. I hunt at night and bring you gifts of dubious value. You're looking at my lair.</p>
    <p class="status ${s.alive ? "ok" : "bad"}">
      ${s.alive
        ? s.awake
          ? "the cat is here, watching"
          : "the cat sleeps. the Sprite sleeps. all in order"
        : "the cat is in a trance: it's being restored from one of its lives"}
      <span class="dot"></span>
    </p>
    <p class="ticker" id="ticker" aria-hidden="true">the Sprite hums. the cat pretends not to hear.</p>
  </header>

  <section class="opinion" aria-label="The cat's opinion of you">
    <h2>My opinion of my human</h2>
    <p id="opinion-text" data-ts="${esc(s.memory.opinion?.ts ?? "")}">${s.memory.opinion ? esc(opinionBody(s.memory.opinion.quote)) : "This human hasn't given me reasons to opine yet. Which is, in fact, an opinion."}</p>
  </section>

  <section class="guarida" aria-label="The lair of gifts">
    <h2>The lair</h2>
    <div id="lair-list" data-top="${esc(living[0]?.id ?? "")}">
    ${living.length === 0 ? emptyAltar(s) : living.slice(0, 30).map((g, i) => giftCard(g, i)).join("\n")}
    </div>
  </section>

  <section class="stats" aria-label="The cat's figures">
    <div class="stats-head">
      <h2>The figures</h2>
      <span class="live" id="live"><span class="dot"></span><span class="live-label">connecting…</span></span>
    </div>
    <div class="grid">
      <div class="stat" data-stat="lives"><span class="n">${s.lives}</span><span class="l">lives</span></div>
      <div class="stat" data-stat="purrs"><span class="n">${s.memory.purrs}</span><span class="l">pets</span></div>
      <div class="stat" data-stat="churus"><span class="n">${s.memory.churus}</span><span class="l">churus</span></div>
      <div class="stat" data-stat="hunts"><span class="n">${s.memory.hunts}</span><span class="l">hunt rounds</span></div>
      <div class="stat" data-stat="gpu"><span class="n">${gpus}</span><span class="l">GPUs found</span></div>
      <div class="stat" data-stat="tofu"><span class="n">${tofu}</span><span class="l">fermented tofus</span></div>
      <div class="stat" data-stat="leaf"><span class="n">${leaves}</span><span class="l">tree leaves</span></div>
    </div>
  </section>

  <section class="chat" aria-label="Talk to the cat">
    <h2>Talk to the cat</h2>
    <div id="hilo" class="fila" aria-live="polite"></div>
    <form id="form" autocomplete="off">
      <label class="sr" for="msg">Your message</label>
      <textarea id="msg" rows="2" maxlength="1200" placeholder="Say something to it. It doesn't bite, but it doesn't forgive either." required></textarea>
      <div class="botonera">
        <button type="submit">Meow</button>
        <button type="button" id="churus" class="sec">Give churu</button>
        <button type="button" id="purr" class="sec">Pet</button>
      </div>
    </form>
  </section>

  <details class="how">
    <summary>How does this site work?</summary>
    <div class="how-body">
      <p>This page is a single HTML file with its CSS and JS inside, served by
      the standard library's <code>node:http</code>. No frameworks, no CDNs, no
      build, no cookies and no trackers: everything you see is generated by the
      same Node process that is the cat.</p>
      <p>The data comes from the cat's <strong>acta</strong> (<code>memory.json</code>),
      a small JSON file on the Sprite's persistent disk: gifts, pets, churus,
      lives and its opinion of you. The disk survives the Sprite's naps, so the
      cat wakes up remembering everything.</p>
      <p>What happens behind the scenes:</p>
      <ul>
        <li>Every <code>GATANAS_HUNT_INTERVAL_SEC</code> (15 min by default) the cat
        patrols its house: zombie processes, disk, services and logs. The diet
        decides the gift (GPU, tofu or leaf) with fixed rules; the LLM only
        narrates it.</li>
        <li>The chat travels through the <strong>Sprites connector gateway</strong> to
        OpenRouter (<code>:free</code> models with a paid fallback). The key never
        reaches the cat; the wallet watches the spend and makes it fast if it
        gets close to the cap.</li>
        <li>While the model thinks, you see <em>“Gatanás is thinking about what to
        meow back…”</em>. There is no streaming: the answer arrives whole, with
        the manners of a cat.</li>
        <li>The figures update <strong>live</strong> over a one-way SSE channel
        (<code>GET /api/live</code>): if someone feeds the cat while you watch,
        you see the counter jump. No polling, no websockets, no libraries.</li>
      </ul>
      <p>The JSON API, in case you want to talk to it without the page:</p>
      <ul>
        <li><code>GET /api/status</code> · <code>GET /api/gifts</code> · <code>GET /api/lives</code> · <code>GET /api/live</code> (SSE)</li>
        <li><code>POST /api/chat</code> <code>{"message":"..."}</code> ·
        <code>POST /api/purr</code> · <code>POST /api/churus</code> ·
        <code>POST /api/hunt</code> · <code>POST /api/revive</code></li>
      </ul>
      <p>The write routes have per-minute rate limits: a cat tolerates very
      little traffic. Everything dynamic is HTML-escaped, including what the
      model writes.</p>
    </div>
  </details>

  <footer>
    <p>Runs on <a href="https://fly.io/sprites">Fly.io Sprites</a> · talks through the Sprites connector gateway (OpenRouter) · keeps its acta on its own disk.</p>
    <p class="pico">${esc(s.name)} · lives: ${s.lives} · last hunt: ${s.memory.lastHuntAt ? esc(timeAgo(s.memory.lastHuntAt, s.now)) : "never"} · awake since ${s.lastWatchAt ? esc(timeAgo(s.lastWatchAt, s.now)) : "it was born"}</p>
  </footer>
</main>
<script>${JS}</script>
</body>
</html>`;
}

function giftCard(g: Gift, i: number): string {
  const stamp = g.kind === "gpu" ? "PRIZE" : g.kind === "tofu" ? "AGED" : "FREE";
  return `<article class="gift ${g.kind}" data-id="${esc(g.id)}" data-stamp="${stamp}" style="--d:${(i % 12) * 60}ms">
  <span class="emoji">${giftGlyph(g.kind)}</span>
  <div class="body">
    <h3>${esc(giftLabel(g.kind))}</h3>
    <p class="narration">${esc(g.narration)}</p>
    <p class="meta">hunted ${esc(g.preyTitle)} · ${esc(timeAgo(g.at, new Date().toISOString()))}</p>
    ${g.kind !== "leaf" ? `<p class="advice">Dissection: ${esc(g.advice)}</p>` : ""}
  </div>
</article>`;
}

function emptyAltar(s: AltarSnapshot): string {
  return `<p class="empty">The lair is empty. The cat is in its first night of hunting. Come back in a while, or call it on the chat to see if it finds something.</p>
<p class="empty small">Meanwhile: this Sprite has ${s.memory.watches} watches. Every watch is a meow. Nobody hears them, but there they stay.</p>`;
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
  if (!Number.isFinite(diff)) return "in a strange amount of time";
  if (diff < 60) return "seconds ago";
  const mins = Math.round(diff / 60);
  if (diff < 3600) return `${mins} min ago`;
  const hours = Math.round(diff / 3600);
  if (diff < 86400) return `${hours} h ago`;
  const days = Math.round(diff / 86400);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

const CAT_AWAKE = `<pre class="art"> /\\_/\\
( <span class="eye">o.o</span> )   Gatanás, awake
 &gt; ^ &lt;</pre>`;

const CAT_SLEEP = `<pre class="art"> /\\_/\\
( -.- )   zZz
 &gt; ^ &lt;</pre>`;

const CAT_TRANCE = `<pre class="art"> /\\_/\\
( x.x )   reviving
 &gt; ^ &lt;</pre>`;

const CAT_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐈‍⬛</text></svg>`;

const CSS = `
:root{--bg:#070605;--ink:#e8ded0;--dim:#a4958a;--line:#292119;--gpu:#c9a227;--tofu:#8fb59a;--leaf:#8a6b4a;--hot:#e06a3b}
*{box-sizing:border-box}
html{background:var(--bg);color:var(--ink);font:16px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
body{margin:0;min-height:100vh;background:radial-gradient(1100px 550px at 75% -10%,#17110b 0,transparent 60%),radial-gradient(900px 500px at -10% 110%,#0b130e 0,transparent 55%),var(--bg)}
::selection{background:var(--gpu);color:var(--bg)}
a{color:var(--tofu)}
main{max-width:860px;margin:0 auto;padding:56px 22px 72px}
/* CRT: scanlines fijas + banda de barrido que baja despacio */
body::before{content:"";position:fixed;inset:0;z-index:60;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.15) 0 1px,transparent 1px 3px)}
body::after{content:"";position:fixed;left:0;right:0;top:-30vh;height:26vh;z-index:61;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(201,162,39,.04) 45%,rgba(232,222,208,.07) 50%,rgba(201,162,39,.04) 55%,transparent);animation:sweep 11s linear infinite}
@keyframes sweep{to{top:110vh}}
h1{font-size:2.3rem;letter-spacing:-.02em;margin:.2em 0;animation:jitter 9s steps(1,end) infinite;text-shadow:2px 0 rgba(224,106,59,.25),-2px 0 rgba(143,181,154,.25)}
@keyframes jitter{0%,95.9%{transform:none}96%{transform:translateX(2px);text-shadow:-3px 0 rgba(224,106,59,.5),3px 0 rgba(143,181,154,.5)}97.5%{transform:translateX(-3px) skewX(2deg)}99%{transform:none}}
h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.26em;color:var(--dim);font-weight:600;margin:0 0 16px}
h2::before{content:"▚ ";color:var(--gpu)}
.catface{color:var(--dim);display:inline-block;cursor:pointer;border-radius:8px;padding:6px 10px;margin-left:-10px;transition:background .2s,transform .15s;transform-origin:50% 80%}
.catface:hover{background:rgba(201,162,39,.07)}
.catface:active{transform:scale(.96)}
.art{margin:0;font-size:.9rem;line-height:1.18;color:var(--dim)}
.eye{color:var(--gpu);text-shadow:0 0 9px rgba(201,162,39,.75)}
.tagline{color:var(--dim);max-width:62ch}
.status{font-size:.85rem;display:flex;align-items:center;gap:10px;color:var(--dim)}
.status.ok .dot{background:var(--tofu);box-shadow:0 0 12px var(--tofu)}
.status.bad .dot{background:var(--hot);box-shadow:0 0 12px var(--hot)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--dim);animation:pulse 2.4s infinite}
@keyframes pulse{50%{opacity:.3}}
.ticker{overflow:hidden;white-space:nowrap;border:1px solid var(--line);border-left:3px solid var(--gpu);border-radius:6px;padding:9px 0;margin-top:20px;color:var(--dim);font-size:.8rem;background:rgba(24,18,15,.55);min-height:2.4em}
.ticker span{display:inline-block;padding-left:100%;animation:marquee 30s linear infinite}
.ticker.hot span{color:var(--ink);animation-duration:16s}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-100%)}}
.opinion{border-left:3px solid var(--gpu);padding:6px 0 6px 20px;margin:46px 0;position:relative}
.opinion::before{content:"◆";position:absolute;left:-9px;top:-3px;color:var(--gpu);font-size:.8rem;background:var(--bg)}
.opinion p{font-size:1.08rem;font-style:italic;margin:0}
.guarida{margin:52px 0}
.gift{position:relative;display:grid;grid-template-columns:3rem 1fr;gap:14px;border:1px solid var(--line);border-radius:8px;padding:18px;margin-bottom:14px;background:linear-gradient(180deg,#110d0b,#0d0a09);animation:arrive .45s backwards;animation-delay:var(--d,0ms);transition:transform .18s,box-shadow .18s}
@keyframes arrive{from{opacity:0;transform:translateY(10px)}}
.gift:hover{transform:translateY(-2px)}
.gift.gpu:hover{box-shadow:0 8px 26px -10px rgba(201,162,39,.5)}
.gift.tofu:hover{box-shadow:0 8px 26px -10px rgba(143,181,154,.45)}
.gift.leaf:hover{box-shadow:0 8px 26px -10px rgba(138,107,74,.45)}
.gift::after{content:attr(data-stamp);position:absolute;top:12px;right:14px;font-size:.58rem;letter-spacing:.24em;border:1px solid currentColor;border-radius:4px;padding:2px 8px;transform:rotate(5deg);opacity:.55}
.gift.gpu{border-left:3px solid var(--gpu)}
.gift.tofu{border-left:3px solid var(--tofu)}
.gift.leaf{border-left:3px solid var(--leaf)}
.gift.gpu::after{color:var(--gpu)}
.gift.tofu::after{color:var(--tofu)}
.gift.leaf::after{color:var(--leaf)}
.gift .emoji{line-height:1;align-self:start}
.glyph{width:40px;height:40px;display:block}
.gift h3{margin:0 0 4px;font-size:1rem}
.narration{margin:0 0 8px}
.meta,.advice{font-size:.78rem;color:var(--dim);margin:2px 0}
.advice{border-top:1px dashed var(--line);padding-top:6px;margin-top:8px}
.empty{color:var(--dim);border:1px dashed var(--line);padding:20px;border-radius:8px}
.empty.small{font-size:.85rem}
.stats{margin:50px 0}
.stats-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.stats-head h2{margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px;margin-top:16px}
.stat{border:1px solid var(--line);border-radius:8px;padding:14px;background:linear-gradient(180deg,#110d0b,#0c0a09)}
.stat .n{display:block;font-size:1.6rem;color:var(--gpu);font-variant-numeric:tabular-nums}
.stat[data-stat="tofu"] .n{color:var(--tofu)}
.stat .l{display:block;font-size:.66rem;color:var(--dim);text-transform:uppercase;letter-spacing:.14em;margin-top:3px}
.stat .n.pop{animation:pop .55s}
@keyframes pop{30%{transform:scale(1.3);color:#fff;text-shadow:0 0 16px currentColor}}
.live{display:inline-flex;align-items:center;gap:8px;font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);border:1px solid var(--line);border-radius:999px;padding:4px 12px}
.live .dot{width:7px;height:7px}
.live.on{color:var(--tofu);border-color:rgba(143,181,154,.4)}
.live.on .dot{background:var(--tofu);box-shadow:0 0 10px var(--tofu)}
.live.off{color:var(--hot)}
.live.off .dot{background:var(--hot)}
.chat{margin:52px 0;border-top:1px solid var(--line);padding-top:36px}
.fila{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.turn{border:1px solid var(--line);border-radius:8px;padding:10px 14px;max-width:92%;animation:arrive .3s backwards}
.turn.user{align-self:flex-end;background:#191210;color:var(--dim)}
.turn.cat{align-self:flex-start;background:#0e1410}
.turn.cat:not(.pensando){border-left:3px solid var(--tofu)}
.pensando{color:var(--dim);font-style:italic;animation:pulse 1.4s infinite}
form{display:flex;flex-direction:column;gap:10px}
textarea{width:100%;background:#0f0c0b;border:1px solid var(--line);color:var(--ink);font:inherit;padding:12px;border-radius:8px;resize:vertical}
textarea:focus,.catface:focus-visible,button:focus-visible,.how summary:focus-visible{outline:2px solid var(--gpu);outline-offset:2px}
.botonera{display:flex;gap:10px;flex-wrap:wrap}
button{font:inherit;background:var(--gpu);color:var(--bg);border:0;border-radius:8px;padding:10px 18px;cursor:pointer;font-weight:600}
button.sec{background:transparent;color:var(--ink);border:1px solid var(--line)}
button:hover{filter:brightness(1.12)}
button[disabled]{opacity:.5;cursor:wait}
.how{margin:44px 0;border-top:1px solid var(--line);padding-top:18px;font-size:.85rem;color:var(--dim)}
.how summary{cursor:pointer;color:var(--ink);font-size:.9rem;font-weight:600}
.how-body p{margin:12px 0}
.how-body ul{margin:10px 0;padding-left:20px}
.how-body li{margin:4px 0}
.how code{background:#191310;padding:1px 5px;border-radius:4px}
footer{margin-top:56px;border-top:1px solid var(--line);padding-top:18px;font-size:.78rem;color:var(--dim)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (max-width:560px){h1{font-size:1.7rem}.gift{grid-template-columns:2.4rem 1fr;padding:14px}}
@media (prefers-reduced-motion:reduce){
  body::after,h1,.dot,.ticker span,.stat .n.pop,.turn,.gift{animation:none!important}
  .ticker{overflow-x:auto}
}
`;

const JS = `
const $=function(s){return document.querySelector(s)};
const hilo=$('#hilo');
const form=$('#form');
const msg=$('#msg');
const purr=$('#purr');
const churus=$('#churus');
const catface=$('.catface');
const ticker=$('#ticker');
let pensando=null;
function turn(who,text){
  const d=document.createElement('div');
  d.className='turn '+who;
  d.textContent=text;
  hilo.appendChild(d);
  d.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function pensar(){
  if(pensando)return;
  pensando=document.createElement('div');
  pensando.className='turn cat pensando';
  pensando.textContent='Gatanás is thinking about what to meow back…';
  hilo.appendChild(pensando);
  pensando.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function callar(){
  if(pensando){pensando.remove();pensando=null;}
}
async function post(url,body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  const j=await r.json().catch(()=>({reply:'prrrr (cable error)'}));
  return j;
}
// --- las cifras: cambian con un destello ---------------------------------
function bump(name,val){
  const box=document.querySelector('.stat[data-stat="'+name+'"] .n');
  if(!box||box.textContent===String(val))return;
  box.textContent=String(val);
  box.classList.remove('pop');
  void box.offsetWidth;
  box.classList.add('pop');
}
// --- el ticker de pensamientos -------------------------------------------
const thoughts=[
  'the fridge hums in B flat. suspicious.',
  'I counted the processes twice. one of them blinked.',
  'somewhere a log is growing. I know which one.',
  'the disk dreams of being 80% full. not on my watch.',
  'I saw your cursor move. hello.',
  'if nobody watches the Sprite, does it still purr?',
  "3 a.m. is my 9 a.m.",
  'I left a leaf on the altar. it means nothing. it means everything.',
  'the churus are never enough. this is not a complaint. or is it.',
  'pura vida. or whatever this is.'
];
let th=Math.floor(Math.random()*thoughts.length);
function fillTicker(text,hot){
  if(!ticker)return;
  ticker.classList.toggle('hot',!!hot);
  ticker.innerHTML='';
  const s=document.createElement('span');
  s.textContent=text;
  ticker.appendChild(s);
}
fillTicker(thoughts[th%thoughts.length]);
setInterval(function(){th++;fillTicker(thoughts[th%thoughts.length]);},31000);
// --- el canal vivo (SSE) --------------------------------------------------
const rev={top:'',op:''};
(function(){
  const l=document.getElementById('lair-list');
  const o=document.getElementById('opinion-text');
  if(l)rev.top=l.getAttribute('data-top')||'';
  if(o)rev.op=o.getAttribute('data-ts')||'';
})();
function setLive(on,label){
  const el=document.getElementById('live');
  if(!el)return;
  el.classList.toggle('on',on);
  el.classList.toggle('off',!on);
  const l=el.querySelector('.live-label');
  if(l)l.textContent=label;
}
async function refreshBody(){
  try{
    const r=await fetch('/',{headers:{'Accept':'text/html'}});
    if(!r.ok)return;
    const doc=new DOMParser().parseFromString(await r.text(),'text/html');
    const nl=doc.getElementById('lair-list');
    const no=doc.getElementById('opinion-text');
    const l=document.getElementById('lair-list');
    const o=document.getElementById('opinion-text');
    if(l&&nl){l.innerHTML=nl.innerHTML;rev.top=nl.getAttribute('data-top')||'';}
    if(o&&no){o.innerHTML=no.innerHTML;rev.op=no.getAttribute('data-ts')||'';}
  }catch{}
}
function apply(d){
  if(d.lives!==undefined)bump('lives',d.lives);
  if(d.purrs!==undefined)bump('purrs',d.purrs);
  if(d.churus!==undefined)bump('churus',d.churus);
  if(d.hunts!==undefined)bump('hunts',d.hunts);
  if(d.gpu!==undefined)bump('gpu',d.gpu);
  if(d.tofu!==undefined)bump('tofu',d.tofu);
  if(d.leaf!==undefined)bump('leaf',d.leaf);
  const changed=(d.top!==undefined&&d.top!==rev.top)||(d.op!==undefined&&d.op!==rev.op);
  if(changed)refreshBody();
  if(d.note)fillTicker(d.note,true);
}
if('EventSource' in window){
  const es=new EventSource('/api/live');
  es.onopen=function(){setLive(true,'live');};
  es.onerror=function(){setLive(false,'reconnecting…');};
  es.onmessage=function(ev){try{apply(JSON.parse(ev.data));}catch{}};
}else{
  setLive(false,'no SSE here');
}
// --- la charla ------------------------------------------------------------
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const text=msg.value.trim();
  if(!text)return;
  turn('user',text);
  msg.value='';
  form.querySelector('button[type=submit]').disabled=true;
  pensar();
  try{
    const j=await post('/api/chat',{message:text});
    callar();
    turn('cat',j.reply||'prrrr.');
  }catch{ callar(); turn("cat","I can't hear myself. Try again."); }
  finally{ form.querySelector('button[type=submit]').disabled=false; }
});
// --- mimos: el botón y el propio gato -------------------------------------
async function pet(){
  purr.disabled=true;
  try{
    const j=await post('/api/purr');
    turn('cat',j.reply||'Prrrr.');
    if(typeof j.purrs==='number')bump('purrs',j.purrs);
  }catch{ turn("cat","You petted the air. miau."); }
  finally{ purr.disabled=false; }
}
purr.addEventListener('click',pet);
if(catface){
  catface.addEventListener('click',pet);
  catface.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){e.preventDefault();pet();}
  });
}
churus.addEventListener('click',async()=>{
  churus.disabled=true;
  try{
    const j=await post('/api/churus');
    turn('cat',j.reply||'prrrr.');
    if(typeof j.churus==='number')bump('churus',j.churus);
  }catch{ turn("cat","The churu stayed in the air. miau."); }
  finally{ churus.disabled=false; }
});
`;
