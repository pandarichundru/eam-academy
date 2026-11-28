/* Cooling-water pump installation used in the Academy's training example. */
(() => {
  const swapIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.65" aria-hidden="true"><path d="M3 8h16l-4-4m6 12H5l4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const systemIcon = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12c0-3 4-6 6-10 2 4 6 7 6 10a6 6 0 0 1-12 0Z"/><path d="M7 12a3 3 0 0 0 3 3" stroke-linecap="round"/></svg>';

  function illustration() {
    return `<svg class="pumpsim-drawing" viewBox="0 0 520 182" aria-hidden="true" focusable="false">
      <g class="pumpsim-datum" fill="none">
        <path d="M14 146h36m-18-5v10m440-5h27m-14-5v10M458 42h32m-16-9v18"/>
        <path d="M8 102h495" stroke-dasharray="5 6"/>
      </g>
      <!-- Anchored Suction & Discharge Piping -->
      <g class="pumpsim-pipes" stroke-linejoin="round">
        <path d="M-4 90h108l21 3h21v17h-21l-21 3H-4Z"/>
        <path d="M68 -5h17v22q0 8 9 8h63q23 0 23 23v19h-17V48q0-6-7-6H93q-25 0-25-25Z"/>
        <path d="M63 2h27v6H63zM78 22l9-5 4 6-9 6zM124 21h6v26h-6zM156 58h27v6h-27zM42 87h7v30h-7zM107 87h6v29h-6z"/>
        <path class="pumpsim-pipe-shine" d="M0 95h100M74 12v4q0 17 19 17h30M136 31h17"/>
      </g>
      <!-- Anchored Baseplate / Skid -->
      <g class="pumpsim-skid" stroke-linejoin="round">
        <path d="m110 142 12-8h310l11 8-9 8H110Z"/>
        <path d="M110 142h333l-9 7H110zM124 150h15v6h-15zM408 150h15v6h-15z"/>
        <path d="M92 157h366" fill="none"/>
      </g>
      <!-- Swappable Pump + Coupling + Motor Assembly -->
      <g class="pumpsim-unit" stroke-linejoin="round" stroke-linecap="round">
        <g class="pumpsim-machine">
          <!-- Mounting feet -->
          <path d="m142 140 10-23 13 2-7 21Zm41 0-4-25 13-1 8 26Zm99 0 8-22h17l-7 22Zm88 0-4-22h16l8 22Z"/>
          <path d="M135 137h30v5h-30zM179 137h24v5h-24zM277 137h29v5h-29zM366 137h29v5h-29z"/>
          <!-- Volute casing -->
          <path d="M166 70h15c21 0 36 12 39 30 0 18-13 32-35 33-18 2-37-9-38-29V88h13V70Z"/>
          <path d="M153 66h31v5h-31z"/>
          <path class="pumpsim-face" d="M147 84c6-7 18-10 28-8 16 2 26 16 24 31s-16 27-32 25c-15-1-29-14-29-29 0-7 4-14 9-19Z"/>
          <path class="pumpsim-detail" d="M151 89c5-7 13-11 21-10m14 36c7-7 8-18 3-25"/>
          <!-- Suction nozzle -->
          <path d="M122 92h14l11-7h7v34h-7l-11-8h-14Z"/>
          <path class="pumpsim-face" d="M119 87h6v29h-6zm33-3h5v36h-5z"/>
          <g class="pumpsim-bolts">
            <circle cx="163" cy="82" r="2"/><circle cx="185" cy="90" r="2"/><circle cx="186" cy="115" r="2"/><circle cx="164" cy="124" r="2"/>
          </g>
          <!-- Shaft & Mechanical Seal (highlighted in amber when inspecting seal/A) -->
          <path d="M210 89h10l8 5h25v15h-25l-8 5h-10z"/>
          <rect class="pumpsim-seal" x="211" y="91" width="11" height="21" rx="2"/>
          <path class="pumpsim-detail" d="M216.5 92v19"/>
          <!-- Flexible Coupling Guard -->
          <path d="M225 97h45v9h-45z"/>
          <path class="pumpsim-face" d="M235 87h28l5 6v19h-35V93Z"/>
          <path class="pumpsim-detail" d="M239 93v15m5-15v15m5-15v15m5-15v15m5-15v15"/>
          <!-- Electric Drive Motor -->
          <path d="M268 83q4-10 18-13h83l16 6 12 12v26l-12 12-16 5h-83q-14-2-18-13Z"/>
          <path class="pumpsim-face" d="M279 77h9v47h-9zm91-6 11 4v51l-11 4z"/>
          <path d="M383 77q20 3 23 17v13q-3 12-23 16Z"/>
          <path class="pumpsim-detail" d="M391 83v36m5-33v30m5-25v19M297 78h66m-68 7h68m-68 7h68m-68 22h68m-66 8h66"/>
          <g class="pumpsim-a">
            <path d="M289 69v-12l5-4h22l5 4v12Z"/><path class="pumpsim-detail" d="M291 58h28m-14 1v8M159 113l7 5m18-20 7 3"/>
          </g>
          <g class="pumpsim-b">
            <path d="M334 69V57l6-6h26v18Z"/><path class="pumpsim-detail" d="M337 57h27m-18 2v6m6-6v6M170 86l-1 7m13 5 8-1m-11 12 6 6"/>
          </g>
          <rect class="pumpsim-plate" x="298" y="95" width="62" height="16" rx="2"/>
          <text data-pump-plate x="329" y="106.5" text-anchor="middle">P-101A</text>
        </g>
      </g>
    </svg>`;
  }

  function assetControl(unit, status) {
    return `<button type="button" class="pumpsim-asset" data-pump-history="${unit}" aria-expanded="false">
      <span class="pumpsim-id">P-101${unit}</span>
      <span data-pump-status="${unit}">${status}</span>
    </button>`;
  }

  window.pumpScene = function pumpScene(context) {
    const variant = context === 'lesson' ? 'lesson' : 'home';
    const interactive = context !== 'welcome';
    return `<section class="pumpsim pumpsim--${variant}" data-pump-scene data-installed="A" data-inspecting="seal" aria-label="Pump swap training example">
      <header class="pumpsim-head">
        <p>${systemIcon} Cooling-water system</p>
        <h2>North pump room</h2>
      </header>
      <div class="pumpsim-sheet">
        ${illustration()}
        <div class="pumpsim-callouts" aria-label="Pump components">
          ${Object.keys(componentNotes).map(name=>interactive?`<button type="button" class="pumpsim-callout" data-component="${name}" aria-pressed="false">${name}</button>`:`<span class="pumpsim-callout">${name}</span>`).join('')}
        </div>
        <div class="pumpsim-position"><span>Duty position</span> <b>CW-DUTY</b></div>
      </div>
      ${interactive ? `<p data-component-note hidden aria-live="polite"></p><div class="pumpsim-controls">
        <p aria-live="polite" aria-atomic="true" data-pump-message><strong>P-101A</strong> is installed at <code>CW-DUTY</code>.</p>
        <button type="button" class="pumpsim-swap" data-pump-swap>${swapIcon}<span>Swap pump</span></button>
      </div>
      <div class="pumpsim-records">
        <div class="pumpsim-record-label">Example asset histories (click to inspect where the seal repair lives)</div>
        <div class="pumpsim-assets" role="group" aria-label="Example asset histories">${assetControl('A', 'Installed · Seal repaired')}${assetControl('B', 'Spare in store')}</div>
        <div class="pumpsim-history" data-pump-panel aria-live="polite" aria-atomic="true" hidden></div>
      </div>` : ''}
    </section>`;
  };

  const componentNotes = {
    'Volute':'The spiral casing collects water leaving the impeller and directs it toward the outlet.',
    'Mechanical seal':'The seal limits leakage around the rotating shaft. The example repair belongs to the physical pump.',
    'Coupling':'The coupling transmits rotation from the motor shaft to the pump shaft.',
    'Motor':'The electric motor drives the pump through the coupling.'
  };
  const exampleHistories = {
    A: [['05 May', 'Replaced the leaking mechanical seal at CW-DUTY. One seal was issued to the repair order.']],
    B: [['12 May', 'Inspected the spare pump in stores.']]
  };

  function showHistory(scene, unit) {
    const panel = scene.querySelector('[data-pump-panel]');
    scene.dataset.inspecting = unit === 'A' ? 'seal' : unit === 'B' ? 'B' : 'seal';
    scene.querySelectorAll('[data-pump-history]').forEach(button => {
      button.setAttribute('aria-expanded', String(button.dataset.pumpHistory === unit));
    });
    if (!unit) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    const events = exampleHistories[unit].slice();
    if (scene.dataset.installed === 'B') {
      events.push(['20 May', unit === 'A' ? 'Removed from CW-DUTY. The seal repair stays attached to P-101A.' : 'Installed at CW-DUTY in the north pump room.']);
    }
    panel.hidden = false;
    panel.innerHTML = `<strong>P-101${unit} asset record</strong><ul>${events.map(([date, summary]) =>
      `<li><span>${date}</span><span>${summary}</span></li>`).join('')}</ul>`;
  }

  document.addEventListener('click', event => {
    const part=event.target.closest('[data-component]');
    if(part){
      const scene=part.closest('[data-pump-scene]'),note=scene.querySelector('[data-component-note]');
      scene.querySelectorAll('[data-component]').forEach(b=>b.setAttribute('aria-pressed',String(b===part)));
      note.hidden=false;note.textContent=componentNotes[part.dataset.component];return;
    }
    const button = event.target.closest('button[data-pump-swap], button[data-pump-history]');
    if (!button) return;
    const scene = button.closest('[data-pump-scene]');
    if (!scene) return;
    if (button.hasAttribute('data-pump-history')) {
      showHistory(scene, button.getAttribute('aria-expanded') === 'true' ? '' : button.dataset.pumpHistory);
      return;
    }
    const swapped = scene.dataset.installed === 'A';
    const installed = swapped ? 'B' : 'A';
    scene.dataset.installed = installed;
    scene.classList.remove('is-swapping');
    void scene.offsetWidth;
    scene.classList.add('is-swapping');
    scene.querySelector('[data-pump-plate]').textContent = 'P-101' + installed;
    scene.querySelector('[data-pump-message]').innerHTML = swapped
      ? '<strong>P-101B</strong> is now at <code>CW-DUTY</code>. Open <strong>P-101A</strong> below to verify its seal history.'
      : '<strong>P-101A</strong> is installed at <code>CW-DUTY</code>.';
    scene.querySelector('[data-pump-status="A"]').textContent = swapped ? 'Removed · Seal repair stays here' : 'Installed · Seal repaired';
    scene.querySelector('[data-pump-status="B"]').textContent = swapped ? 'Installed at CW-DUTY' : 'Spare in store';
    button.querySelector('span').textContent = swapped ? 'Reset example' : 'Swap pump';
    if (swapped) showHistory(scene, 'A');
    else {
      const openHistory = scene.querySelector('[data-pump-history][aria-expanded="true"]');
      if (openHistory) showHistory(scene, openHistory.dataset.pumpHistory);
    }
  });
})();
