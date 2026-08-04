/* ============================================================
   Lantern — app.js
   ============================================================ */

/* ---------- Navigation ---------- */
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const topbarTitle = document.getElementById('topbar-title');
const topbarSubtitle = document.getElementById('topbar-subtitle');

const VIEW_META = {
  'view-ml': {
    title: 'Guest Sentiment &amp; Score',
    subtitle: 'Run a review through the recommendation model to score fit and sentiment.'
  },
  'view-dashboard': {
    title: 'Performance Dashboard',
    subtitle: 'Portfolio KPIs and the Tableau workbook feed for guest experience reporting.'
  },
  'view-chat': {
    title: 'Concierge Assistant',
    subtitle: 'A guest-facing assistant that turns preferences into a property recommendation.'
  }
};

navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    navItems.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    views.forEach(v => v.classList.toggle('is-active', v.id === target));
    const meta = VIEW_META[target];
    if (meta) {
      topbarTitle.innerHTML = meta.title;
      topbarSubtitle.textContent = meta.subtitle;
    }
    if (target === 'view-dashboard' && !window.__chartsDrawn) {
      drawAllCharts();
      window.__chartsDrawn = true;
    }
  });
});

/* ---------- Clock ---------- */
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('date-label');
function tickClock(){
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString('en-GB', { hour12:false });
  dateEl.textContent = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}
tickClock();
setInterval(tickClock, 1000);

/* ============================================================
   VIEW 1 — Sentiment / recommendation scoring engine
   (lexicon + aspect based, runs entirely client-side)
   ============================================================ */

const LEXICON = {
  positive: {
    'spotless':2.5,'clean':1.5,'immaculate':2.5,'friendly':2,'warm':1.5,'helpful':2,
    'attentive':2,'comfortable':1.5,'beautiful':2,'stunning':2.5,'amazing':2.5,
    'excellent':2.5,'great':1.8,'wonderful':2.2,'lovely':1.8,'delicious':1.8,
    'convenient':1.5,'spacious':1.5,'quiet':1,'responsive':1.8,'welcoming':2,
    'perfect':2.5,'worth':1.2,'recommend':2,'best':2,'love':2,'loved':2,'exceeded':2.2,
    'remembered':1.5,'quick':1,'smooth':1.2,'gorgeous':2,'impeccable':2.5,'relaxing':1.6
  },
  negative: {
    'dirty':-2.5,'rude':-2.5,'slow':-1.5,'outdated':-1.5,'dated':-1.3,'noisy':-1.8,
    'small':-1,'cramped':-1.6,'broken':-2,'moldy':-2.8,'stained':-2.2,'uncomfortable':-1.8,
    'overpriced':-1.8,'disappointing':-2.2,'awful':-2.6,'terrible':-2.8,'worst':-2.6,
    'poor':-1.8,'cold':-1,'delayed':-1.5,'unhelpful':-2.2,'ignored':-2,'smelled':-2,
    'crowded':-1.2,'expensive':-1,'long':-0.8,'understaffed':-1.8,'stale':-1.6,'worn':-1.4
  },
  negators: ['not','no','never','without',"didn't",'wasn\'t','isn\'t','hardly',"couldn't"]
};

const ASPECTS = {
  Cleanliness: ['clean','spotless','dirty','dust','stained','immaculate','hygien','moldy'],
  Staff:       ['staff','front desk','receptionist','concierge','service','helpful','rude','welcoming'],
  Location:    ['location','harbor','view','walk','downtown','center','neighborhood','nearby'],
  Value:       ['price','worth','value','expensive','overpriced','cost','affordable'],
  Amenities:   ['pool','gym','breakfast','wifi','spa','parking','equipment','room service']
};

const SAMPLE_REVIEWS = [
  "The room was spotless and the view over the harbor was worth every penny. Staff at the front desk were warm and remembered our name by day two. Only downside was the breakfast queue, which ran long on weekdays, and the gym equipment felt a little dated. Would still book again for the location alone.",
  "Honestly disappointing. Check-in took forty minutes, the room smelled musty, and when we asked for extra towels the staff seemed to ignore us. The location downtown was convenient at least, and the bed itself was comfortable.",
  "Excellent stay from start to finish. The concierge was incredibly attentive and helped us plan our whole trip. Rooms were spacious, breakfast was delicious, and the pool area felt relaxing even when busy. A little expensive but worth it.",
  "Average experience. The room was clean but small and a bit noisy from the street. Front desk staff were friendly enough. Wifi kept dropping which was frustrating for a business trip. Would consider returning if the price came down."
];
let sampleIndex = 0;

function tokenize(text){
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g,' ').split(/\s+/).filter(Boolean);
}

function scoreSentiment(text){
  const words = tokenize(text);
  let pos = 0, neg = 0, neu = 0;
  const foundPositive = [], foundNegative = [];

  words.forEach((w, i) => {
    const prevWord = words[i-1] || '';
    const negated = LEXICON.negators.includes(prevWord);
    if (LEXICON.positive[w] !== undefined) {
      if (negated) { neg += Math.abs(LEXICON.positive[w]); foundNegative.push(w); }
      else { pos += LEXICON.positive[w]; foundPositive.push(w); }
    } else if (LEXICON.negative[w] !== undefined) {
      if (negated) { pos += Math.abs(LEXICON.negative[w]); foundPositive.push(w); }
      else { neg += Math.abs(LEXICON.negative[w]); foundNegative.push(w); }
    } else {
      neu += 0.12;
    }
  });

  const total = pos + neg + neu || 1;
  let posPct = Math.round((pos/total)*100);
  let negPct = Math.round((neg/total)*100);
  let neuPct = 100 - posPct - negPct;
  if (neuPct < 0){ neuPct = 0; }

  // recommendation score: baseline 50, shift by net sentiment, clamp 0-100
  const net = pos - neg;
  let score = Math.round(58 + net * 3.1);
  score = Math.max(4, Math.min(98, score));

  return { posPct, negPct, neuPct, score, foundPositive: [...new Set(foundPositive)], foundNegative: [...new Set(foundNegative)] };
}

function scoreAspects(text){
  const lower = text.toLowerCase();
  const result = {};
  Object.entries(ASPECTS).forEach(([aspect, keywords]) => {
    let hit = false;
    let localScore = 65; // neutral-ish baseline
    keywords.forEach(kw => {
      if (lower.includes(kw)) {
        hit = true;
        // check nearby sentiment words in the same sentence
        const sentences = lower.split(/[.!?]/);
        sentences.forEach(s => {
          if (s.includes(kw)) {
            Object.entries(LEXICON.positive).forEach(([pw, val]) => { if (s.includes(pw)) localScore += val*4; });
            Object.entries(LEXICON.negative).forEach(([nw, val]) => { if (s.includes(nw)) localScore += val*4; });
          }
        });
      }
    });
    result[aspect] = hit ? Math.max(8, Math.min(98, Math.round(localScore))) : null;
  });
  return result;
}

/* ---------- DOM wiring for view 1 ---------- */
const reviewInput = document.getElementById('review-input');
const btnScore = document.getElementById('btn-score');
const btnSample = document.getElementById('btn-sample');

const gaugeFill = document.getElementById('gauge-fill');
const gaugeNeedle = document.getElementById('gauge-needle');
const gaugeValue = document.getElementById('gauge-value');
const scoreBadge = document.getElementById('score-badge');
const sentimentBadge = document.getElementById('sentiment-badge');
const aspectList = document.getElementById('aspect-list');
const chipRow = document.getElementById('chip-row');
const modelNote = document.getElementById('model-note');

const GAUGE_ARC_LENGTH = 298; // matches stroke-dasharray

function renderResults(text){
  const s = scoreSentiment(text);
  const aspects = scoreAspects(text);

  // gauge
  const offset = GAUGE_ARC_LENGTH - (GAUGE_ARC_LENGTH * s.score / 100);
  gaugeFill.style.strokeDashoffset = offset;
  gaugeFill.style.stroke = s.score >= 70 ? 'var(--pos)' : s.score >= 45 ? 'var(--gold)' : 'var(--neg)';
  const angle = -90 + (s.score/100)*180;
  gaugeNeedle.style.transform = `rotate(${angle}deg)`;
  gaugeValue.textContent = s.score;
  scoreBadge.textContent = s.score >= 70 ? 'Strong recommend' : s.score >= 45 ? 'Mixed signal' : 'At risk';

  // sentiment bars
  document.getElementById('bar-positive').style.width = s.posPct + '%';
  document.getElementById('bar-neutral').style.width = s.neuPct + '%';
  document.getElementById('bar-negative').style.width = s.negPct + '%';
  document.getElementById('pct-positive').textContent = s.posPct + '%';
  document.getElementById('pct-neutral').textContent = s.neuPct + '%';
  document.getElementById('pct-negative').textContent = s.negPct + '%';

  sentimentBadge.textContent = s.posPct > s.negPct + 15 ? 'Net positive'
    : s.negPct > s.posPct + 15 ? 'Net negative' : 'Balanced';

  // aspects
  aspectList.innerHTML = '';
  Object.entries(aspects).forEach(([name, val]) => {
    const row = document.createElement('div');
    row.className = 'aspect-row';
    if (val === null) {
      row.innerHTML = `<span class="aspect-name">${name}</span>
        <div class="aspect-track"><div class="aspect-fill" style="width:0%; background: var(--border);"></div></div>
        <span class="aspect-score" style="color:var(--text-low);">&mdash;</span>`;
    } else {
      row.innerHTML = `<span class="aspect-name">${name}</span>
        <div class="aspect-track"><div class="aspect-fill" style="width:${val}%;"></div></div>
        <span class="aspect-score">${val}</span>`;
    }
    aspectList.appendChild(row);
  });

  // chips
  chipRow.innerHTML = '';
  if (!s.foundPositive.length && !s.foundNegative.length) {
    chipRow.innerHTML = '<span class="chip chip-muted">No strong sentiment phrases detected</span>';
  } else {
    s.foundPositive.slice(0,6).forEach(w => {
      const c = document.createElement('span');
      c.className = 'chip chip-positive';
      c.textContent = '+ ' + w;
      chipRow.appendChild(c);
    });
    s.foundNegative.slice(0,6).forEach(w => {
      const c = document.createElement('span');
      c.className = 'chip chip-negative';
      c.textContent = '– ' + w;
      chipRow.appendChild(c);
    });
  }

  modelNote.textContent = `Detected ${s.foundPositive.length} positive and ${s.foundNegative.length} negative signal terms across ${Object.values(aspects).filter(v=>v!==null).length} of ${Object.keys(aspects).length} tracked aspects. Recommendation score blends aspect coverage with overall polarity.`;
}

btnScore.addEventListener('click', () => {
  const text = reviewInput.value.trim();
  if (!text) return;
  btnScore.disabled = true;
  const original = btnScore.innerHTML;
  btnScore.innerHTML = 'Scoring…';
  setTimeout(() => {
    renderResults(text);
    btnScore.innerHTML = original;
    btnScore.disabled = false;
  }, 450);
});

btnSample.addEventListener('click', () => {
  sampleIndex = (sampleIndex + 1) % SAMPLE_REVIEWS.length;
  reviewInput.value = SAMPLE_REVIEWS[sampleIndex];
});

// run once on load with the default review
window.addEventListener('DOMContentLoaded', () => renderResults(reviewInput.value));

/* ============================================================
   VIEW 2 — Tableau embed + mock analytics canvases
   ============================================================ */
document.getElementById('btn-embed').addEventListener('click', () => {
  const url = document.getElementById('tableau-url').value.trim();
  const frame = document.getElementById('tableau-frame');
  if (!url) return;
  frame.innerHTML = `
    <div style="width:100%;">
      <tableau-viz src="${url.replace(/"/g,'&quot;')}" toolbar="bottom" hide-tabs style="width:100%; height:520px; display:block;"></tableau-viz>
    </div>`;
  // load Tableau's embedding API on demand
  if (!document.getElementById('tableau-api-script')) {
    const s = document.createElement('script');
    s.id = 'tableau-api-script';
    s.type = 'module';
    s.src = 'https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    document.body.appendChild(s);
  }
});

function drawAllCharts(){
  drawLineChart();
  drawDonutChart();
  drawBarChart();
}

function setupCanvas(canvas){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = canvas.height ? canvas.height : 220;
  const cssHeight = parseInt(canvas.getAttribute('height')) || 220;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: cssHeight };
}

function drawLineChart(){
  const canvas = document.getElementById('chart-line');
  const { ctx, w, h } = setupCanvas(canvas);
  const occ = [68,71,70,74,73,77,79,76,78,81,80,82];
  const score = [74,75,77,76,78,80,79,81,83,82,84,86];
  const pad = { l: 30, r: 10, t: 14, b: 22 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const max = 100, min = 55;

  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i=0;i<=4;i++){
    const y = pad.t + plotH*i/4;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
  }

  function plot(data, color, fillColor){
    ctx.beginPath();
    data.forEach((v,i)=>{
      const x = pad.l + plotW * i/(data.length-1);
      const y = pad.t + plotH * (1 - (v-min)/(max-min));
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin='round'; ctx.stroke();

    if (fillColor){
      ctx.lineTo(pad.l+plotW, pad.t+plotH);
      ctx.lineTo(pad.l, pad.t+plotH);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }
  plot(occ, '#3FBFB0', 'rgba(63,191,176,0.08)');
  plot(score, '#CBA45A', null);

  // legend
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#3FBFB0'; ctx.fillRect(pad.l, 2, 8, 8);
  ctx.fillStyle = '#B7C4D6'; ctx.fillText('Occupancy %', pad.l+12, 10);
  ctx.fillStyle = '#CBA45A'; ctx.fillRect(pad.l+110, 2, 8, 8);
  ctx.fillStyle = '#B7C4D6'; ctx.fillText('Rec. Score', pad.l+122, 10);
}

function drawDonutChart(){
  const canvas = document.getElementById('chart-donut');
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const data = [ {label:'Positive', val:64, color:'#59C48A'}, {label:'Neutral', val:24, color:'#8CA0B8'}, {label:'Negative', val:12, color:'#E27A82'} ];
  const cx = w/2 - 55, cy = h/2, r = Math.min(h,150)/2 - 6, rInner = r*0.62;
  let start = -Math.PI/2;
  data.forEach(d => {
    const angle = (d.val/100)*Math.PI*2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start+angle);
    ctx.arc(cx, cy, rInner, start+angle, start, true);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    start += angle;
  });
  ctx.fillStyle = '#EAF0F7';
  ctx.font = '600 20px Fraunces, serif';
  ctx.textAlign = 'center';
  ctx.fillText('64%', cx, cy+4);
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = '#7C8CA3';
  ctx.fillText('positive', cx, cy+18);
  ctx.textAlign = 'left';

  let ly = cy - r + 6;
  data.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.fillRect(cx + r + 24, ly, 8, 8);
    ctx.fillStyle = '#B7C4D6';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`${d.label} — ${d.val}%`, cx + r + 38, ly+8);
    ly += 22;
  });
}

function drawBarChart(){
  const canvas = document.getElementById('chart-bar');
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const data = [
    {label:'Harborview Grand', val:88},
    {label:'Aster Business Suites', val:79},
    {label:'The Wicklow', val:83},
    {label:'Meridian Bay Resort', val:91},
    {label:'Northgate Inn', val:64},
  ];
  const pad = { l: 10, r: 10, t: 10, b: 34 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const barW = plotW / data.length * 0.5;
  const gap = plotW / data.length;

  data.forEach((d,i) => {
    const x = pad.l + gap*i + (gap-barW)/2;
    const barH = plotH * (d.val/100);
    const y = pad.t + plotH - barH;
    const grad = ctx.createLinearGradient(0,y,0,y+barH);
    grad.addColorStop(0, '#D8B26A');
    grad.addColorStop(1, '#8a6d2e');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,barW,barH,[5,5,0,0]) : ctx.rect(x,y,barW,barH);
    ctx.fill();

    ctx.fillStyle = '#EAF0F7';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.val, x+barW/2, y-6);

    ctx.fillStyle = '#7C8CA3';
    ctx.font = '10px Inter, sans-serif';
    wrapText(ctx, d.label, x+barW/2, pad.t+plotH+14, gap+6);
  });
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, cx, y, maxWidth){
  const words = text.split(' ');
  let lines = [], line = '';
  words.forEach(word => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = word; }
    else line = test;
  });
  lines.push(line);
  ctx.textAlign = 'center';
  lines.forEach((l,i) => ctx.fillText(l, cx, y + i*11));
}

window.addEventListener('resize', () => { if (window.__chartsDrawn) drawAllCharts(); });

/* ============================================================
   VIEW 3 — Concierge chatbot (rule-based)
   ============================================================ */
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const suggestionChips = document.querySelectorAll('.suggestion-chip');

const PROPERTIES = [
  { name:'Harborview Grand, Gdansk', tags:['business','city','harbor','view','solo','quiet'], price:'$$$', blurb:'Waterfront property favoured by business travellers, five minutes from the convention centre.' },
  { name:'Aster Business Suites, Warsaw', tags:['business','warsaw','city','solo','budget'], price:'$$', blurb:'Efficient suites with fast wifi and a 24-hour desk — built for short work trips.' },
  { name:'The Wicklow, Dublin', tags:['romantic','couple','quiet','boutique'], price:'$$$', blurb:'A small boutique hotel known for its fireplace lounge and attentive, low-key service.' },
  { name:'Meridian Bay Resort, Split', tags:['family','pool','beach','resort'], price:'$$', blurb:'Beachfront resort with a large family pool, kids club, and half-board dining.' },
  { name:'Northgate Inn, Krakow', tags:['budget','couple','city'], price:'$', blurb:'No-frills, well-located, and consistently rated highest for cleanliness in its price band.' }
];

function addMessage(text, from){
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ' + from;
  const avatar = from === 'bot'
    ? '<div class="chat-avatar bot-avatar">L</div>'
    : '<div class="chat-avatar user-avatar">You</div>';
  wrap.innerHTML = `${avatar}<div class="chat-bubble">${text}</div>`;
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return wrap;
}

function showTyping(){
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg bot';
  wrap.innerHTML = `<div class="chat-avatar bot-avatar">L</div><div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>`;
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return wrap;
}

function matchProperties(message){
  const m = message.toLowerCase();
  const budget = /budget|cheap|affordable|inexpensive/.test(m);
  const scored = PROPERTIES.map(p => {
    let score = 0;
    p.tags.forEach(tag => { if (m.includes(tag)) score += 2; });
    if (budget && p.price === '$') score += 3;
    if (/family|kids|children/.test(m) && p.tags.includes('family')) score += 3;
    if (/romantic|couple|honeymoon|anniversary/.test(m) && (p.tags.includes('romantic')||p.tags.includes('couple'))) score += 3;
    if (/business|work trip|conference/.test(m) && p.tags.includes('business')) score += 3;
    if (/beach|pool|resort/.test(m) && p.tags.includes('resort')) score += 3;
    if (/warsaw/.test(m) && p.name.toLowerCase().includes('warsaw')) score += 4;
    if (/dublin/.test(m) && p.name.toLowerCase().includes('dublin')) score += 4;
    if (/gdansk|gdańsk/.test(m) && p.name.toLowerCase().includes('gdansk')) score += 4;
    if (/split|croatia/.test(m) && p.name.toLowerCase().includes('split')) score += 4;
    if (/krakow|kraków/.test(m) && p.name.toLowerCase().includes('krakow')) score += 4;
    return { p, score };
  }).sort((a,b) => b.score - a.score);
  return scored.filter(s => s.score > 0).slice(0,2).map(s => s.p);
}

function botReply(message){
  const matches = matchProperties(message);
  if (!matches.length) {
    return "I couldn't quite match that to a property — could you tell me the city, your budget, or the kind of trip (business, family, romantic)? For example: <em>'business trip in Warsaw'</em>.";
  }
  const lines = matches.map(p => `<strong>${p.name}</strong> <span style="color:var(--text-low);">(${p.price})</span><br><span style="color:var(--text-mid); font-size:12.5px;">${p.blurb}</span>`);
  return `Based on that, here's what I'd suggest:<br><br>${lines.join('<br><br>')}`;
}

function handleUserMessage(text){
  if (!text.trim()) return;
  addMessage(escapeHtml(text), 'user');
  chatInput.value = '';
  const typingEl = showTyping();
  setTimeout(() => {
    typingEl.remove();
    addMessage(botReply(text), 'bot');
  }, 600 + Math.random()*400);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleUserMessage(chatInput.value);
});

suggestionChips.forEach(chip => {
  chip.addEventListener('click', () => handleUserMessage(chip.textContent));
});
