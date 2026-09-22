(() => {
  'use strict';

  const elements = {
    source: document.querySelector('#source-prompt'),
    ratio: document.querySelector('#aspect-ratio'),
    resolution: document.querySelector('#resolution'),
    resultPanel: document.querySelector('#result-panel'),
    resultTitle: document.querySelector('#result-title'),
    resultStatus: document.querySelector('#result-status'),
    output: document.querySelector('#prompt-output'),
    original: document.querySelector('#original-output'),
    repaired: document.querySelector('#repaired-output'),
    changeCount: document.querySelector('#change-count'),
    checks: document.querySelector('#checks'),
    parsed: document.querySelector('#parsed-groups'),
    run: document.querySelector('#translate-button'),
    copy: document.querySelector('#copy-button'),
    error: document.querySelector('#prompt-error'),
    convertedResult: document.querySelector('#converted-result'),
    convertedTitle: document.querySelector('#converted-title'),
    convertedOutput: document.querySelector('#converted-output'),
    copyConverted: document.querySelector('#copy-converted')
  };

  let rules = null;
  let latestResult = null;
  const track = (name) => { try { if (window.clarity) window.clarity('event', name); } catch (_) {} };

  function setButtonState(text, disabled) {
    elements.run.firstChild.textContent = `${text} `;
    elements.run.disabled = disabled;
  }

  function createChip(text, kind) {
    const chip = document.createElement('span');
    chip.className = `parsed-chip ${kind || ''}`.trim();
    chip.textContent = text;
    return chip;
  }

  function renderParsed(result) {
    elements.parsed.replaceChildren();
    const migratedReferences = result.parameters
      .filter((param) => param.canonical === 'edit' && /^https?:\/\//i.test(param.value))
      .map((param) => param.value);
    const imageReferences = Array.from(new Set([...result.parsed.imageReferences, ...migratedReferences]));
    const groups = [
      { label: 'Description', values: result.parsed.description ? [result.parsed.description] : [], kind: 'description' },
      { label: 'Image references', values: imageReferences, kind: 'reference' },
      { label: 'Parameters', values: result.parameters.map((param) => `--${param.alias}${param.value ? ` ${param.value}` : ''}`), kind: 'parameter' }
    ];
    groups.forEach((group) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'parsed-group';
      const heading = document.createElement('h4');
      heading.textContent = group.label;
      wrapper.appendChild(heading);
      const values = document.createElement('div');
      values.className = 'parsed-values';
      if (group.values.length) group.values.forEach((value) => values.appendChild(createChip(value, group.kind)));
      else values.appendChild(createChip('None found', 'empty'));
      wrapper.appendChild(values);
      elements.parsed.appendChild(wrapper);
    });
  }

  function renderIssues(issues) {
    elements.checks.replaceChildren();
    if (!issues.length) {
      const empty = document.createElement('div');
      empty.className = 'report-empty';
      empty.innerHTML = '<strong>No compatibility problems found.</strong><span>The prompt already uses syntax recognized by the current V8.2 rule set.</span>';
      elements.checks.appendChild(empty);
      return;
    }
    issues.forEach((issue) => {
      const item = document.createElement('article');
      item.className = `check-item ${issue.severity}`;
      const badge = issue.severity === 'review' ? 'Review' : issue.severity === 'info' ? 'Added' : 'Fixed';
      item.innerHTML = `<div class="issue-top"><span class="issue-badge">${badge}</span><h4></h4></div><p></p><div class="issue-change"><span><small>Before</small><code></code></span><b aria-hidden="true">→</b><span><small>After</small><code></code></span></div><a target="_blank" rel="noopener">Official source ↗</a>`;
      item.querySelector('h4').textContent = issue.title;
      item.querySelector('p').textContent = issue.reason;
      const codes = item.querySelectorAll('code');
      codes[0].textContent = issue.before;
      codes[1].textContent = issue.after;
      item.querySelector('a').href = issue.source;
      elements.checks.appendChild(item);
    });
  }

  function renderResult(result) {
    latestResult = result;
    const reviewCount = result.issues.filter((issue) => issue.severity === 'review').length;
    const fixedCount = result.issues.filter((issue) => issue.severity === 'fixed').length;
    elements.output.textContent = result.repaired;
    elements.original.textContent = result.original;
    elements.repaired.textContent = result.repaired;
    elements.resultTitle.textContent = reviewCount ? 'V8.2 prompt needs review' : 'V8.2 prompt ready';
    elements.resultStatus.className = `result-status ${reviewCount ? 'review' : 'ready'}`;
    elements.resultStatus.textContent = reviewCount ? `${reviewCount} item${reviewCount === 1 ? '' : 's'} to review` : `${fixedCount} automatic fix${fixedCount === 1 ? '' : 'es'}`;
    elements.changeCount.textContent = `${result.issues.length} explained change${result.issues.length === 1 ? '' : 's'}`;
    renderIssues(result.issues);
    renderParsed(result);
    elements.convertedResult.hidden = true;
    elements.resultPanel.hidden = false;
    track('v82_checker_used');
    elements.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function runCheck() {
    const value = elements.source.value.trim();
    if (!value) {
      elements.source.setAttribute('aria-invalid', 'true');
      elements.error.hidden = false;
      elements.source.focus();
      return;
    }
    elements.source.removeAttribute('aria-invalid');
    elements.error.hidden = true;
    try {
      renderResult(window.PromptEngine.repairPrompt(value, rules, { aspect: elements.ratio.value, resolution: elements.resolution.value }));
    } catch (_) {
      elements.error.textContent = 'The prompt could not be checked. Reload the page and try again.';
      elements.error.hidden = false;
      track('v82_checker_error');
    }
  }

  async function copyText(text, button, defaultLabel) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
      track('result_copied');
      window.setTimeout(() => { button.textContent = defaultLabel; }, 1800);
    } catch (_) {
      button.textContent = 'Select and copy manually';
    }
  }

  async function loadRules() {
    setButtonState('Loading V8.2 rules…', true);
    try {
      const response = await fetch('data/v8.2-rules.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Rules request failed: ${response.status}`);
      rules = await response.json();
      setButtonState('Check & upgrade to V8.2', false);
    } catch (_) {
      setButtonState('Rules unavailable — reload', true);
      elements.error.textContent = 'The compatibility rules did not load. Reload this page before checking a prompt.';
      elements.error.hidden = false;
    }
  }

  elements.run.addEventListener('click', runCheck);
  elements.source.addEventListener('input', () => {
    if (elements.source.value.trim()) {
      elements.source.removeAttribute('aria-invalid');
      elements.error.hidden = true;
    }
  });
  elements.source.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runCheck();
  });
  document.querySelector('#sample-button').addEventListener('click', () => {
    elements.source.value = 'Editorial product photo of a sculptural orange chair::2 in a brutalist concrete room, soft morning light --v 8 --q 2 --oref https://example.com/chair.jpg --ow 250 --ar 16:9 --hd';
    elements.source.removeAttribute('aria-invalid');
    elements.error.hidden = true;
    elements.source.focus();
  });
  elements.copy.addEventListener('click', () => copyText(elements.output.textContent, elements.copy, 'Copy result'));
  document.querySelectorAll('[data-convert]').forEach((button) => button.addEventListener('click', () => {
    if (!latestResult) return;
    const model = button.dataset.convert;
    elements.convertedTitle.textContent = model === 'flux' ? 'FLUX prompt' : 'Ideogram prompt';
    elements.convertedOutput.textContent = window.PromptEngine.convert(latestResult, model);
    elements.convertedResult.hidden = false;
    track(`secondary_export_${model}`);
  }));
  elements.copyConverted.addEventListener('click', () => copyText(elements.convertedOutput.textContent, elements.copyConverted, 'Copy'));
  document.querySelector('#interest-button').addEventListener('click', () => {
    localStorage.setItem('modelPromptLabEarlyAccessInterest', new Date().toISOString());
    document.querySelector('#interest-status').textContent = 'Interest saved. Payment is not open yet; check back after the free tool is validated.';
    track('early_access_interest');
  });

  loadRules();
})();
