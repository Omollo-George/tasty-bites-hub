export interface PendingBillLike {
  order_id: string | number;
  total_amount: number;
  amount_paid?: number;
  outstanding_amount?: number | null;
}

export const computePendingTotal = (list: PendingBillLike[]) =>
  list.reduce((sum, bill) => {
    const total = Number(bill.total_amount) || 0;
    const paid = Number(bill.amount_paid) || 0;
    const outstanding = bill.outstanding_amount !== undefined && bill.outstanding_amount !== null
      ? Number(bill.outstanding_amount)
      : Math.max(0, total - paid);

    return sum + Math.max(0, outstanding);
  }, 0);

export const filterVisibleBills = <T extends PendingBillLike>(
  list: T[],
  clearedOrderIds: Set<string>
) => list.filter((bill) => !clearedOrderIds.has(String(bill.order_id)));
