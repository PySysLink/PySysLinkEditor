// simulationView.ts

declare const acquireVsCodeApi: any;

interface SimulationConfig {
  start_time: number;
  stop_time: number;
  run_in_natural_time: boolean;
  natural_time_speed_multiplier: number;
  simulation_options_file: string;
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

  // Start Time
  form.appendChild(makeFormGroup('start_time', 'Start Time', 'number', '0'));
  // Stop Time
  form.appendChild(makeFormGroup('stop_time', 'Stop Time', 'number', '10'));
  // Natural Time Multiplier
  form.appendChild(makeFormGroup('natural_time_speed_multiplier', 'Natural Time Multiplier', 'number', '1'));
  // Run in Natural Time (checkbox)
  const grpNatural = document.createElement('vscode-form-group') as any;
  const lblNatural = document.createElement('vscode-label');
  lblNatural.textContent = 'Run in Natural Time';
  lblNatural.setAttribute('for', 'run_in_natural_time');
  const chkNatural = document.createElement('vscode-checkbox') as any;
  chkNatural.id = 'run_in_natural_time';
  chkNatural.addEventListener('change', notifyConfigChanged);
  grpNatural.appendChild(lblNatural);
  grpNatural.appendChild(chkNatural);
  form.appendChild(grpNatural);

  // Simulation Options File (text field + browse button)
  const grpFile = document.createElement('vscode-form-group') as any;
  const lblFile = document.createElement('vscode-label');
  lblFile.textContent = 'Simulation Options File';
  lblFile.setAttribute('for', 'simulation_options_file');
  const inputFile = document.createElement('vscode-textfield') as any;
  inputFile.id = 'simulation_options_file';
  inputFile.setAttribute('type', 'text');
  inputFile.setAttribute('placeholder', 'Select a file...');
  inputFile.addEventListener('input', notifyConfigChanged);
  const browseBtn = document.createElement('vscode-button') as any;
  browseBtn.textContent = 'Browse';
  browseBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'openSimulationOptionsFileSelector' });
  });
  grpFile.appendChild(lblFile);
  grpFile.appendChild(inputFile);
  grpFile.appendChild(browseBtn);
  form.appendChild(grpFile);

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
  input.addEventListener('input', notifyConfigChanged);
  group.appendChild(lbl);
  group.appendChild(input);
  return group;
}

/** Gather form values into a SimulationConfig */
function readConfig(): SimulationConfig {
  const start_time = Number((document.getElementById('start_time') as any).value);
  const stop_time = Number((document.getElementById('stop_time') as any).value);
  const run_in_natural_time = (document.getElementById('run_in_natural_time') as any).checked;
  const natural_time_speed_multiplier = Number((document.getElementById('natural_time_speed_multiplier') as any).value);
  const simulation_options_file = (document.getElementById('simulation_options_file') as any).value;
  return { start_time, stop_time, run_in_natural_time, natural_time_speed_multiplier: natural_time_speed_multiplier, simulation_options_file };
}

function notifyConfigChanged() {
  const cfg = readConfig();
  vscode.postMessage({
    type: 'simulationConfigChanged',
    config: cfg
  });
}

/** Handle Run button */
function onRun() {
  if (isRunning) { return; }
  const cfg = readConfig();
  isRunning = true;
  toggleButtons();
  clearStatus();
  showProgress(0);

  vscode.postMessage({
    type: 'runSimulation',
    params: cfg
  });
}

/** Handle Stop button */
function onStop() {
  if (!isRunning) { return; }
  isRunning = false;
  toggleButtons();
  vscode.postMessage({
    type: 'stopSimulation'
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

  if (msg.type === 'progress' && msg.params) {
    const { progress } = msg.params as ProgressMessage;
    showProgress(progress);
    return;
  }

  if (msg.type === 'completed' && msg.result) {
    isRunning = false;
    toggleButtons();
    updateStatus(`Completed: ${JSON.stringify(msg.result)}`);
    return;
  }

  // JSON-RPC–style error
  if (msg.type === 'error' && msg.error) {
    isRunning = false;
    toggleButtons();
    updateStatus(`Error: ${msg.error.message}`, true);
    return;
  }

  if (msg.type === 'setSimulationConfig' && msg.config) {
    const cfg = msg.config;
    (document.getElementById('start_time') as any).value = cfg.start_time ?? '';
    (document.getElementById('stop_time') as any).value = cfg.stop_time ?? '';
    (document.getElementById('natural_time_speed_multiplier') as any).value = cfg.natural_time_speed_multiplier ?? '';
    (document.getElementById('run_in_natural_time') as any).checked = !!cfg.run_in_natural_time;
    (document.getElementById('simulation_options_file') as any).value = cfg.simulation_options_file ?? '';
    updateStatus('Simulation configuration loaded.');
    return;
  }

  console.warn('Unknown message:', msg);
});

// Build UI on load
document.addEventListener('DOMContentLoaded', buildUI);

// Notify extension that we’re ready
vscode.postMessage({ jsonrpc: '2.0', method: 'ready' });
