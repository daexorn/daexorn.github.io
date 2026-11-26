import { mountCube } from './cube.mjs?v=06f25615ed';

const canvas = document.querySelector('.cube canvas');
if (canvas) mountCube(canvas);

// The red and green channels encode the horizontal and vertical displacement
// of a rounded lens. The centre stays neutral so text behind it stays legible.
const dock=document.querySelector('.site-header');
if (CSS.supports('backdrop-filter','url(#nav-lens)') && /Chrome|Chromium|Edg\//.test(navigator.userAgent)) {
  const map=document.querySelector('#lens-map');
  const paintLens=()=>{
    const width=dock.clientWidth, height=dock.clientHeight, radius=17, rim=8;
    if (!width || !height) return;
    const stamp=document.createElement('canvas');
    stamp.width=width;stamp.height=height;
    const ctx=stamp.getContext('2d');
    if (!ctx) return;
    const pixels=ctx.createImageData(width,height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const dx=x-Math.max(radius,Math.min(width-radius,x));
      const dy=y-Math.max(radius,Math.min(height-radius,y));
      const length=Math.hypot(dx,dy);
      const depth=radius-length;
      const bend=depth>=0 && depth<rim ? Math.sin(Math.PI*depth/rim) : 0;
      const i=4*(y*width+x);
      pixels.data[i]=128+112*bend*dx/(length||1);
      pixels.data[i+1]=128+112*bend*dy/(length||1);
      pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    map.setAttribute('href',stamp.toDataURL());
    dock.classList.add('has-lens');
  };
  new ResizeObserver(paintLens).observe(dock);
}

const sections = [...document.querySelectorAll('main > section')];
const indexLinks = [...document.querySelectorAll('.section-index a, .site-header nav a')];
const sectionIndex = document.querySelector('.section-index');
const main = document.querySelector('main');
const panels = sections.map(section=>section.querySelector('.scene-panel'));
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let currentIndex = -1, frame = 0;
let starts = [], overflow = [];
const clamp = value=>Math.max(0,Math.min(1,value));

function selectSection(index) {
  if (index===currentIndex) return;
  currentIndex=index;
  sectionIndex.style.setProperty('--selected',index);
  sections.forEach((section,i)=>{
    section.classList.toggle('is-current',i===index);
    panels[i].inert=!motionPreference.matches && i!==index;
  });
  for (const link of indexLinks) {
    const i=sections.findIndex(section=>link.hash==='#'+section.id);
    link.toggleAttribute('data-past',i<index);
    if (i===index) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
}

function paint() {
  frame=0;
  if (motionPreference.matches) {
    selectSection(Math.max(0,sections.findLastIndex(section=>section.getBoundingClientRect().top<=innerHeight*.5)));
    return;
  }
  const y=Math.max(0,scrollY);
  const index=Math.max(0,starts.findLastIndex(start=>start<=y));
  const local=y-starts[index];
  const travel=index+1<starts.length ? starts[index+1]-starts[index]-overflow[index] : 0;
  const raw=travel>0 ? clamp((local-overflow[index])/travel) : 0;
  const progress=raw*raw*(3-2*raw);
  selectSection(index+(progress>=.5 ? 1 : 0));
  panels.forEach((panel,i)=>{
    const outgoing=i===index, incoming=i===index+1 && progress>0;
    panel.classList.toggle('on-stage',outgoing || incoming);
    if (!outgoing && !incoming) return;
    const enter=incoming ? 1-progress : 0, exit=outgoing ? progress : 0;
    panel.style.setProperty('--enter',enter.toFixed(4));
    panel.style.setProperty('--exit',exit.toFixed(4));
    // The incoming background dissolves over the outgoing one. Foreground
    // layers have independent camera paths and a shorter text exposure.
    panel.style.setProperty('--exposure',incoming ? progress.toFixed(4) : '1');
    panel.style.setProperty('--type-ink',(incoming ? clamp((progress-.42)/.38) : clamp(1-progress/.42)).toFixed(4));
    panel.style.setProperty('--reading-offset',-(outgoing ? Math.min(local,overflow[i]) : 0)+'px');
  });
}
function requestPaint() {
  if (!frame) frame=requestAnimationFrame(paint);
}
function measure() {
  if (!motionPreference.matches) {
    const heights=panels.map(panel=>Math.ceil(panel.offsetHeight));
    overflow=heights.map(height=>Math.max(0,height-innerHeight));
    sections.forEach((section,i)=>section.style.setProperty('--track-height',heights[i]+'px'));
    starts=sections.map(section=>section.offsetTop);
  }
  paint();
}
function configureMotion() {
  main.classList.toggle('scene-film',!motionPreference.matches);
  currentIndex=-1;
  measure();
}
let scrollIdle;
window.addEventListener('scroll',()=>{
  if (!motionPreference.matches) {
    document.documentElement.classList.add('scene-travelling');
    clearTimeout(scrollIdle);
    scrollIdle=setTimeout(()=>document.documentElement.classList.remove('scene-travelling'),150);
  }
  requestPaint();
},{passive:true});
window.addEventListener('resize',measure);
const panelSize=new ResizeObserver(measure);
panels.forEach(panel=>panelSize.observe(panel));
motionPreference.addEventListener('change',configureMotion);
configureMotion();

// Menu travel uses the same scroll-driven pictures as a manual gesture.
let menuFrame = 0;
function cancelMenuTravel() {
  cancelAnimationFrame(menuFrame);
  menuFrame=0;
}
sectionIndex.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.button!==0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey) return;
  const target=document.getElementById(link.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  cancelMenuTravel();
  const start=scrollY;
  const end=Math.min(start+target.getBoundingClientRect().top,document.documentElement.scrollHeight-innerHeight);
  if (location.hash!==link.hash) history.pushState(null,'',link.hash);
  if (motionPreference.matches) {
    window.scrollTo({top:end,behavior:'instant'});
    return;
  }
  const distance=end-start;
  if (Math.abs(distance)<1) return;
  const duration=Math.min(2400,720+480*Math.abs(distance)/innerHeight);
  const startTime=performance.now();
  function advance(now) {
    const t=clamp((now-startTime)/duration);
    // Cosine easing starts and ends at zero velocity, even for a long jump.
    const fraction=(1-Math.cos(Math.PI*t))/2;
    window.scrollTo({top:start+distance*fraction,behavior:'instant'});
    menuFrame=t<1 ? requestAnimationFrame(advance) : 0;
  }
  menuFrame=requestAnimationFrame(advance);
});
for (const type of ['wheel','touchstart','pointerdown','keydown','popstate','hashchange','resize']) {
  window.addEventListener(type,cancelMenuTravel,{passive:true});
}
motionPreference.addEventListener('change',cancelMenuTravel);

import('./assets/moments/moments.js').then(async ({ready})=>{
  await ready;
  document.querySelectorAll('#about .mo-w').forEach((word,index)=>word.style.setProperty('--word-order',index));
});

const sampleToggle = document.querySelector('#sample-toggle');
const slowReply = document.querySelector('.samples .slow');
sampleToggle.hidden = false;
sampleToggle.addEventListener('click', () => {
  const includeSlow = slowReply.hidden;
  slowReply.hidden = !includeSlow;
  sampleToggle.setAttribute('aria-pressed', String(includeSlow));
  const times = [...document.querySelectorAll('.samples li:not([hidden])')].map(item => Number(item.textContent));
  const middle = (times.length - 1) / 2;
  const mean = times.reduce((total, time) => total + time, 0) / times.length;
  const median = (times[Math.floor(middle)] + times[Math.ceil(middle)]) / 2;
  document.querySelector('#mean').textContent = mean + ' s';
  document.querySelector('#median').textContent = median + ' s';
});

const quarterTurn = document.querySelector('#quarter-turn');
const diagram = document.querySelector('.turn-diagram');
const corners = ['top left', 'top right', 'bottom right', 'bottom left'];
let turns = 0;
quarterTurn.hidden = false;
quarterTurn.addEventListener('click', () => {
  turns++;
  diagram.style.transform = 'rotate(' + (turns * 90) + 'deg)';
  diagram.setAttribute('aria-label', 'Marked tile in the ' + corners[turns % 4] + ' corner');
  document.querySelector('#degrees').textContent = (turns % 4 * 90) + '°';
});
