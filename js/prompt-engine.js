(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PromptEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const collapse = (value) => value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
  const formatParam = (name, value) => `--${name}${value ? ` ${value}` : ''}`;

  function buildRuleMap(rules) {
    const map = new Map();
    rules.parameters.forEach((rule) => rule.aliases.forEach((alias) => map.set(alias, rule)));
    return map;
  }

  function splitValue(rawValue, valueType) {
    const value = rawValue.trim();
    if (valueType === 'flag') return { value: '', trailing: value };
    if (valueType === 'rest') return { value, trailing: '' };
    const match = value.match(/^(\S+)(?:\s+([\s\S]+))?$/);
    return match ? { value: match[1], trailing: (match[2] || '').trim() } : { value: '', trailing: '' };
  }

  function parsePrompt(input, rules) {
    const ruleMap = buildRuleMap(rules);
    const markers = [];
    const pattern = /(?:^|\s)--([a-z][\w-]*)(?=\s|$)/ig;
    let match;
    while ((match = pattern.exec(input))) {
      markers.push({ start: match.index + (match[0].startsWith(' ') ? 1 : 0), nameStart: pattern.lastIndex - match[1].length, nameEnd: pattern.lastIndex, alias: match[1].toLowerCase() });
    }

    let description = collapse(markers.length ? input.slice(0, markers[0].start) : input);
    const parameters = [];
    const placementFragments = [];
    markers.forEach((marker, index) => {
      const nextStart = markers[index + 1]?.start ?? input.length;
      const rawValue = input.slice(marker.nameEnd, nextStart).trim();
      const rule = ruleMap.get(marker.alias);
      const split = splitValue(rawValue, rule?.valueType || 'rest');
      if (split.trailing) placementFragments.push(split.trailing);
      parameters.push({
        alias: marker.alias,
        canonical: rule?.canonical || marker.alias,
        value: split.value,
        raw: input.slice(marker.start, nextStart).trim(),
        rule: rule || null
      });
    });
    if (placementFragments.length) description = collapse(`${description}, ${placementFragments.join(', ')}`);

    const imageReferences = [];
    description = collapse(description.replace(/https?:\/\/\S+/gi, (url) => {
      imageReferences.push(url.replace(/[,.]+$/, ''));
      return '';
    }));
    return { description, imageReferences, parameters, hadTrailingText: placementFragments.length > 0 };
  }

  function parseAspect(value) {
    const match = String(value || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return null;
    return { width, height, extreme: Math.max(width / height, height / width) };
  }

  function repairPrompt(input, rules, options) {
    const parsed = parsePrompt(input, rules);
    const issues = [];
    const kept = new Map();
    const sourceFor = (key) => rules.sources[key] || rules.sources.parameters;
    let description = parsed.description;
    let editReference = '';

    if (/::\s*-?\d*(?:\.\d+)?/.test(description)) {
      const before = description.match(/::\s*-?\d*(?:\.\d+)?/g).join(' ');
      description = collapse(description.replace(/::\s*-?\d*(?:\.\d+)?/g, ', '));
      issues.push({ severity: 'fixed', title: 'Multi-prompt weights removed', reason: 'V8.2 does not support multi-prompt separators or weights. The ideas were retained as comma-separated text.', before, after: 'comma-separated ideas', source: sourceFor('multiprompt') });
    }

    if (parsed.hadTrailingText) {
      issues.push({ severity: 'fixed', title: 'Text moved before parameters', reason: 'Midjourney parameters belong at the end of the prompt. Trailing words were moved back into the description.', before: 'text after a flag', after: 'text before parameters', source: sourceFor('parameters') });
    }

    parsed.parameters.forEach((param) => {
      const rule = param.rule;
      if (!rule) {
        kept.set(`unknown:${param.alias}`, param);
        issues.push({ severity: 'review', title: `Unknown parameter --${param.alias}`, reason: 'This parameter is not in the current rule set, so it was preserved for you to review.', before: param.raw, after: param.raw, source: sourceFor('parameters') });
        return;
      }
      if (kept.has(rule.canonical)) {
        const previous = kept.get(rule.canonical);
        issues.push({ severity: 'fixed', title: `Duplicate --${param.alias} resolved`, reason: 'Only the last value was kept so the result has one unambiguous setting.', before: previous.raw, after: param.raw, source: sourceFor('parameters') });
      }
      if (rule.action === 'remove') {
        issues.push({ severity: 'fixed', title: `${param.raw} removed`, reason: 'The Quality parameter is not supported by V8.2.', before: param.raw, after: 'removed', source: sourceFor(rule.source) });
        return;
      }
      if (rule.action === 'remove-reference-weight') {
        issues.push({ severity: 'fixed', title: `${param.raw} removed`, reason: 'V8.2 replaces legacy character and Omni references with the Edit Model, which has no matching weight parameter.', before: param.raw, after: 'removed', source: sourceFor(rule.source) });
        return;
      }
      if (rule.action === 'migrate-edit') {
        if (param.value) editReference = param.value;
        issues.push({ severity: 'fixed', title: `${param.raw} migrated`, reason: 'V8.2 replaces legacy character and Omni references with the Edit Model.', before: param.raw, after: param.value ? `--edit ${param.value}` : '--edit [attach reference]', source: sourceFor(rule.source) });
        return;
      }
      if (rule.action === 'normalize-version') {
        if (param.value !== rules.targetVersion) issues.push({ severity: 'fixed', title: 'Model version updated', reason: `The prompt explicitly targeted V${param.value || 'unknown'}. It now targets the current V${rules.targetVersion} model.`, before: param.raw, after: `--v ${rules.targetVersion}`, source: sourceFor('version') });
        kept.set('version', { alias: 'v', canonical: 'version', value: rules.targetVersion, raw: `--v ${rules.targetVersion}`, rule });
        return;
      }
      kept.set(rule.canonical, param);
    });

    if (editReference) {
      const editRule = rules.parameters.find((rule) => rule.canonical === 'edit');
      kept.set('edit', { alias: 'edit', canonical: 'edit', value: editReference, raw: `--edit ${editReference}`, rule: editRule });
    }

    const aspectOverride = options?.aspect || '';
    if (aspectOverride) {
      const previous = kept.get('aspect');
      if (!previous || previous.value !== aspectOverride) issues.push({ severity: 'fixed', title: 'Aspect ratio applied', reason: 'The selected canvas ratio overrides the ratio in the pasted prompt.', before: previous?.raw || 'no aspect ratio', after: `--ar ${aspectOverride}`, source: sourceFor('parameters') });
      const aspectRule = rules.parameters.find((rule) => rule.canonical === 'aspect');
      kept.set('aspect', { alias: 'ar', canonical: 'aspect', value: aspectOverride, raw: `--ar ${aspectOverride}`, rule: aspectRule });
    }

    const aspectParam = kept.get('aspect');
    const aspect = parseAspect(aspectParam?.value);
    if (aspectParam && !aspect) {
      kept.delete('aspect');
      issues.push({ severity: 'review', title: 'Invalid aspect ratio removed', reason: 'Use two positive numbers separated by a colon, such as 16:9.', before: aspectParam.raw, after: 'removed', source: sourceFor('parameters') });
    } else if (aspect && aspect.extreme > 14) {
      kept.delete('aspect');
      issues.push({ severity: 'review', title: 'Aspect ratio exceeds 14:1', reason: 'V8.2 supports a maximum aspect ratio of 14:1. Choose a less extreme canvas.', before: aspectParam.raw, after: 'removed', source: sourceFor('version') });
    }

    if (options?.resolution === 'hd') {
      if (!kept.has('hd') || kept.has('sd')) issues.push({ severity: 'info', title: 'HD resolution applied', reason: 'The selected output resolution overrides the resolution in the pasted prompt.', before: kept.has('sd') ? '--sd' : 'no resolution flag', after: '--hd', source: sourceFor('version') });
      kept.delete('sd');
      kept.set('hd', { alias: 'hd', canonical: 'hd', value: '', raw: '--hd', rule: rules.parameters.find((rule) => rule.canonical === 'hd') });
    } else if (options?.resolution === 'sd') {
      if (!kept.has('sd') || kept.has('hd')) issues.push({ severity: 'info', title: 'SD resolution applied', reason: 'The selected output resolution overrides the resolution in the pasted prompt.', before: kept.has('hd') ? '--hd' : 'no resolution flag', after: '--sd', source: sourceFor('version') });
      kept.delete('hd');
      kept.set('sd', { alias: 'sd', canonical: 'sd', value: '', raw: '--sd', rule: rules.parameters.find((rule) => rule.canonical === 'sd') });
    }

    if (kept.has('hd') && kept.has('sd')) {
      kept.delete('sd');
      issues.push({ severity: 'fixed', title: 'Conflicting resolutions resolved', reason: 'A prompt cannot request both SD and HD. HD was retained.', before: '--sd --hd', after: '--hd', source: sourceFor('version') });
    }
    if (kept.has('hd') && aspect && aspect.extreme > 4) {
      kept.delete('hd');
      kept.set('sd', { alias: 'sd', canonical: 'sd', value: '', raw: '--sd', rule: rules.parameters.find((rule) => rule.canonical === 'sd') });
      issues.push({ severity: 'fixed', title: 'HD changed to SD', reason: 'V8.2 HD supports aspect ratios up to 4:1. The wider ratio was preserved and resolution changed to SD.', before: '--hd', after: '--sd', source: sourceFor('version') });
    }

    if (!kept.has('version')) {
      const versionRule = rules.parameters.find((rule) => rule.canonical === 'version');
      kept.set('version', { alias: 'v', canonical: 'version', value: rules.targetVersion, raw: `--v ${rules.targetVersion}`, rule: versionRule });
      issues.push({ severity: 'info', title: 'V8.2 made explicit', reason: 'V8.2 is currently the default. The version flag was added so the saved prompt remains self-describing.', before: 'no version flag', after: `--v ${rules.targetVersion}`, source: sourceFor('version') });
    }

    const ordered = Array.from(kept.values()).sort((a, b) => {
      const order = { aspect: 10, hd: 20, sd: 20, version: 100 };
      return (order[a.canonical] || 50) - (order[b.canonical] || 50);
    });
    const refs = parsed.imageReferences.join(' ');
    const params = ordered.map((param) => formatParam(param.alias === 'version' ? 'v' : param.alias, param.value)).join(' ');
    const repaired = collapse([refs, description, params].filter(Boolean).join(' '));
    return { original: collapse(input), repaired, parsed: { ...parsed, description }, issues, parameters: ordered, aspect: aspectParam?.value || aspectOverride || '' };
  }

  function convert(cleaned, model) {
    const base = cleaned.parsed.description;
    const ratio = cleaned.parameters.find((param) => param.canonical === 'aspect')?.value || '';
    if (model === 'flux') return collapse(`${base}. ${ratio ? `Composition: ${ratio} aspect ratio.` : ''} Prioritize precise subject relationships, natural detail, and coherent lighting.`);
    return collapse(`${base}. ${ratio ? `Canvas: ${ratio}.` : ''} Render any requested words exactly as written, with clear hierarchy and legible typography.`);
  }

  return { parsePrompt, repairPrompt, convert, parseAspect };
});
