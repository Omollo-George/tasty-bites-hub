export interface CashierBillLike {
  order_id: string;
  total_amount?: number | string;
}

export const getOutstandingTotal = (
  bills: CashierBillLike[],
  clearedOrderIds: string[] = []
) => {
  const clearedSet = new Set(clearedOrderIds.map((id) => String(id)));

  return bills.reduce((sum, bill) => {
    if (clearedSet.has(String(bill.order_id))) {
      return sum;
    }

    return sum + Number(bill.total_amount || 0);
  }, 0);
};

export const filterVisibleBills = (
  bills: CashierBillLike[],
  clearedOrderIds: string[] = []
) => {
  const clearedSet = new Set(clearedOrderIds.map((id) => String(id)));
  return bills.filter((bill) => !clearedSet.has(String(bill.order_id)));
};
