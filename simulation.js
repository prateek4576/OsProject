// ===== THREAD POOL SIMULATION ENGINE =====

// Global State
const state = {
  running: false, paused: false,
  threads: [], tasks: [], completedTasks: [], taskIdCounter: 0,
  totalCompleted: 0, totalFailed: 0, totalGenerated: 0, totalRejected: 0,
  autoTaskTimer: null, simInterval: null,
  startTime: null, pausedAt: null, metrics: [],
  peakQueue: 0, peakBusy: 0, totalWaitTime: 0, totalExecTime: 0, totalTurnaroundTime: 0,
  filter: 'all', syncMode: 'unsafe'
};

let architectureAnimationFrame = null;
let architectureLaunchTimeout = null;
let concurrencyRunId = 0;

const TASK_TYPE_PROFILES = {
  cpu: { label: 'CPU Bound', durationMultiplier: 1.5, cpuLoad: 0.95, failureBonus: 0.02 },
  io: { label: 'I/O Bound', durationMultiplier: 1.2, cpuLoad: 0.45, failureBonus: 0.01 },
  short: { label: 'Short Task', durationMultiplier: 0.55, cpuLoad: 0.6, failureBonus: 0 },
  long: { label: 'Long Task', durationMultiplier: 2.1, cpuLoad: 0.72, failureBonus: 0.03 },
  critical: { label: 'Critical Task', durationMultiplier: 1, cpuLoad: 0.88, failureBonus: 0.04 }
};

const SIM_PRESETS = {
  balanced: {
    label: 'Balanced',
    threadCount: 4,
    queueCap: 12,
    taskDur: 1500,
    arrivalRate: 2,
    schedulePolicy: 'priority',
    overflowPolicy: 'reject',
    taskType: 'mixed',
    syncLock: true,
    failSim: false,
    autoTask: true
  },
  burst: {
    label: 'Burst Traffic',
    threadCount: 6,
    queueCap: 20,
    taskDur: 1100,
    arrivalRate: 6,
    schedulePolicy: 'fifo',
    overflowPolicy: 'expand',
    taskType: 'short',
    syncLock: true,
    failSim: false,
    autoTask: true
  },
  cpuHeavy: {
    label: 'CPU Heavy',
    threadCount: 5,
    queueCap: 16,
    taskDur: 2600,
    arrivalRate: 3,
    schedulePolicy: 'shortest',
    overflowPolicy: 'dropLowest',
    taskType: 'cpu',
    syncLock: true,
    failSim: false,
    autoTask: true
  },
  ioHeavy: {
    label: 'I/O Heavy',
    threadCount: 8,
    queueCap: 22,
    taskDur: 1300,
    arrivalRate: 5,
    schedulePolicy: 'priority',
    overflowPolicy: 'expand',
    taskType: 'io',
    syncLock: true,
    failSim: false,
    autoTask: true
  },
  failureLab: {
    label: 'Failure Lab',
    threadCount: 4,
    queueCap: 10,
    taskDur: 1800,
    arrivalRate: 3,
    schedulePolicy: 'priority',
    overflowPolicy: 'reject',
    taskType: 'critical',
    syncLock: true,
    failSim: true,
    autoTask: true
  }
};

const codeExamples = {
  cpp: {
    basic: `#include <thread>
#include <queue>
#include <mutex>
#include <vector>
#include <condition_variable>
#include <functional>

class ThreadPool {
public:
    explicit ThreadPool(size_t count) : stop(false) {
        for (size_t i = 0; i < count; ++i) {
            workers.emplace_back([this] { workerLoop(); });
        }
    }

    template <typename F>
    void enqueue(F&& task) {
        {
            std::lock_guard<std::mutex> lock(queueMutex);
            taskQueue.emplace(std::forward<F>(task));
        }
        cv.notify_one();
    }

    ~ThreadPool() {
        {
            std::lock_guard<std::mutex> lock(queueMutex);
            stop = true;
        }
        cv.notify_all();
        for (auto& worker : workers) worker.join();
    }

private:
    void workerLoop() {
        while (true) {
            std::function<void()> task;
            {
                std::unique_lock<std::mutex> lock(queueMutex);
                cv.wait(lock, [this] {
                    return stop || !taskQueue.empty();
                });
                if (stop && taskQueue.empty()) return;
                task = std::move(taskQueue.front());
                taskQueue.pop();
            }
            task();
        }
    }

    std::vector<std::thread> workers;
    std::queue<std::function<void()>> taskQueue;
    std::mutex queueMutex;
    std::condition_variable cv;
    bool stop;
};`,
    queue: `#include <queue>
#include <mutex>
#include <optional>

class TaskQueue {
public:
    bool push(Task task) {
        std::lock_guard<std::mutex> lock(mutex);
        if (queue.size() >= capacity) return false;
        queue.push(std::move(task));
        return true;
    }

    std::optional<Task> pop() {
        std::lock_guard<std::mutex> lock(mutex);
        if (queue.empty()) return std::nullopt;
        Task next = std::move(queue.front());
        queue.pop();
        return next;
    }

private:
    std::queue<Task> queue;
    std::mutex mutex;
    size_t capacity = 128;
};`,
    sync: `#include <mutex>

std::mutex sharedMutex;
int sharedCounter = 0;

void safeIncrement() {
    std::lock_guard<std::mutex> lock(sharedMutex);
    ++sharedCounter;
}

void worker() {
    for (int i = 0; i < 1000; ++i) {
        safeIncrement();
    }
}`
  },
  java: {
    basic: `import java.util.concurrent.*;

public class ThreadPoolDemo {
    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);

        for (int i = 0; i < 10; i++) {
            final int taskId = i;
            pool.submit(() -> {
                System.out.println("Task " + taskId +
                    " handled by " + Thread.currentThread().getName());
                Thread.sleep(100);
                return taskId;
            });
        }

        pool.shutdown();
        pool.awaitTermination(30, TimeUnit.SECONDS);
    }
}`,
    queue: `import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

BlockingQueue<Runnable> taskQueue = new ArrayBlockingQueue<>(100);

boolean accepted = taskQueue.offer(() -> {
    System.out.println("Task accepted");
});

Runnable next = taskQueue.poll();
if (next != null) {
    next.run();
}`,
    sync: `import java.util.concurrent.locks.ReentrantLock;

class SharedCounter {
    private final ReentrantLock lock = new ReentrantLock();
    private int value = 0;

    public void increment() {
        lock.lock();
        try {
            value++;
        } finally {
            lock.unlock();
        }
    }
}`
  },
  python: {
    basic: `from concurrent.futures import ThreadPoolExecutor
import time

def handle_task(task_id: int) -> str:
    time.sleep(0.1)
    return f"task-{task_id} done"

with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(handle_task, i) for i in range(10)]
    for future in futures:
        print(future.result())`,
    queue: `import queue

task_queue = queue.Queue(maxsize=100)

task_queue.put(("task-1", {"priority": "high"}))

name, meta = task_queue.get()
print(name, meta["priority"])
task_queue.task_done()`,
    sync: `import threading

lock = threading.Lock()
counter = 0

def safe_increment():
    global counter
    with lock:
        counter += 1`
  }
};

// ===== PARTICLE CANVAS =====
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], connections = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = canvas.parentElement.clientHeight || window.innerHeight; }
  window.addEventListener('resize', resize); resize();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W; this.y = Math.random() * H;
      this.vx = (Math.random() - .5) * .6; this.vy = (Math.random() - .5) * .6;
      this.r = Math.random() * 2 + 1;
      this.type = Math.random() > .5 ? 'thread' : 'task';
      this.color = this.type === 'thread' ? '#06b6d4' : '#8b5cf6';
      this.alpha = Math.random() * .6 + .2;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color + Math.round(this.alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
      if (this.type === 'thread') {
        ctx.shadowColor = this.color; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      }
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const alpha = (1 - dist / 120) * .15;
          ctx.strokeStyle = `rgba(6,182,212,${alpha})`;
          ctx.lineWidth = .5; ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,14,26,0)';
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();
})();

// ===== NAVBAR ACTIVE TRACKING =====
window.addEventListener('scroll', () => {
  const sections = ['hero', 'concepts', 'simulator', 'dashboard', 'lifecycle', 'concurrency', 'comparison', 'code', 'architecture', 'monitor'];
  let current = 'hero';
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 100) current = id;
  });
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('href') === '#' + current);
  });
});

// ===== NAV HELPERS =====
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  document.getElementById('navLinks').classList.remove('open');
}
function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ===== CONCEPT CARDS =====
function toggleConcept(card) {
  const wasOpen = card.classList.contains('open');
  document.querySelectorAll('.concept-card').forEach(c => {
    c.classList.remove('open');
    const toggle = c.querySelector('.concept-toggle');
    if (toggle) toggle.textContent = 'Click to expand [v]';
  });

  if (!wasOpen) {
    card.classList.add('open');
    const toggle = card.querySelector('.concept-toggle');
    if (toggle) toggle.textContent = 'Click to collapse [^]';
  }
}

// ===== SLIDER HELPERS =====
function updateSlider(input, valId, val) {
  document.getElementById(valId).textContent = val;
}

// ===== THREAD POOL CORE =====
function getConfig() {
  return {
    threads: parseInt(document.getElementById('threadCount').value, 10),
    queueCap: parseInt(document.getElementById('queueCap').value, 10),
    taskDur: parseInt(document.getElementById('taskDur').value, 10),
    arrivalRate: parseInt(document.getElementById('arrivalRate').value, 10),
    syncLock: document.getElementById('syncLock').checked,
    failSim: document.getElementById('failSim').checked,
    autoTask: document.getElementById('autoTask').checked,
    schedulePolicy: document.getElementById('schedulePolicy').value,
    overflowPolicy: document.getElementById('overflowPolicy').value,
    taskType: document.getElementById('taskType').value,
    preset: document.getElementById('simPreset').value
  };
}

function setSliderValue(inputId, valueId, value, suffix = '') {
  const input = document.getElementById(inputId);
  const label = document.getElementById(valueId);
  if (input) input.value = value;
  if (label) label.textContent = `${value}${suffix}`;
}

function chooseTaskType(mode) {
  if (mode && mode !== 'mixed') return mode;
  const types = ['cpu', 'io', 'short', 'long', 'critical'];
  return types[Math.floor(Math.random() * types.length)];
}

function getTaskProfile(type) {
  return TASK_TYPE_PROFILES[type] || TASK_TYPE_PROFILES.io;
}

function applyPreset() {
  const presetKey = document.getElementById('simPreset').value;
  const preset = SIM_PRESETS[presetKey];
  if (!preset) return;

  setSliderValue('threadCount', 'threadCountVal', preset.threadCount);
  setSliderValue('queueCap', 'queueCapVal', preset.queueCap);
  setSliderValue('taskDur', 'taskDurVal', preset.taskDur);
  setSliderValue('arrivalRate', 'arrivalRateVal', preset.arrivalRate, '/s');

  document.getElementById('schedulePolicy').value = preset.schedulePolicy;
  document.getElementById('overflowPolicy').value = preset.overflowPolicy;
  document.getElementById('taskType').value = preset.taskType;
  document.getElementById('syncLock').checked = preset.syncLock;
  document.getElementById('failSim').checked = preset.failSim;
  document.getElementById('autoTask').checked = preset.autoTask;

  updatePool();
  updateSummary();
  logActivity(`Preset applied: ${preset.label}`, 'info');
}

function averageFromTotal(total, count) {
  return count ? Math.round(total / count) : 0;
}

function formatMs(value) {
  return `${Math.round(value || 0)}ms`;
}

function labelize(value) {
  return String(value || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, char => char.toUpperCase());
}

function updateSummary() {
  const processed = state.totalCompleted + state.totalFailed;
  const taskMix = state.tasks.reduce((acc, task) => {
    acc[task.type] = (acc[task.type] || 0) + 1;
    return acc;
  }, {});
  const mixText = Object.keys(taskMix).length
    ? Object.entries(taskMix).map(([type, count]) => `${getTaskProfile(type).label}: ${count}`).join(' | ')
    : 'No tasks yet';
  const preset = SIM_PRESETS[document.getElementById('simPreset').value];
  const config = getConfig();

  document.getElementById('summaryGenerated').textContent = state.totalGenerated;
  document.getElementById('summaryRejected').textContent = state.totalRejected;
  document.getElementById('summaryPeakQueue').textContent = state.peakQueue;
  document.getElementById('summaryPeakBusy').textContent = state.peakBusy;
  document.getElementById('summaryAvgWait').textContent = formatMs(averageFromTotal(state.totalWaitTime, processed));
  document.getElementById('summaryAvgExec').textContent = formatMs(averageFromTotal(state.totalExecTime, processed));
  document.getElementById('summaryAvgTurnaround').textContent = formatMs(averageFromTotal(state.totalTurnaroundTime, processed));
  document.getElementById('summaryTaskMix').textContent = mixText;
  document.getElementById('summaryPolicy').textContent = `Preset: ${preset ? preset.label : 'Custom'} | ${labelize(config.schedulePolicy)} | ${labelize(config.overflowPolicy)}`;
}

function exportSimulationReport(format) {
  const processed = state.totalCompleted + state.totalFailed;
  const report = {
    generated: state.totalGenerated,
    completed: state.totalCompleted,
    failed: state.totalFailed,
    rejected: state.totalRejected,
    peakQueue: state.peakQueue,
    peakBusyThreads: state.peakBusy,
    avgWaitMs: averageFromTotal(state.totalWaitTime, processed),
    avgExecMs: averageFromTotal(state.totalExecTime, processed),
    avgTurnaroundMs: averageFromTotal(state.totalTurnaroundTime, processed),
    config: getConfig(),
    completedTasks: state.completedTasks.map(task => ({
      id: task.id,
      type: task.type,
      priority: task.priority,
      status: task.status,
      waitMs: task.waitTime || 0,
      execMs: task.execTime || 0,
      turnaroundMs: task.turnaroundTime || 0
    }))
  };

  const text = format === 'json'
    ? JSON.stringify(report, null, 2)
    : [
        'Thread Pool OS Simulator Report',
        `Generated: ${report.generated}`,
        `Completed: ${report.completed}`,
        `Failed: ${report.failed}`,
        `Rejected: ${report.rejected}`,
        `Peak Queue: ${report.peakQueue}`,
        `Peak Busy Threads: ${report.peakBusyThreads}`,
        `Average Wait: ${report.avgWaitMs}ms`,
        `Average Execution: ${report.avgExecMs}ms`,
        `Average Turnaround: ${report.avgTurnaroundMs}ms`,
        `Scheduling: ${report.config.schedulePolicy}`,
        `Overflow Policy: ${report.config.overflowPolicy}`,
        `Task Type Mode: ${report.config.taskType}`
      ].join('\n');

  const blob = new Blob([text], { type: format === 'json' ? 'application/json' : 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `threadpool-report.${format}`;
  link.click();
  URL.revokeObjectURL(url);
  logActivity(`Exported simulation report as ${format.toUpperCase()}`, 'success');
}

function createWorkers(n) {
  state.threads = [];
  const container = document.getElementById('workersContainer');
  container.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const t = { id: i, status: 'idle', task: null, progress: 0, tasksDone: 0, execTime: 0, mem: (Math.random() * 20 + 10).toFixed(1) };
    state.threads.push(t);
    container.appendChild(buildWorkerNode(t));
  }
}

function buildWorkerNode(t) {
  const div = document.createElement('div');
  div.className = 'worker-node idle';
  div.id = `worker-${t.id}`;
  div.innerHTML = `
    <div class="worker-header">
      <span class="worker-id">TH-${String(t.id).padStart(3,'0')}</span>
      <span class="worker-status idle" id="ws-${t.id}">Idle</span>
    </div>
    <div class="worker-task" id="wt-${t.id}">Waiting for task...</div>
    <div class="worker-progress"><div class="worker-progress-fill" id="wp-${t.id}" style="width:0%"></div></div>
    <div class="worker-meta">
      <span id="wm-${t.id}">Tasks: 0</span>
      <span id="wmem-${t.id}">${t.mem}MB</span>
    </div>`;
  return div;
}

function updateWorkerUI(t) {
  const node = document.getElementById(`worker-${t.id}`);
  if (!node) return;
  node.className = `worker-node ${t.status}`;
  const ws = document.getElementById(`ws-${t.id}`);
  if (ws) { ws.className = `worker-status ${t.status}`; ws.textContent = t.status.charAt(0).toUpperCase() + t.status.slice(1); }
  const wt = document.getElementById(`wt-${t.id}`);
  if (wt) wt.textContent = t.task ? `Task #${t.task.id} (${t.task.priority}, ${t.task.type})` : 'Waiting for task...';
  const wp = document.getElementById(`wp-${t.id}`);
  if (wp) wp.style.width = `${t.progress}%`;
  const wm = document.getElementById(`wm-${t.id}`);
  if (wm) wm.textContent = `Tasks: ${t.tasksDone}`;
}

function addTaskToQueue(priority) {
  const cfg = getConfig();
  const waitingCount = state.tasks.filter(t => t.status === 'waiting').length;
  if (waitingCount >= cfg.queueCap) {
    if (cfg.overflowPolicy === 'dropLowest') {
      const dropCandidate = state.tasks
        .filter(task => task.status === 'waiting')
        .sort((a, b) => {
          const priorityOrder = { high: 2, normal: 1, low: 0 };
          return priorityOrder[a.priority] - priorityOrder[b.priority] || a.addedAt - b.addedAt;
        })[0];

      if (dropCandidate) {
        dropCandidate.status = 'dropped';
        state.totalRejected++;
        removeTaskFromQueue(dropCandidate.id);
        logActivity(`Dropped Task #${dropCandidate.id} to make room for new work.`, 'warning');
      }
    } else if (cfg.overflowPolicy === 'expand') {
      const nextCapacity = Math.min(cfg.queueCap + 1, 80);
      setSliderValue('queueCap', 'queueCapVal', nextCapacity);
      logActivity(`Queue auto-expanded to ${nextCapacity}.`, 'info');
    } else {
      state.totalRejected++;
      logActivity('Queue full! Task rejected.', 'warning');
      updateSummary();
      return false;
    }
  }

  const type = chooseTaskType(cfg.taskType);
  const profile = getTaskProfile(type);
  const task = {
    id: ++state.taskIdCounter, status: 'waiting',
    priority: priority || document.getElementById('taskPriority').value,
    type,
    cpuLoad: profile.cpuLoad,
    duration: (cfg.taskDur * profile.durationMultiplier) + (Math.random() - .5) * cfg.taskDur * .22,
    addedAt: Date.now(), startedAt: null, completedAt: null,
    waitTime: 0, execTime: 0, turnaroundTime: 0
  };
  if (cfg.failSim && Math.random() < (0.08 + profile.failureBonus)) task.willFail = true;
  state.tasks.push(task);
  state.totalGenerated++;
  renderQueue();
  state.peakQueue = Math.max(state.peakQueue, state.tasks.filter(t => t.status === 'waiting').length);
  logActivity(`Task #${task.id} [${task.priority}, ${profile.label}] added to queue`, 'task');
  updateSummary();
  return true;
}

function renderQueue() {
  const container = document.getElementById('queueContainer');
  const emptyMsg = document.getElementById('queueEmptyMsg');
  const waiting = state.tasks.filter(t => t.status === 'waiting');
  if (waiting.length === 0) {
    emptyMsg.style.display = '';
    const oldNodes = container.querySelectorAll('.task-node');
    oldNodes.forEach(n => n.remove());
  } else {
    emptyMsg.style.display = 'none';
    const existing = new Set(Array.from(container.querySelectorAll('.task-node')).map(n => n.dataset.id));
    waiting.forEach(t => {
      if (!existing.has(String(t.id))) {
        const div = document.createElement('div');
        div.className = `task-node waiting ${t.priority === 'high' ? 'high' : ''}`;
        div.dataset.id = t.id;
        div.innerHTML = `<div class="task-dot"></div>T${t.id}`;
        div.title = `Priority: ${t.priority} | Type: ${getTaskProfile(t.type).label} | Est: ${Math.round(t.duration)}ms`;
        container.appendChild(div);
      }
    });
    existing.forEach(id => {
      if (!waiting.find(t => t.id === parseInt(id))) {
        const n = container.querySelector(`[data-id="${id}"]`);
        if (n) n.remove();
      }
    });
  }
}

function assignTasksToThreads() {
  const cfg = getConfig();
  const idleThreads = state.threads.filter(thread => thread.status === 'idle');
  const waitingTasks = state.tasks
    .filter(task => task.status === 'waiting')
    .sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      if (cfg.schedulePolicy === 'fifo') return a.addedAt - b.addedAt;
      if (cfg.schedulePolicy === 'shortest') return a.duration - b.duration;
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.addedAt - b.addedAt;
    });

  idleThreads.forEach(thread => {
    const task = waitingTasks.shift();
    if (!task) return;

    task.status = 'running';
    task.startedAt = Date.now();
    task.waitTime = task.startedAt - task.addedAt;
    thread.status = 'busy';
    thread.task = task;
    thread.progress = 0;
    thread.progressInterval = setInterval(() => {
      if (state.paused) return;
      const elapsed = Date.now() - task.startedAt;
      thread.progress = Math.min(100, (elapsed / task.duration) * 100);
      updateWorkerUI(thread);
      if (thread.progress >= 100) {
        clearInterval(thread.progressInterval);
        completeTask(thread, task);
      }
    }, 50);

    removeTaskFromQueue(task.id);
    updateWorkerUI(thread);
    logActivity(`Thread TH-${String(thread.id).padStart(3, '0')} picked up Task #${task.id}`, 'info');
  });

  state.peakBusy = Math.max(state.peakBusy, state.threads.filter(thread => thread.status === 'busy').length);
}

function removeTaskFromQueue(taskId) {
  const node = document.getElementById('queueContainer')?.querySelector(`[data-id="${taskId}"]`);
  if (node) { node.style.animation = 'none'; node.style.opacity = '.3'; setTimeout(() => node.remove(), 200); }
}

function completeTask(thread, task) {
  const failed = task.willFail;
  task.status = failed ? 'failed' : 'completed';
  task.completedAt = Date.now();
  task.execTime = task.completedAt - task.startedAt;
  task.turnaroundTime = task.completedAt - task.addedAt;
  thread.status = 'completed';
  thread.task = null;
  thread.progress = 0;
  thread.tasksDone++;
  state.totalWaitTime += task.waitTime;
  state.totalExecTime += task.execTime;
  state.totalTurnaroundTime += task.turnaroundTime;

  if (failed) {
    state.totalFailed++;
    logActivity(`Task #${task.id} FAILED on TH-${String(thread.id).padStart(3, '0')}`, 'error');
  } else {
    state.totalCompleted++;
    logActivity(`Task #${task.id} completed by TH-${String(thread.id).padStart(3, '0')} [OK]`, 'success');
  }

  state.completedTasks.push(task);
  updateWorkerUI(thread);
  renderCompleted();
  setTimeout(() => {
    thread.status = 'idle';
    updateWorkerUI(thread);
    updateMonitorTable();
  }, 400);
  updateMetrics();
  updateSummary();
}

function renderCompleted() {
  const container = document.getElementById('completedContainer');
  const emptyMsg = container.querySelector('.queue-empty-msg');
  if (emptyMsg) emptyMsg.remove();

  const last = state.completedTasks.slice(-15);
  container.innerHTML = '';
  last.forEach(task => {
    const div = document.createElement('div');
    div.className = `task-node ${task.status}`;
    div.textContent = `T${task.id} ${task.status === 'completed' ? 'Done' : 'Failed'}`;
    container.appendChild(div);
  });
}

function logActivity(msg, type = 'info') {
  const log = document.getElementById('activityLog');
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.textContent = `[${ts}] ${msg}`;
  log.prepend(div);
  while (log.children.length > 100) log.removeChild(log.lastChild);
}

function clearLog() { document.getElementById('activityLog').innerHTML = ''; }

function updateMetrics() {
  const busy = state.threads.filter(t => t.status === 'busy').length;
  const idle = state.threads.filter(t => t.status === 'idle').length;
  const qLen = state.tasks.filter(t => t.status === 'waiting').length;
  const elapsed = state.startTime ? (Date.now() - state.startTime) / 1000 : 1;
  const throughput = (state.totalCompleted / elapsed).toFixed(2);
  const processed = state.totalCompleted + state.totalFailed;
  const avgWait = averageFromTotal(state.totalWaitTime, processed);
  const avgTurnaround = averageFromTotal(state.totalTurnaroundTime, processed);
  const utilization = state.threads.length ? Math.round((busy / state.threads.length) * 100) : 0;

  document.getElementById('simThreadsBusy').textContent = busy;
  document.getElementById('simThreadsIdle').textContent = idle;
  document.getElementById('simQueueLen').textContent = qLen;
  document.getElementById('simCompleted').textContent = state.totalCompleted;
  document.getElementById('simFailed').textContent = state.totalFailed;
  document.getElementById('simThroughput').textContent = throughput;
  document.getElementById('simAvgWait').textContent = formatMs(avgWait);
  document.getElementById('simAvgTurnaround').textContent = formatMs(avgTurnaround);
  document.getElementById('simUtilization').textContent = `${utilization}%`;

  // Hero stats
  document.getElementById('heroThreadCount').textContent = busy;
  document.getElementById('heroTasksDone').textContent = state.totalCompleted;
  document.getElementById('heroCpu').textContent = `${utilization}%`;
  document.getElementById('heroQueueLen').textContent = qLen;

  state.peakQueue = Math.max(state.peakQueue, qLen);
  state.peakBusy = Math.max(state.peakBusy, busy);
  updateMonitorTable();
  updateSummary();
}

// ===== SIMULATION CONTROLS =====
let autoTaskTimer = null;

function startSimulation() {
  if (state.running && state.paused) {
    pauseSimulation();
    return;
  }
  if (state.running) return;

  state.running = true;
  state.paused = false;
  state.pausedAt = null;
  state.startTime = state.startTime || Date.now();

  const cfg = getConfig();
  createWorkers(cfg.threads);
  document.getElementById('startBtn').disabled = true;
  document.getElementById('pauseBtn').disabled = false;
  logActivity('Simulation started', 'success');
  scheduleAutoTask();
  state.simInterval = setInterval(() => {
    if (!state.paused) {
      assignTasksToThreads();
      updateMetrics();
      updateCharts();
    }
  }, 200);
}

function scheduleAutoTask() {
  if (autoTaskTimer) clearTimeout(autoTaskTimer);
  if (!state.running || state.paused || !document.getElementById('autoTask').checked) return;
  const cfg = getConfig();
  const delay = 1000 / cfg.arrivalRate;
  autoTaskTimer = setTimeout(() => {
    if (state.running && !state.paused) addTaskToQueue();
    scheduleAutoTask();
  }, delay);
}

function toggleAutoTask() { if (state.running) scheduleAutoTask(); }

function pauseSimulation() {
  if (!state.running) return;

  state.paused = !state.paused;
  const btn = document.getElementById('pauseBtn');
  btn.innerHTML = state.paused
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Resume'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
  document.getElementById('startBtn').disabled = true;

  if (state.paused) {
    state.pausedAt = Date.now();
    clearTimeout(autoTaskTimer);
    autoTaskTimer = null;
    logActivity('Simulation paused', 'info');
    return;
  }

  if (state.pausedAt) {
    const pausedDuration = Date.now() - state.pausedAt;
    state.startTime += pausedDuration;
    state.threads.forEach(thread => {
      if (thread.task?.startedAt) {
        thread.task.startedAt += pausedDuration;
      }
    });
  }

  state.pausedAt = null;
  scheduleAutoTask();
  logActivity('Simulation resumed', 'info');
}

function resetSimulation() {
  state.running = false;
  state.paused = false;
  state.pausedAt = null;
  clearInterval(state.simInterval);
  clearTimeout(autoTaskTimer);
  state.threads.forEach(thread => clearInterval(thread.progressInterval));
  state.simInterval = null;
  autoTaskTimer = null;
  state.threads = [];
  state.tasks = [];
  state.completedTasks = [];
  state.totalCompleted = 0;
  state.totalFailed = 0;
  state.totalGenerated = 0;
  state.totalRejected = 0;
  state.taskIdCounter = 0;
  state.startTime = null;
  state.peakQueue = 0;
  state.peakBusy = 0;
  state.totalWaitTime = 0;
  state.totalExecTime = 0;
  state.totalTurnaroundTime = 0;

  document.getElementById('startBtn').disabled = false;
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('pauseBtn').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
  document.getElementById('workersContainer').innerHTML = '';
  document.getElementById('queueContainer').innerHTML = '<div class="queue-empty-msg" id="queueEmptyMsg">Queue is empty - tasks will appear here</div>';
  document.getElementById('completedContainer').innerHTML = '<div class="queue-empty-msg">Completed tasks will appear here</div>';
  document.getElementById('monitorBody').innerHTML = '';
  createWorkers(parseInt(document.getElementById('threadCount').value, 10));
  updateMetrics();
  logActivity('Simulation reset', 'warning');
  resetCharts();
  updateSummary();
}

function addManualTask() {
  if (!state.running) { logActivity('Start simulation first!', 'warning'); return; }
  addTaskToQueue();
}

function updatePool() {
  const targetThreadCount = parseInt(document.getElementById('threadCount').value, 10);

  if (!state.running) {
    createWorkers(targetThreadCount);
    updateMetrics();
    return;
  }

  const diff = targetThreadCount - state.threads.length;
  if (diff > 0) {
    for (let i = 0; i < diff; i++) {
      const thread = {
        id: state.threads.length,
        status: 'idle',
        task: null,
        progress: 0,
        tasksDone: 0,
        mem: (Math.random() * 20 + 10).toFixed(1)
      };
      state.threads.push(thread);
      document.getElementById('workersContainer').appendChild(buildWorkerNode(thread));
    }
  } else if (diff < 0) {
    const removable = state.threads
      .filter(thread => thread.status === 'idle')
      .sort((a, b) => b.id - a.id)
      .slice(0, Math.abs(diff));

    removable.forEach(thread => {
      state.threads = state.threads.filter(existing => existing.id !== thread.id);
      document.getElementById(`worker-${thread.id}`)?.remove();
    });

    if (removable.length < Math.abs(diff)) {
      logActivity('Some busy threads could not be removed until they become idle.', 'warning');
    }
  }

  updateMetrics();
}

// ===== MONITOR TABLE =====
function updateMonitorTable() {
  const body = document.getElementById('monitorBody');
  if (!body) return;
  body.innerHTML = '';
  const filterVal = state.filter;
  let shown = 0;
  state.threads.forEach(t => {
    if (filterVal !== 'all' && t.status !== filterVal) return;
    shown++;
    const tr = document.createElement('tr');
    const cpu = t.status === 'busy'
      ? Math.round(((t.task?.cpuLoad || 0.6) * 55) + 35 + Math.random() * 8)
      : Math.round(Math.random() * 5);
    tr.innerHTML = `
      <td>TH-${String(t.id).padStart(3,'0')}</td>
      <td><span class="thread-status-badge ${t.status}">${t.status}</span></td>
      <td>${t.task ? `Task #${t.task.id} (${t.task.type})` : '-'}</td>
      <td>${t.task ? Math.round(Date.now() - t.task.startedAt) + 'ms' : '-'}</td>
      <td>${t.tasksDone}</td>
      <td>${cpu}%<div class="cpu-bar"><div class="cpu-bar-fill" style="width:${cpu}%"></div></div></td>
      <td>${t.mem}MB</td>
      <td>${t.task ? t.task.priority : '-'}</td>`;
    body.appendChild(tr);
  });
  const footer = document.getElementById('monitorFooter');
  if (footer) footer.textContent = `Showing ${shown} threads - ${state.totalCompleted} tasks completed`;
}

function filterThreads(filter, btn) {
  state.filter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateMonitorTable();
}

function searchThreads(val) {
  const rows = document.querySelectorAll('#monitorBody tr');
  rows.forEach(row => {
    row.style.display = row.cells[0]?.textContent.toLowerCase().includes(val.toLowerCase()) ? '' : 'none';
  });
}

// ===== LIFECYCLE ANIMATION =====
const lcStages = ['Created', 'Idle', 'Assigned', 'Executing', 'Completed', 'Reused'];
const lcColors = ['#64748b', '#64748b', '#f59e0b', '#06b6d4', '#10b981', '#8b5cf6'];
let lcAnimTimer = null;

function animateLifecycle() {
  resetLifecycle();
  let step = 0;
  const fill = document.getElementById('lcFill');
  const status = document.getElementById('lcStatus');
  function nextStep() {
    if (step > 5) return;
    document.querySelectorAll('.lc-stage').forEach((s, i) => s.classList.toggle('active', i === step));
    document.querySelectorAll('.lc-arrow').forEach((a, i) => a.classList.toggle('active', i === step));
    if (fill) fill.style.width = `${(step / 5) * 100}%`;
    if (status) status.textContent = `Stage ${step + 1}/6: Thread ${lcStages[step]}`;
    step++;
    if (step <= 5) lcAnimTimer = setTimeout(nextStep, 1200);
  }
  nextStep();
}

function resetLifecycle() {
  clearTimeout(lcAnimTimer);
  document.querySelectorAll('.lc-stage').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.lc-arrow').forEach(a => a.classList.remove('active'));
  const fill = document.getElementById('lcFill');
  const status = document.getElementById('lcStatus');
  if (fill) fill.style.width = '0%';
  if (status) status.textContent = 'Click "Animate Lifecycle" to begin';
}

// ===== CONCURRENCY DEMO =====
let concurrencyMode = 'unsafe';
function setConcurrencyMode(mode) {
  concurrencyMode = mode;
  const noSyncBtn = document.getElementById('noSyncBtn');
  const syncBtn = document.getElementById('syncBtn');
  const explanation = document.getElementById('syncExplan');

  noSyncBtn.className = 'sync-mode-btn' + (mode === 'unsafe' ? ' active' : '');
  syncBtn.className = 'sync-mode-btn' + (mode === 'safe' ? ' safe-active' : '');
  explanation.innerHTML = mode === 'unsafe'
    ? '<div class="danger-box"><strong>Race Condition Active!</strong><p>Multiple threads are updating shared state without a lock, so some increments will be lost.</p></div>'
    : '<div class="safe-box"><strong>Mutex Lock Active</strong><p>Threads acquire a lock before updating the counter, so the final result stays correct.</p></div>';
}

function runConcurrencyDemo() {
  const currentRunId = ++concurrencyRunId;
  const counterEl = document.getElementById('concurrencyCounter');
  const statusEl = document.getElementById('counterStatus');
  const logBody = document.getElementById('cvLogBody');
  const cvValue = document.getElementById('cvValue');
  const cvLock = document.getElementById('cvLock');
  const cvResource = document.getElementById('cvResource');

  logBody.innerHTML = '';
  counterEl.textContent = '0';
  cvValue.textContent = '0';
  cvLock.textContent = 'Unlocked';
  statusEl.textContent = 'Running...';
  statusEl.style.color = '';
  cvResource.style.borderColor = '';

  const cvThreads = document.getElementById('cvThreads');
  cvThreads.innerHTML = '';
  const numThreads = 4;
  const threadEls = [];
  for (let i = 0; i < numThreads; i++) {
    const div = document.createElement('div');
    div.className = 'cv-thread';
    div.innerHTML = `<div class="cv-thread-name">Thread-${i}</div><div class="cv-thread-op" id="cvop-${i}">Waiting...</div>`;
    cvThreads.appendChild(div);
    threadEls.push(div);
  }

  let sharedCounter = 0;
  let expected = 0;
  const totalOps = 1000;
  const opsPerThread = totalOps / numThreads;
  const safe = concurrencyMode === 'safe';
  let mutex = false;

  function log(msg, type) {
    const div = document.createElement('div');
    div.className = `cv-log-entry ${type}`;
    div.textContent = msg;
    logBody.prepend(div);
    while (logBody.children.length > 50) logBody.removeChild(logBody.lastChild);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runThread(id, operations) {
    for (let i = 0; i < operations; i++) {
      if (currentRunId !== concurrencyRunId) return;

      if (safe) {
        while (mutex) {
          await sleep(1);
          if (currentRunId !== concurrencyRunId) return;
        }

        mutex = true;
        cvLock.textContent = `Locked by Thread-${id}`;
        cvResource.style.borderColor = '#10b981';
        threadEls[id].className = 'cv-thread locked';
        document.getElementById(`cvop-${id}`).textContent = `Read: ${sharedCounter}`;
        await sleep(2);
        sharedCounter++;
        expected++;
        cvValue.textContent = sharedCounter;
        counterEl.textContent = sharedCounter;
        document.getElementById(`cvop-${id}`).textContent = `Write: ${sharedCounter}`;
        await sleep(2);
        mutex = false;
        cvLock.textContent = 'Unlocked';
        cvResource.style.borderColor = '';
        threadEls[id].className = 'cv-thread';
      } else {
        threadEls[id].className = 'cv-thread accessing';
        cvResource.style.borderColor = '#ef4444';
        document.getElementById(`cvop-${id}`).textContent = `Read: ${sharedCounter}`;
        const readValue = sharedCounter;
        await sleep(Math.random() * 3);
        sharedCounter = readValue + 1;
        expected++;
        cvValue.textContent = sharedCounter;
        counterEl.textContent = sharedCounter;
        document.getElementById(`cvop-${id}`).textContent = `Write: ${sharedCounter}`;
        threadEls[id].className = 'cv-thread';
        if (expected - sharedCounter > 2) {
          log(`Thread-${id}: data corruption detected. Expected ${expected}, got ${sharedCounter}`, 'danger');
        }
      }

      if (i % 100 === 0) {
        log(`Thread-${id}: ${i} operations done`, safe ? 'safe' : 'info');
      }
    }

    threadEls[id].className = 'cv-thread';
    document.getElementById(`cvop-${id}`).textContent = 'Done';
  }

  Promise.all(Array.from({ length: numThreads }, (_, i) => runThread(i, opsPerThread))).then(() => {
    if (currentRunId !== concurrencyRunId) return;

    statusEl.textContent = safe
      ? 'Correct result.'
      : `Result: ${sharedCounter} (expected ${expected} - ${expected - sharedCounter} lost updates)`;
    statusEl.style.color = safe ? '#10b981' : '#ef4444';
    log(
      safe
        ? `Final: ${sharedCounter}/${expected} (100% accurate)`
        : `Final: ${sharedCounter}/${expected} (${Math.round(sharedCounter / expected * 100)}% accurate)`,
      safe ? 'safe' : 'danger'
    );
    cvResource.style.borderColor = '';
    cvLock.textContent = 'Unlocked';
  });
}

// ===== CODE TABS =====
function switchCodeTab(lang, btn) {
  document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`code-${lang}`).classList.add('active');
}

function switchTopic(lang, topic, btn) {
  const panel = document.getElementById(`code-${lang}`);
  panel.querySelectorAll('.topic-tab').forEach(tab => tab.classList.remove('active'));
  btn.classList.add('active');

  const code = panel.querySelector('code');
  if (!code || !codeExamples[lang]?.[topic]) return;

  code.textContent = codeExamples[lang][topic];
  if (typeof Prism !== 'undefined' && typeof Prism.highlightElement === 'function') {
    Prism.highlightElement(code);
  }
}

function copyCode(btn) {
  const code = btn.nextElementSibling?.querySelector('code');
  if (!code) return;

  const text = code.textContent;
  const markCopied = () => {
    btn.textContent = 'Copied!';
    btn.style.color = '#10b981';
    if (typeof showToast === 'function') {
      showToast('Code copied to clipboard.', 'success');
    }
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.style.color = '';
    }, 2000);
  };

  const fallbackCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      markCopied();
    } catch (error) {
      logActivity('Copy failed. Please copy the code manually.', 'warning');
    } finally {
      textarea.remove();
    }
  };

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(markCopied).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

// ===== ARCHITECTURE DIAGRAM =====
function animateArchitecture() {
  const canvas = document.getElementById('archCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const nodes = [
    { label: 'Client\nRequests', x: 80, y: 200, color: '#06b6d4', r: 40 },
    { label: 'Task\nQueue', x: 250, y: 200, color: '#8b5cf6', r: 40 },
    { label: 'Pool\nManager', x: 430, y: 200, color: '#f59e0b', r: 40 },
    { label: 'Worker 1', x: 620, y: 80, color: '#10b981', r: 32 },
    { label: 'Worker 2', x: 620, y: 180, color: '#10b981', r: 32 },
    { label: 'Worker 3', x: 620, y: 280, color: '#10b981', r: 32 },
    { label: 'Completed\nTasks', x: 820, y: 200, color: '#f59e0b', r: 40 }
  ];
  const edges = [
    [0, 1, '#06b6d4'], [1, 2, '#8b5cf6'],
    [2, 3, '#10b981'], [2, 4, '#10b981'], [2, 5, '#10b981'],
    [3, 6, '#f59e0b'], [4, 6, '#f59e0b'], [5, 6, '#f59e0b']
  ];
  const SPEED = 0.015;
  let packets = [];

  if (architectureAnimationFrame) cancelAnimationFrame(architectureAnimationFrame);
  if (architectureLaunchTimeout) clearTimeout(architectureLaunchTimeout);

  function drawNode(node) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = node.color + '22';
    ctx.fill();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowColor = node.color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    node.label.split('\n').forEach((line, index, list) => {
      ctx.fillText(line, node.x, node.y + (index - (list.length - 1) / 2) * 15);
    });
  }

  function drawEdge(edge) {
    const from = nodes[edge[0]];
    const to = nodes[edge[1]];
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = edge[2] + '44';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function launchPacket(edgeIndex) {
    packets.push({ edge: edgeIndex, t: 0, color: edges[edgeIndex][2] });
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    edges.forEach(drawEdge);
    nodes.forEach(drawNode);

    packets = packets.filter(packet => {
      packet.t += SPEED;
      if (packet.t >= 1) return false;

      const from = nodes[edges[packet.edge][0]];
      const to = nodes[edges[packet.edge][1]];
      const x = from.x + (to.x - from.x) * packet.t;
      const y = from.y + (to.y - from.y) * packet.t;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = packet.color;
      ctx.shadowColor = packet.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      return true;
    });

    architectureAnimationFrame = requestAnimationFrame(tick);
  }

  tick();
  let edgeIndex = 0;
  const launch = () => {
    launchPacket(edgeIndex % edges.length);
    edgeIndex += 1;
    if (edgeIndex < edges.length * 3) {
      architectureLaunchTimeout = setTimeout(launch, 400);
    }
  };
  launch();
}

// ===== PERFORMANCE COMPARISON BARS ANIMATION =====
function animateComparisonBars() {
  document.querySelectorAll('.perf-bar').forEach(bar => {
    const w = bar.style.width;
    bar.style.width = '0%';
    requestAnimationFrame(() => { bar.style.transition = 'width 1.2s ease-out'; bar.style.width = w; });
  });
}

// Trigger bar animation on scroll into view
const compObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { animateComparisonBars(); compObs.unobserve(e.target); } });
}, { threshold: .3 });
const compSection = document.getElementById('comparison');
if (compSection) compObs.observe(compSection);

// Initialize UI
window.addEventListener('DOMContentLoaded', () => {
  applyPreset();
  updateMonitorTable();
  updateMetrics();
  initCharts();
  drawArchitectureStatic();
  if (typeof Prism !== 'undefined' && typeof Prism.highlightAll === 'function') {
    Prism.highlightAll();
  }
});

function drawArchitectureStatic() {
  const canvas = document.getElementById('archCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const nodes = [
    { label: 'Client\nRequests', x: 80, y: 200, color: '#06b6d4', r: 40 },
    { label: 'Task\nQueue', x: 250, y: 200, color: '#8b5cf6', r: 40 },
    { label: 'Pool\nManager', x: 430, y: 200, color: '#f59e0b', r: 40 },
    { label: 'Worker 1', x: 620, y: 80, color: '#10b981', r: 32 },
    { label: 'Worker 2', x: 620, y: 200, color: '#10b981', r: 32 },
    { label: 'Worker 3', x: 620, y: 320, color: '#10b981', r: 32 },
    { label: 'Completed\nTasks', x: 820, y: 200, color: '#f59e0b', r: 40 },
  ];
  const edges = [[0,1,'#06b6d4'],[1,2,'#8b5cf6'],[2,3,'#10b981'],[2,4,'#10b981'],[2,5,'#10b981'],[3,6,'#f59e0b'],[4,6,'#f59e0b'],[5,6,'#f59e0b']];
  ctx.clearRect(0, 0, W, H);
  edges.forEach(e => {
    const a = nodes[e[0]], b = nodes[e[1]];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = e[2] + '55'; ctx.lineWidth = 1.5; ctx.stroke();
  });
  nodes.forEach(n => {
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = n.color + '22'; ctx.fill();
    ctx.strokeStyle = n.color; ctx.lineWidth = 2;
    ctx.shadowColor = n.color; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#e2e8f0'; ctx.font = '12px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    n.label.split('\n').forEach((line, i, arr) => ctx.fillText(line, n.x, n.y + (i - (arr.length - 1) / 2) * 15));
  });
}
