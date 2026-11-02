import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  define: {
    'import.meta.env.VITE_FINANCE_ACCESS_CONTROL': '"true"',
    'import.meta.env.VITE_VISIT_AMOUNTS_VISIBLE': '"true"',
  },
});
after(() => server.close());
const access = await server.ssrLoadModule('/src/lib/finance-access.ts');

test('staff can export one shift day but not aggregate finance', () => {
  access.setFinanceUser('ira@soloway.local');
  assert.equal(access.canSeeVisitAmounts(), true);
  assert.equal(access.canSeeFinance(), false);
  assert.doesNotThrow(() => access.requireReportAccess(['2026-11-02']));
  assert.throws(() => access.requireReportAccess([]));
  assert.throws(() => access.requireReportAccess(['2026-11-01', '2026-11-02']));
  assert.throws(() => access.requireReportAccess(['invalid']));
  assert.throws(() => access.requireFinanceAccess());
});

test('only the three owners retain multi-day reports', () => {
  for (const login of ['andrew', 'olena', 'yulia']) {
    access.setFinanceUser(`${login}@soloway.local`);
    assert.equal(access.canSeeFinance(), true);
    assert.doesNotThrow(() => access.requireReportAccess(['2026-11-01', '2026-11-02']));
  }
  access.setFinanceUser(null);
  assert.equal(access.canSeeFinance(), false);
});
