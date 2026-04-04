# Thread Pool OS Simulator

An interactive Operating Systems project that visualizes how a thread pool manages concurrent work. The site combines theory, live simulation, real-time analytics, scheduling experiments, synchronization demos, and multi-language implementation examples in one educational web app.

## Overview

This project is designed to help students, reviewers, and demo audiences understand:

- how worker threads are created and reused
- how tasks move through a queue
- how scheduling policy changes behavior
- how synchronization affects correctness
- how throughput, wait time, and utilization change under load

## Features

- Interactive thread-pool simulator with configurable worker count, queue capacity, task duration, and arrival rate
- Scenario presets:
  - `Balanced`
  - `Burst Traffic`
  - `CPU Heavy`
  - `I/O Heavy`
  - `Failure Lab`
- Scheduling policies:
  - `Priority First`
  - `FIFO`
  - `Shortest Job First`
- Queue overflow policies:
  - `Reject New Task`
  - `Drop Lowest Priority`
  - `Auto Expand Queue`
- Task types:
  - `CPU Bound`
  - `I/O Bound`
  - `Short Task`
  - `Long Task`
  - `Critical Task`
  - `Auto Mix`
- Live metrics for:
  - busy threads
  - idle threads
  - queue length
  - completed tasks
  - failed tasks
  - throughput
  - average wait time
  - average turnaround time
  - utilization
- Simulation summary panel with peak values and task mix
- Exportable run reports in `TXT` and `JSON`
- Real-time dashboard charts
- Thread lifecycle visualization
- Race-condition and mutex-lock demo
- Code samples in C++, Java, and Python
- Animated system architecture and thread monitor table

## Tech Stack

- HTML5
- CSS3
- JavaScript (Vanilla)
- [Chart.js](https://www.chartjs.org/)
- [Prism.js](https://prismjs.com/)

## Project Structure

```text
.
├── index.html
├── style.css
├── simulation.js
├── charts.js
├── ui.js
├── README.md
└── IMPROVEMENTS_NOTES.txt
```

### File Guide

- [`index.html`](./index.html): page layout and all UI sections
- [`style.css`](./style.css): styling, layout, and responsive behavior
- [`simulation.js`](./simulation.js): simulator engine, metrics, presets, export, lifecycle, concurrency demo
- [`charts.js`](./charts.js): real-time dashboard charts
- [`ui.js`](./ui.js): animation helpers, keyboard shortcuts, toasts, and responsive canvas behavior
- [`IMPROVEMENTS_NOTES.txt`](./IMPROVEMENTS_NOTES.txt): roadmap and future enhancement ideas

## Getting Started

### Option 1: Open Directly

Open [`index.html`](./index.html) in a browser.

### Option 2: Run a Local Static Server

If you prefer serving it locally:

```bash
# Python
python -m http.server
```

Then open:

```text
http://localhost:8000
```

## How To Use

1. Open the simulator.
2. Select a preset or tune the controls manually.
3. Choose:
   - worker thread count
   - queue capacity
   - task duration
   - arrival rate
   - scheduling policy
   - overflow policy
   - task type
4. Start the simulation.
5. Observe:
   - the task queue
   - worker thread states
   - live metrics
   - charts
   - thread monitor
   - summary panel
6. Export the report if needed.

## Sections

- `Home`: introduction and animated overview
- `Concepts`: thread-pool and concurrency fundamentals
- `Simulator`: interactive live simulation
- `Dashboard`: chart-based analytics
- `Lifecycle`: thread lifecycle visualization
- `Concurrency`: race condition vs mutex demo
- `Performance`: with-vs-without thread pool comparison
- `Code`: language examples
- `Architecture`: animated request/task flow
- `Monitor`: live thread table

## Keyboard Shortcuts

- `Space`: start / pause
- `T`: add task manually
- `R`: reset simulation
- `A`: animate architecture
- `L`: animate lifecycle

## Reliability Notes

- Chart rendering depends on Chart.js CDN
- Code highlighting depends on Prism.js CDN
- The app is built to fail gracefully if those libraries do not load

## Verification

The current version was checked for:

- JavaScript syntax with `node --check`
- valid HTML `onclick` handler mappings
- matching DOM IDs used by JavaScript
- cleaned text encoding issues

## Repository Improvements You Can Add Later

- screenshots or GIF previews in the README
- GitHub Pages deployment
- modular JavaScript structure
- additional analytics charts
- accessibility and mobile UX refinements

## License

Add a license section here if you plan to publish the repository publicly.
