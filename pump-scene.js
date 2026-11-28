/* Cooling-water pump installation used in the Academy's training example. */
(() => {
  const swapIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.65" aria-hidden="true"><path d="M3 8h16l-4-4m6 12H5l4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const systemIcon = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12c0-3 4-6 6-10 2 4 6 7 6 10a6 6 0 0 1-12 0Z"/><path d="M7 12a3 3 0 0 0 3 3" stroke-linecap="round"/></svg>';

  function illustration() {
    return `<svg class="pumpsim-drawing" viewBox="0 0 500 168" aria-hidden="true" focusable="false">
      <g class="pumpsim-datum" fill="none">
        <path d="M14 136h36m-18-5v10m425-5h27m-14-5v10M444 37h32m-16-9v18"/>
        <path d="M8 95h475" stroke-dasharray="5 6"/>
      </g>
      <g class="pumpsim-pipes" stroke-linejoin="round">
        <path d="M-4 84h103l21 3h21v16h-21l-21 3H-4Z"/>
        <path d="M63 -5h16v21q0 8 9 8h61q22 0 22 22v18h-16V46q0-6-7-6H87q-24 0-24-24Z"/>
        <path d="M58 2h26v6H58zM73 21l9-5 4 6-9 6zM119 20h6v25h-6zM150 55h26v6h-26zM39 81h7v29h-7zM102 81h6v28h-6z"/>
        <path class="pumpsim-pipe-shine" d="M0 89h97M69 12v4q0 16 19 16h29M130 30h16"/>
      </g>
      <g class="pumpsim-skid" stroke-linejoin="round">
        <path d="m106 133 12-8h299l11 8-9 8H106Z"/>
        <path d="M106 133h322l-9 7H106zM119 141h15v6h-15zM395 141h15v6h-15z"/>
        <path d="M89 148h350" fill="none"/>
      </g>
      <g class="pumpsim-unit" stroke-linejoin="round" stroke-linecap="round">
        <g class="pumpsim-machine">
          <path d="m137 131 10-23 13 2-7 21Zm40 0-4-25 13-1 8 26Zm96 0 8-22h17l-7 22Zm85 0-4-22h16l8 22Z"/>
          <path d="M130 128h30v5h-30zM174 128h24v5h-24zM269 128h29v5h-29zM355 128h29v5h-29z"/>
          <path d="M161 65h14c21 0 36 12 39 29 0 18-13 31-34 32-18 2-37-9-38-28V82h13V65Z"/>
          <path d="M148 61h30v5h-30z"/>
          <path class="pumpsim-face" d="M142 78c6-7 18-10 28-8 16 2 26 16 24 31s-16 27-32 25c-15-1-29-14-29-29 0-7 4-14 9-19Z"/>
          <path class="pumpsim-detail" d="M146 83c5-7 13-11 21-10m14 36c7-7 8-18 3-25"/>
          <path d="M118 86h14l11-7h7v33h-7l-11-8h-14Z"/>
          <path class="pumpsim-face" d="M115 81h6v28h-6zm32-3h5v35h-5z"/>
          <g class="pumpsim-bolts">
            <circle cx="158" cy="76" r="2"/><circle cx="180" cy="84" r="2"/><circle cx="181" cy="109" r="2"/><circle cx="159" cy="118" r="2"/>
          </g>
          <path d="M205 82h9l8 5h24v15h-24l-8 5h-9zM219 90h44v9h-44z"/>
          <path class="pumpsim-face" d="M229 81h27l5 6v18h-34V87Z"/>
          <path class="pumpsim-detail" d="M233 87v14m5-14v14m5-14v14m5-14v14m5-14v14"/>
          <path d="M261 77q4-10 18-13h81l16 6 12 12v25l-12 12-16 5h-81q-14-2-18-13Z"/>
          <path class="pumpsim-face" d="M272 71h9v46h-9zm89-6 11 4v50l-11 4z"/>
          <path d="M374 71q20 3 23 17v13q-3 12-23 16Z"/>
          <path class="pumpsim-detail" d="M382 77v35m5-32v29m5-24v18M289 72h64m-66 7h66m-66 7h66m-66 22h66m-64 8h64"/>
          <g class="pumpsim-a">
            <path d="M281 63v-12l5-4h22l5 4v12Z"/><path class="pumpsim-detail" d="M283 52h28m-14 1v8M154 107l7 5m18-20 7 3"/>
          </g>
          <g class="pumpsim-b">
            <path d="M325 63V51l6-6h26v18Z"/><path class="pumpsim-detail" d="M328 51h27m-18 2v6m6-6v6M165 80l-1 7m13 5 8-1m-11 12 6 6"/>
          </g>
          <rect class="pumpsim-plate" x="290" y="89" width="61" height="16" rx="2"/>
          <text data-pump-plate x="320.5" y="100.5" text-anchor="middle">P-101A</text>
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
    return `<section class="pumpsim pumpsim--${variant}" data-pump-scene data-installed="A" aria-label="Pump swap training example">
      <header class="pumpsim-head">
        <p>${systemIcon} Cooling-water system</p>
        <h2>North pump room</h2>
      </header>
      <div class="pumpsim-sheet">
        ${illustration()}
        <div class="pumpsim-position"><span>Duty position</span> <b>CW-DUTY</b></div>
      </div>
      <div class="pumpsim-controls">
        <p aria-live="polite" aria-atomic="true" data-pump-message><strong>P-101A</strong> is installed.</p>
        <button type="button" class="pumpsim-swap" data-pump-swap>${swapIcon}<span>Swap pump</span></button>
      </div>
      <div class="pumpsim-records">
        <div class="pumpsim-record-label">Example asset histories</div>
        <div class="pumpsim-assets" role="group" aria-label="Example asset histories">${assetControl('A','Installed')}${assetControl('B','Spare')}</div>
        <div class="pumpsim-history" data-pump-panel aria-live="polite" aria-atomic="true" hidden></div>
      </div>
    </section>`;
  };

  const exampleHistories = {
    A: [['05 May', 'Replaced the leaking seal at CW-DUTY. One seal was issued to the repair order.']],
    B: [['12 May', 'Inspected the spare pump in stores.']]
  };

  function showHistory(scene, unit) {
    const panel = scene.querySelector('[data-pump-panel]');
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
      events.push(['20 May', unit === 'A' ? 'Removed from CW-DUTY. The seal repair stays on this asset record.' : 'Installed at CW-DUTY in the north pump room.']);
    }
    panel.hidden = false;
    panel.innerHTML = `<strong>P-101${unit} history</strong><ul>${events.map(([date, summary]) =>
      `<li><span>${date}</span><span>${summary}</span></li>`).join('')}</ul>`;
  }

  document.addEventListener('click', event => {
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
    scene.querySelector('[data-pump-plate]').textContent = 'P-101' + installed;
    scene.querySelector('[data-pump-message]').innerHTML = '<strong>P-101' + installed + '</strong> is installed.';
    scene.querySelector('[data-pump-status="A"]').textContent = swapped ? 'Removed' : 'Installed';
    scene.querySelector('[data-pump-status="B"]').textContent = swapped ? 'Installed' : 'Spare';
    button.querySelector('span').textContent = swapped ? 'Reset example' : 'Swap pump';
    const openHistory = scene.querySelector('[data-pump-history][aria-expanded="true"]');
    if (openHistory) showHistory(scene, openHistory.dataset.pumpHistory);
  });
})();
