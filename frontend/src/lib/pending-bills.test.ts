import { describe, expect, it } from 'vitest';
import { computePendingTotal, filterVisibleBills } from './pending-bills';

describe('pending bill totals', () => {
  it('deducts cleared bills from the uncleared total', () => {
    const bills = [
      { order_id: 1, total_amount: 120, amount_paid: 0 },
      { order_id: 2, total_amount: 80, amount_paid: 20 },
      { order_id: 3, total_amount: 50, amount_paid: 0 },
    ];

    const cleared = new Set(['2']);
    const visibleBills = filterVisibleBills(bills, cleared);

    expect(computePendingTotal(visibleBills)).toBe(170);
  });
});
