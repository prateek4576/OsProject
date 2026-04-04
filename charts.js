// ===== REAL-TIME CHARTS (Chart.js) =====

const chartDefaults={color:'#94a3b8',borderColor:'rgba(255,255,255,0.05)',gridColor:'rgba(255,255,255,0.05)',fontFamily:'Inter, sans-serif'};
const MAX_POINTS=60;
let charts={};
let chartData={labels:[],threads:[],completion:[],failed:[],cpu:[],queue:[],execTime:[],idle:[]};
let prevCompleted=0,prevFailed=0;

function chartsAvailable(){return typeof Chart!=='undefined';}
function makeLabel(){return new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function baseOptions(extra={}){return{responsive:true,maintainAspectRatio:true,animation:{duration:200},plugins:{legend:{display:false,labels:{color:'#94a3b8',font:{family:'Inter'}}}},scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#64748b',font:{size:10,family:'Inter'},maxTicksLimit:8}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#64748b',font:{size:10,family:'Inter'}},beginAtZero:true}},...extra};}
function renderChartFallback(id,message){const canvas=document.getElementById(id);if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0f1629';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#94a3b8';ctx.font='14px Inter';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(message,canvas.width/2,canvas.height/2);}

function initCharts(){
  if(!chartsAvailable()){['threadsChart','completionChart','cpuChart','queueChart','ratioChart','execTimeChart','comparisonChart'].forEach(id=>renderChartFallback(id,'Charts require Chart.js to load.'));return;}
  Chart.defaults.color=chartDefaults.color;Chart.defaults.font.family=chartDefaults.fontFamily;
  charts.threads=new Chart(document.getElementById('threadsChart'),{type:'line',data:{labels:chartData.labels,datasets:[{label:'Busy Threads',data:chartData.threads,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,0.1)',fill:true,tension:0.4,pointRadius:0,borderWidth:2},{label:'Idle Threads',data:chartData.idle,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.05)',fill:true,tension:0.4,pointRadius:0,borderWidth:2}]},options:{...baseOptions(),plugins:{legend:{display:true,labels:{color:'#94a3b8',font:{family:'Inter',size:11}}}}}});
  charts.completion=new Chart(document.getElementById('completionChart'),{type:'bar',data:{labels:chartData.labels,datasets:[{label:'Tasks Completed',data:chartData.completion,backgroundColor:'rgba(16,185,129,0.6)',borderColor:'#10b981',borderWidth:1,borderRadius:4},{label:'Tasks Failed',data:chartData.failed,backgroundColor:'rgba(239,68,68,0.4)',borderColor:'#ef4444',borderWidth:1,borderRadius:4}]},options:{...baseOptions(),plugins:{legend:{display:true,labels:{color:'#94a3b8',font:{family:'Inter',size:11}}}}}});
  charts.cpu=new Chart(document.getElementById('cpuChart'),{type:'line',data:{labels:chartData.labels,datasets:[{label:'CPU %',data:chartData.cpu,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.1)',fill:true,tension:0.5,pointRadius:0,borderWidth:2}]},options:baseOptions({scales:{...baseOptions().scales,y:{...baseOptions().scales.y,max:100}}})});
  charts.queue=new Chart(document.getElementById('queueChart'),{type:'line',data:{labels:chartData.labels,datasets:[{label:'Queue Length',data:chartData.queue,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.1)',fill:true,tension:0.4,pointRadius:0,borderWidth:2}]},options:baseOptions()});
  charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'doughnut',data:{labels:['Busy','Idle'],datasets:[{data:[0,4],backgroundColor:['rgba(6,182,212,0.8)','rgba(100,116,139,0.4)'],borderColor:['#06b6d4','#475569'],borderWidth:2,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:true,animation:{duration:400},cutout:'70%',plugins:{legend:{display:true,position:'bottom',labels:{color:'#94a3b8',font:{family:'Inter',size:11},padding:12}},tooltip:{callbacks:{label:ctx=>{const total=ctx.dataset.data.reduce((sum,value)=>sum+value,0)||1;return ' '+ctx.label+': '+ctx.raw+' ('+Math.round(ctx.raw/total*100)+'%)';}}}}}});
  charts.execTime=new Chart(document.getElementById('execTimeChart'),{type:'bar',data:{labels:chartData.labels,datasets:[{label:'Avg Exec Time (ms)',data:chartData.execTime,backgroundColor:'rgba(139,92,246,0.6)',borderColor:'#8b5cf6',borderWidth:1,borderRadius:4}]},options:baseOptions()});
  initComparisonChart();
}

function initComparisonChart(){if(!chartsAvailable())return;const el=document.getElementById('comparisonChart');if(!el)return;charts.comparison=new Chart(el,{type:'bar',data:{labels:['Response Time (ms)','Memory (MB)','CPU Efficiency (%)','Throughput (req/s)'],datasets:[{label:'Without Thread Pool',data:[850,2100,40,120],backgroundColor:'rgba(239,68,68,0.6)',borderColor:'#ef4444',borderWidth:1,borderRadius:4},{label:'With Thread Pool',data:[45,256,89,4800],backgroundColor:'rgba(16,185,129,0.6)',borderColor:'#10b981',borderWidth:1,borderRadius:4}]},options:{...baseOptions(),plugins:{legend:{display:true,labels:{color:'#94a3b8',font:{family:'Inter',size:12}}}},scales:{...baseOptions().scales,y:{...baseOptions().scales.y,type:'logarithmic'}}}});}

function updateCharts(){
  if(!chartsAvailable()||!state.running||state.paused)return;
  const busy=state.threads.filter(thread=>thread.status==='busy').length;
  const idle=state.threads.filter(thread=>thread.status==='idle').length;
  const total=state.threads.length||1;
  const cpu=Math.round((busy/total)*100);
  const queueLength=state.tasks.filter(task=>task.status==='waiting').length;
  const newCompleted=state.totalCompleted-prevCompleted;
  const newFailed=state.totalFailed-prevFailed;
  prevCompleted=state.totalCompleted;prevFailed=state.totalFailed;
  const recent=state.completedTasks.slice(-20);
  const avgExec=recent.length?Math.round(recent.reduce((sum,task)=>sum+(task.completedAt-task.startedAt),0)/recent.length):0;
  const push=(arr,value)=>{arr.push(value);if(arr.length>MAX_POINTS)arr.shift();};
  push(chartData.labels,makeLabel());push(chartData.threads,busy);push(chartData.idle,idle);push(chartData.completion,newCompleted);push(chartData.failed,newFailed);push(chartData.cpu,cpu);push(chartData.queue,queueLength);push(chartData.execTime,avgExec);
  charts.threads.update('none');charts.completion.update('none');charts.cpu.update('none');charts.queue.update('none');charts.execTime.update('none');charts.ratio.data.datasets[0].data=[busy,Math.max(0,idle)];charts.ratio.update('none');
}

function resetCharts(){prevCompleted=0;prevFailed=0;Object.values(chartData).forEach(value=>{if(Array.isArray(value))value.length=0;});if(!chartsAvailable())return;if(charts.threads)charts.threads.update();if(charts.completion)charts.completion.update();if(charts.cpu)charts.cpu.update();if(charts.queue)charts.queue.update();if(charts.execTime)charts.execTime.update();if(charts.ratio){const idleCount=parseInt(document.getElementById('threadCount')?.value||'4',10);charts.ratio.data.datasets[0].data=[0,idleCount];charts.ratio.update();}}
