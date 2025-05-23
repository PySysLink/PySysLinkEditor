// simulationView.ts

declare const acquireVsCodeApi: any;

interface SimulationConfig {
  duration: number;
  steps: number;
  realTime: boolean;
}
interface ProgressMessage { progress: number; }
interface ResultMessage { result: any; }
interface ErrorMessage { error: string; }

const vscode = acquireVsCodeApi();
let isRunning = false;

/**
 * Build the form and status area.
 */
function buildUI() {
  const root = document.getElementById('app')!;
  root.innerHTML = '';

  // Form container
  const form = document.createElement('vscode-form-container') as any;

  // Duration
  form.appendChild(makeFormGroup('duration', 'Duration (s)', 'number', '5'));
  // Steps
  form.appendChild(makeFormGroup('steps',   'Steps',         'number', '10'));
  // Real-time toggle
  const grp = document.createElement('vscode-form-group') as any;
  const lbl = document.createElement('vscode-label');
  lbl.textContent = 'Real-time';
  lbl.setAttribute('for', 'realTime');
  const chk = document.createElement('vscode-checkbox') as any;
  chk.id = 'realTime';
  grp.appendChild(lbl);
  grp.appendChild(chk);
  form.appendChild(grp);

  // Buttons
  const runBtn  = document.createElement('vscode-button') as any;
  runBtn.id = 'runBtn';
  runBtn.appearance = 'cta';
  runBtn.textContent = 'Run';
  runBtn.addEventListener('click', onRun);

  const stopBtn = document.createElement('vscode-button') as any;
  stopBtn.id = 'stopBtn';
  stopBtn.disabled = true;
  stopBtn.textContent = 'Stop';
  stopBtn.addEventListener('click', onStop);

  form.appendChild(runBtn);
  form.appendChild(stopBtn);

  // Progress bar
  const progressBar = document.createElement('vscode-progress-ring') as any;
  progressBar.id = 'progressBar';
  progressBar.hidden = true;

  // Status message
  const status = document.createElement('div');
  status.id = 'status';
  status.style.marginTop = '10px';

  root.appendChild(form);
  root.appendChild(progressBar);
  root.appendChild(status);
}

/** Helper: create a form-group with a text/number field */
function makeFormGroup(
  id: string,
  label: string,
  type: 'text' | 'number',
  defaultValue: string
) {
  const group = document.createElement('vscode-form-group') as any;
  const lbl = document.createElement('vscode-label');
  lbl.setAttribute('for', id);
  lbl.textContent = label;
  const input = document.createElement('vscode-textfield') as any;
  input.id = id;
  input.setAttribute('type', type);
  input.value = defaultValue;
  group.appendChild(lbl);
  group.appendChild(input);
  return group;
}

/** Gather form values into a SimulationConfig */
function readConfig(): SimulationConfig {
  const duration = Number((document.getElementById('duration') as any).value);
  const steps    = Number((document.getElementById('steps')   as any).value);
  const realTime = (document.getElementById('realTime')  as any).checked;
  return { duration, steps, realTime };
}

/** Handle Run button */
function onRun() {
  if (isRunning) { return; }
  const cfg = readConfig();
  isRunning = true;
  toggleButtons();
  clearStatus();
  showProgress(0);

  // JSON-RPC–style request
  vscode.postMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'runSimulation',
    params: cfg
  });
}

/** Handle Stop button */
function onStop() {
  if (!isRunning) { return; }
  isRunning = false;
  toggleButtons();
  vscode.postMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'stopSimulation'
  });
}

/** Enable/disable buttons based on isRunning */
function toggleButtons() {
  (document.getElementById('runBtn')  as any).disabled = isRunning;
  (document.getElementById('stopBtn') as any).disabled = !isRunning;
  (document.getElementById('progressBar') as any).hidden = !isRunning;
}

/** Update progress bar */
function showProgress(pct: number) {
  const ring = document.getElementById('progressBar') as any;
  ring.value = pct / 100;
  ring.label = `${pct}%`;
  updateStatus(`Progress: ${pct}%`);
}

/** Display messages below the form */
function updateStatus(text: string, isError = false) {
  const status = document.getElementById('status')!;
  status.textContent = text;
  status.style.color = isError ? 'var(--vscode-errorForeground)' : '';
}
function clearStatus() {
  updateStatus('');
}

/** Handle incoming messages from the extension */
window.addEventListener('message', (event) => {
  const msg = event.data as any;

  // JSON-RPC–style progress notification
  if (msg.method === 'progress' && msg.params) {
    const { progress } = msg.params as ProgressMessage;
    showProgress(progress);
    return;
  }

  // JSON-RPC–style response
  if (msg.id === 1 && msg.result) {
    isRunning = false;
    toggleButtons();
    updateStatus(`Completed: ${JSON.stringify(msg.result)}`);
    return;
  }

  // JSON-RPC–style error
  if (msg.id === 1 && msg.error) {
    isRunning = false;
    toggleButtons();
    updateStatus(`Error: ${msg.error.message}`, true);
    return;
  }

  // Stop response (id === 2)
  if (msg.id === 2) {
    isRunning = false;
    toggleButtons();
    updateStatus('Simulation stopped.');
    return;
  }

  console.warn('Unknown message:', msg);
});

// Build UI on load
document.addEventListener('DOMContentLoaded', buildUI);

// Notify extension that we’re ready
vscode.postMessage({ jsonrpc: '2.0', method: 'ready' });
