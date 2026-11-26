import { mountCube } from './cube.mjs?v=e0ccfcd385';

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

const navLinks=[...dock.querySelectorAll('nav a')];
const sections=navLinks.map(link=>document.querySelector(link.hash));
const updateNav=()=>{
  const current=sections.find(section=>{
    const rect=section.getBoundingClientRect();
    return rect.top<innerHeight*.5 && rect.bottom>innerHeight*.5;
  });
  for (const link of navLinks) {
    if (current && link.hash==='#'+current.id) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
};
let navFrame=0;
function queueNavUpdate(){
  if (!navFrame) navFrame=requestAnimationFrame(()=>{navFrame=0;updateNav();});
}
window.addEventListener('scroll',queueNavUpdate,{passive:true});
window.addEventListener('resize',queueNavUpdate);
updateNav();

// Everything stays readable without script and when a visitor follows an anchor.
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const arrival = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('section-arrives');
      arrival.unobserve(entry.target);
    }
  }, {threshold: 0.08});
  document.querySelectorAll('main > section:not(.hero) > .wrap').forEach(el => arrival.observe(el));
}

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
