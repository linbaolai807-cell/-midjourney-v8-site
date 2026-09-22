const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../js/prompt-engine');

const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/v8.2-rules.json'), 'utf8'));

function test(name, run) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('upgrades V8 and removes unsupported quality and multi-prompt weights', () => {
  const result = engine.repairPrompt('orange chair::2 concrete room --v 8 --q 2 --ar 16:9', rules, {});
  assert.equal(result.repaired, 'orange chair, concrete room --ar 16:9 --v 8.2');
  assert.ok(result.issues.some((issue) => issue.title.includes('Quality') || issue.title.includes('--q')));
  assert.ok(result.issues.some((issue) => issue.title.includes('Multi-prompt')));
});

test('migrates Omni Reference to Edit Model and removes its weight', () => {
  const result = engine.repairPrompt('portrait --oref https://example.com/ref.jpg --ow 300', rules, {});
  assert.match(result.repaired, /--edit https:\/\/example\.com\/ref\.jpg/);
  assert.doesNotMatch(result.repaired, /--o(?:ref|w)/);
});

test('preserves unknown parameters and marks them for review', () => {
  const result = engine.repairPrompt('portrait --future-setting 12', rules, {});
  assert.match(result.repaired, /--future-setting 12/);
  assert.ok(result.issues.some((issue) => issue.severity === 'review'));
});

test('keeps the final duplicate value', () => {
  const result = engine.repairPrompt('portrait --ar 1:1 --ar 16:9 --v 8.2', rules, {});
  assert.match(result.repaired, /--ar 16:9/);
  assert.doesNotMatch(result.repaired, /--ar 1:1/);
});

test('falls back to SD when HD exceeds the 4:1 ratio limit', () => {
  const result = engine.repairPrompt('panorama --ar 5:1 --hd', rules, {});
  assert.match(result.repaired, /--sd/);
  assert.doesNotMatch(result.repaired, /--hd/);
  assert.ok(result.issues.some((issue) => issue.title === 'HD changed to SD'));
});

test('explains a resolution selected in the interface', () => {
  const result = engine.repairPrompt('portrait --v 8.2', rules, { resolution: 'hd' });
  assert.match(result.repaired, /--hd/);
  assert.ok(result.issues.some((issue) => issue.title === 'HD resolution applied'));
});

test('removes an aspect ratio beyond the V8.2 14:1 maximum', () => {
  const result = engine.repairPrompt('panorama --ar 20:1', rules, {});
  assert.doesNotMatch(result.repaired, /--ar/);
  assert.ok(result.issues.some((issue) => issue.title.includes('14:1')));
});

test('moves words found after a flag back into the description', () => {
  const result = engine.repairPrompt('portrait --hd cinematic lighting --v 8', rules, {});
  assert.match(result.repaired, /portrait, cinematic lighting/);
  assert.ok(result.issues.some((issue) => issue.title === 'Text moved before parameters'));
});

test('converts only the cleaned creative description for secondary models', () => {
  const result = engine.repairPrompt('orange chair --q 2 --ar 4:5', rules, {});
  const flux = engine.convert(result, 'flux');
  assert.match(flux, /orange chair/);
  assert.match(flux, /4:5 aspect ratio/);
  assert.doesNotMatch(flux, /--q|--v/);
});
