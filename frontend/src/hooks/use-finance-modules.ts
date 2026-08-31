"use client";

import { useQuery } from "@tanstack/react-query";
import { financeService } from "@/services/finance.service";

export function useFinanceModules() {
  const investments = useQuery({
    queryKey: ["investments"],
    queryFn: () => financeService.listInvestments(),
    retry: false,
  });
  const ipos = useQuery({
    queryKey: ["ipos"],
    queryFn: () => financeService.listIpos(),
    retry: false,
  });
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => financeService.listLoans(),
    retry: false,
  });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
    retry: false,
  });
  const lends = useQuery({
    queryKey: ["lend-records"],
    queryFn: () => financeService.listLendRecords(),
    retry: false,
  });
  const cards = (facilities.data ?? []).filter((item) => item.kind === "CARD");
  const upi = (facilities.data ?? []).filter((item) => item.kind === "UPI");
  return {
    isLoading:
      investments.isLoading ||
      ipos.isLoading ||
      loans.isLoading ||
      facilities.isLoading ||
      lends.isLoading,
    isError:
      investments.isError || ipos.isError || loans.isError || facilities.isError || lends.isError,
    retry: () => {
      void investments.refetch();
      void ipos.refetch();
      void loans.refetch();
      void facilities.refetch();
      void lends.refetch();
    },
    state: {
      investments: investments.data ?? [],
      ipos: ipos.data ?? [],
      loans: loans.data ?? [],
      cards,
      upi,
      lends: lends.data ?? [],
    },
  };
}
