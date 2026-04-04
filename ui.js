// ===== UI ENHANCEMENTS & ANIMATIONS =====

const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('animate-in');observer.unobserve(entry.target);}});},{threshold:0.1});
document.querySelectorAll('.concept-card, .chart-card, .insight-card, .comparison-panel').forEach(el=>{el.style.opacity='0';observer.observe(el);});

(function initHeroViz(){
  const viz=document.getElementById('heroViz');
  if(!viz)return;
  const threadCount=6,taskCount=8,threads=[],tasks=[];
  for(let i=0;i<threadCount;i++){const div=document.createElement('div');div.style.cssText="position:absolute; width:44px; height:44px; border-radius:50%; border:2px solid #06b6d4; background:rgba(6,182,212,0.1); display:flex; align-items:center; justify-content:center; font-size:10px; font-family:'JetBrains Mono',monospace; color:#06b6d4; box-shadow:0 0 16px rgba(6,182,212,0.3); transition:all 0.5s;";div.textContent='T'+i;viz.appendChild(div);threads.push(div);} 
  for(let i=0;i<taskCount;i++){const div=document.createElement('div');div.style.cssText="position:absolute; width:34px; height:34px; border-radius:8px; border:1px solid #8b5cf6; background:rgba(139,92,246,0.1); display:flex; align-items:center; justify-content:center; font-size:9px; font-family:'JetBrains Mono',monospace; color:#8b5cf6;";div.textContent='J'+i;viz.appendChild(div);tasks.push(div);} 
  function placeElements(){const w=viz.offsetWidth||300,h=viz.offsetHeight||500;threads.forEach((thread,i)=>{thread.style.left=(w*0.2+Math.sin(i*1.1)*w*0.15)+'px';thread.style.top=(h*0.1+(i/threadCount)*h*0.8)+'px';});tasks.forEach((task,i)=>{task.style.left=(w*0.55+Math.cos(i*0.9)*w*0.2)+'px';task.style.top=(h*0.05+(i/taskCount)*h*0.9)+'px';});}
  placeElements();window.addEventListener('resize',placeElements);
  let angle=0;setInterval(()=>{angle+=0.015;const w=viz.offsetWidth||300,h=viz.offsetHeight||500;threads.forEach((thread,i)=>{const ox=Math.sin(angle+i*1.1)*w*0.12;const oy=Math.cos(angle*0.7+i*0.8)*h*0.06;thread.style.transform='translate('+ox+'px, '+oy+'px)';});tasks.forEach((task,i)=>{const ox=Math.cos(angle*1.2+i*0.9)*w*0.08;const oy=Math.sin(angle*0.9+i*1.1)*h*0.05;task.style.transform='translate('+ox+'px, '+oy+'px)';});},50);
})();

function animateCounter(el,target,duration=1500){if(!el)return;let startTime=null;function step(ts){if(!startTime)startTime=ts;const progress=Math.min((ts-startTime)/duration,1);el.textContent=Math.round(progress*target);if(progress<1)requestAnimationFrame(step);}requestAnimationFrame(step);}

document.querySelectorAll('[data-tooltip]').forEach(el=>{const tip=document.createElement('div');tip.className='tooltip';tip.textContent=el.dataset.tooltip;tip.style.cssText='position:absolute; background:#1a2440; border:1px solid rgba(6,182,212,0.3); color:#e2e8f0; padding:6px 10px; border-radius:6px; font-size:0.75rem; pointer-events:none; opacity:0; transition:.2s; z-index:100; white-space:nowrap; transform:translateY(-8px);';el.style.position='relative';el.appendChild(tip);el.addEventListener('mouseenter',()=>{tip.style.opacity='1';tip.style.transform='translateY(-4px)';});el.addEventListener('mouseleave',()=>{tip.style.opacity='0';tip.style.transform='translateY(-8px)';});});

document.addEventListener('keydown',event=>{const tag=event.target.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;if(event.code==='Space'||event.key===' '||event.key==='s'||event.key==='S'){event.preventDefault();if(!state.running)startSimulation();else pauseSimulation();}if(event.key==='r'||event.key==='R')resetSimulation();if(event.key==='t'||event.key==='T')addManualTask();if(event.key==='a'||event.key==='A')animateArchitecture();if(event.key==='l'||event.key==='L')animateLifecycle();});

setInterval(()=>{if(!state.running)return;state.threads.forEach(thread=>{const node=document.getElementById('worker-'+thread.id);if(node&&thread.status==='busy'){node.style.boxShadow='0 0 '+(15+Math.random()*15)+'px rgba(6,182,212,'+(0.2+Math.random()*0.2)+')';}else if(node){node.style.boxShadow='';}});},300);

function showToast(msg,type='info'){const toast=document.createElement('div');toast.style.cssText='position:fixed; bottom:24px; right:24px; padding:12px 20px; background:var(--bg-800); border:1px solid '+(type==='success'?'#10b981':type==='error'?'#ef4444':'#06b6d4')+'; border-radius:8px; color:'+(type==='success'?'#10b981':type==='error'?'#ef4444':'#06b6d4')+'; font-size:0.85rem; z-index:2000; animation:slideUp 0.3s ease-out; box-shadow:0 8px 32px rgba(0,0,0,0.5); font-family:Inter,sans-serif;';toast.textContent=msg;document.body.appendChild(toast);setTimeout(()=>{toast.style.opacity='0';toast.style.transition='0.3s';setTimeout(()=>toast.remove(),300);},3000);}
setTimeout(()=>{showToast('Press Space to start or pause, T to add a task, and R to reset.','info');},2500);

window.addEventListener('resize',()=>{const canvas=document.getElementById('archCanvas');if(!canvas)return;const maxWidth=canvas.parentElement.clientWidth-80;if(maxWidth<900){canvas.width=maxWidth;canvas.height=Math.round(maxWidth*0.44);}else{canvas.width=900;canvas.height=400;}drawArchitectureStatic?.();});

const heroObs=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){animateCounter(document.getElementById('heroThreadCount'),8,2000);animateCounter(document.getElementById('heroTasksDone'),1247,2000);heroObs.unobserve(entry.target);}});},{threshold:0.5});
const hero=document.getElementById('hero');if(hero)heroObs.observe(hero);

document.querySelectorAll('.code-tab').forEach(tab=>{tab.addEventListener('click',()=>{if(typeof Prism!=='undefined'&&typeof Prism.highlightAll==='function'){setTimeout(()=>Prism.highlightAll(),50);}});});
