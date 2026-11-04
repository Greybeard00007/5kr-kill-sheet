/**
 * Comprehensive Unit Tests for IADC WellSharp Decimal Places & Rounding Rules
 * in 5KR Kill Sheet.
 *
 * To run: node tests/test_iadc_calculations.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock DCLogic class expected by Component
class DCLogic {
  constructor() {
    this.props = {};
  }
  setState(fn) {
    if (typeof fn === 'function') {
      this.state = { ...this.state, ...fn(this.state) };
    } else {
      this.state = { ...this.state, ...fn };
    }
  }
}
global.DCLogic = DCLogic;

// Load src/component.js
const componentCode = fs.readFileSync(path.join(__dirname, '../src/component.js'), 'utf8');
(0, eval)(componentCode + '\nglobal.Component = Component;');

console.log('Running IADC Rounding Rules & Decimal Places Test Suite...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ── Test Section 1: Directional Rounding Rules ──────────────────────────────
test('KMW rounds UP to 1 decimal place (IADC WellSharp Field Units rule)', () => {
  const comp = new Component();
  comp.state.f.wellType = 'vertical';
  comp.state.f.td = 14200;
  comp.state.f.mw = 12.4;
  comp.state.f.sidpp = 480;

  const c = comp.calc();
  assert.strictEqual(c.kmw, 13.1, `Expected KMW 13.1 ppg (rounded up from 13.05), got ${c.kmw}`);
});

test('KMW preserves exact 1-decimal numbers without unnecessary round up', () => {
  const comp = new Component();
  comp.state.f.wellType = 'vertical';
  comp.state.f.td = 10000;
  comp.state.f.mw = 10.0;
  comp.state.f.sidpp = 520;

  const c = comp.calc();
  assert.strictEqual(c.kmw, 11.0, `Expected exact 11.0, got ${c.kmw}`);
});

test('LOT MAMW rounds DOWN to 1 decimal place (IADC WellSharp Field Units rule)', () => {
  const comp = new Component();
  comp.state.f.shoe = 6500;
  comp.state.f.strength = 'lot';
  comp.state.f.lotMw = 12.4;
  comp.state.f.lotP = 1149;

  const c = comp.calc();
  assert.strictEqual(c.mamw, 15.7, `Expected MAMW 15.7 ppg (rounded down from 15.799), got ${c.mamw}`);
});

test('Frac Gradient MAMW rounds DOWN to 1 decimal place', () => {
  const comp = new Component();
  comp.state.f.strength = 'fg';
  comp.state.f.fg = 0.822;

  const c = comp.calc();
  assert.strictEqual(c.mamw, 15.8, `Expected MAMW 15.8 ppg, got ${c.mamw}`);
});

test('MAASP carries forward rounded MAMW and rounds DOWN to whole psi', () => {
  const comp = new Component();
  comp.state.f.shoe = 6500;
  comp.state.f.mw = 12.4;
  comp.state.f.strength = 'lot';
  comp.state.f.lotMw = 12.4;
  comp.state.f.lotP = 1149;

  const c = comp.calc();
  assert.strictEqual(c.maasp, 1115, `Expected MAASP 1115 psi (safe conservative limit), got ${c.maasp}`);
});

test('FCP carries forward rounded KMW and rounds UP to nearest whole psi', () => {
  const comp = new Component();
  comp.state.f.wellType = 'horizontal';
  comp.state.f.td = 14200;
  comp.state.f.kop = 6800;
  comp.state.f.build = 1400;
  comp.state.f.incl = 90;
  comp.state.f.mw = 12.4;
  comp.state.f.sidpp = 480;
  comp.state.f.scrp = 620;

  const c = comp.calc();
  assert.strictEqual(c.fcp, 685, `Expected FCP 685 psi (rounded up), got ${c.fcp}`);
});

test('ICP is whole number sum of SIDPP + SCRP', () => {
  const comp = new Component();
  comp.state.f.sidpp = 480;
  comp.state.f.scrp = 620;

  const c = comp.calc();
  assert.strictEqual(c.icp, 1100, `Expected ICP 1100 psi, got ${c.icp}`);
});

test('Wait & Weight pressure drop per 100 strokes rounds DOWN to whole number', () => {
  const comp = new Component();
  comp.state.f.wellType = 'vertical';
  comp.state.f.td = 14200;
  comp.state.f.mw = 12.4;
  comp.state.f.sidpp = 480;
  comp.state.f.scrp = 620;

  const c = comp.calc();
  assert.strictEqual(c.prPer100, 21, `Expected 21 psi/100 stks (rounded down from 21.82), got ${c.prPer100}`);
  assert.strictEqual(c.prPerStep, 44, `Expected 44 psi/step (rounded down from 44.5), got ${c.prPerStep}`);
});

test('Total strokes matches sum of integer surface-to-bit and bit-to-surface strokes', () => {
  const comp = new Component();
  const c = comp.calc();

  const expectedTotal = Math.round(c.sBit) + Math.round(c.sBU);
  assert.strictEqual(c.total, expectedTotal, `Expected total strokes ${expectedTotal}, got ${c.total}`);
});

// ── Test Section 2: IADC Official Decimal Places Standards Table ────────────
test('IADC Field Units Decimal Places Table conformance', () => {
  const comp = new Component();
  comp.state.sys = 'us';

  // Depth: feet -> 0 decimals (X)
  assert.strictEqual(comp.u('depth').d, 0, 'Depth in feet must have 0 decimals');
  assert.strictEqual(comp.disp(14200, 'depth'), '14,200');

  // Pressure: psi -> 0 decimals (X)
  assert.strictEqual(comp.u('press').d, 0, 'Pressure in psi must have 0 decimals');
  assert.strictEqual(comp.disp(1100, 'press'), '1,100');

  // Pressure Gradient: psi/foot -> 4 decimals (X.XXXX)
  assert.strictEqual(comp.u('grad').d, 4, 'Pressure gradient in psi/ft must have 4 decimals');
  assert.strictEqual(comp.disp(0.8164, 'grad'), '0.8164');

  // Mud Weight: ppg -> 1 decimal (X.X)
  assert.strictEqual(comp.u('dens').d, 1, 'Mud weight in ppg must have 1 decimal');
  assert.strictEqual(comp.disp(13.7, 'dens'), '13.7');

  // Volume: bbl -> 1 decimal (X.X)
  assert.strictEqual(comp.u('vol').d, 1, 'Volume in bbl must have 1 decimal');
  assert.strictEqual(comp.disp(238.602, 'vol'), '238.6');

  // Capacity & Displacement: bbl/ft -> 4 decimals (X.XXXX)
  assert.strictEqual(comp.u('cap').d, 4, 'Capacity in bbl/ft must have 4 decimals');
  assert.strictEqual(comp.disp(0.01776, 'cap'), '0.0178');
});

test('IADC Metric Units Decimal Places Table conformance', () => {
  const comp = new Component();
  comp.state.sys = 'metric';

  // Depth: meters -> 1 decimal (X.X)
  assert.strictEqual(comp.u('depth').d, 1, 'Depth in meters must have 1 decimal');
  assert.strictEqual(comp.disp(14200, 'depth'), '4,328.2');

  // Pressure: bar -> 1 decimal (X.X)
  assert.strictEqual(comp.u('press').d, 1, 'Pressure in bar must have 1 decimal');
  assert.strictEqual(comp.disp(1100, 'press'), '75.8');

  // Pressure Gradient: bar/m -> 3 decimals (X.XXX)
  assert.strictEqual(comp.u('grad').d, 3, 'Pressure gradient in bar/m must have 3 decimals');

  // Mud Weight: kg/m³ -> 0 decimals (X)
  assert.strictEqual(comp.u('dens').d, 0, 'Mud weight in kg/m³ must have 0 decimals');
  assert.strictEqual(comp.disp(13.7, 'dens'), '1,642');

  // Volume: m³ -> 2 decimals (X.XX)
  assert.strictEqual(comp.u('vol').d, 2, 'Volume in m³ must have 2 decimals');
  assert.strictEqual(comp.disp(238.602, 'vol'), '37.93');

  // Capacity: L/m -> 2 decimals (X.XX)
  assert.strictEqual(comp.u('cap').d, 2, 'Capacity in L/m must have 2 decimals');

  // Step-down in metric: bar/100 stk -> 2 decimals (X.XX)
  const c = comp.calc();
  const g = comp.groups(c);
  const pressuresGroup = g.find(group => group.title === 'Pressures');
  const prRow = pressuresGroup.rows.find(r => r.label.includes('100 stks'));
  assert(prRow, 'Pressure drop per 100 stks row must exist');
  assert.strictEqual(prRow.unit, 'bar/100 stk');
  assert.match(prRow.value, /^\d+\.\d{2}$/, 'Metric step-down must format to 2 decimal places');
});

test('CSV export contains IADC fields with accurate formatting', () => {
  const comp = new Component();
  const c = comp.calc();
  const csvText = comp.csv(c);

  assert(csvText.includes('MAASP'), 'CSV must include MAASP');
  assert(csvText.includes('Pressure drop / 100 stks'), 'CSV must include Pressure drop / 100 stks');
  assert(csvText.includes('Total strokes'), 'CSV must include Total strokes');
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}
