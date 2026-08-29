"use client";
import type { Account, AccountCatalogItem } from "@hisaab/types";
import { Button, Card, Field, Input } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Landmark, Pencil, WalletCards } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { accountService } from "@/services/account.service";
import { profileService } from "@/services/profile.service";
import { money } from "@/lib/format";
import { uniqueCatalogAccounts, accountDisplayName } from "@/lib/accounts";

export function AccountsView() {
  const client = useQueryClient();
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list(),
  });
  const catalog = useQuery({
    queryKey: ["account-catalog"],
    queryFn: () => accountService.catalog(),
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.get(),
  });
  const [editing, setEditing] = useState<Account | null>(null);
  if (accounts.isLoading || catalog.isLoading || profile.isLoading) return <PageSkeleton />;
  if (!accounts.data || !catalog.data || !profile.data)
    return <ErrorState retry={() => void accounts.refetch()} />;
  const listed = uniqueCatalogAccounts(accounts.data);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["accounts"] });
    void client.invalidateQueries({ queryKey: ["account-catalog"] });
  };
  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Accounts"
        description="Hisaab provides Cash, Bank, UPI, Wallet, and card accounts. Pick one when you add a transaction — you do not create accounts yourself."
      />
      <section className="mt-7">
        {listed.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {listed.map((account) => {
              const meta = catalog.data.find(
                (item) => item.id === account.catalogId || item.type === account.type,
              );
              return (
                <Card
                  key={account.id}
                  className={`interactive-card p-5 ${!account.isActive ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-[var(--mint)] text-[var(--primary)]">
                      {account.type.includes("CARD") ? (
                        <CreditCard size={21} />
                      ) : account.type === "BANK" ? (
                        <Landmark size={21} />
                      ) : (
                        <WalletCards size={21} />
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      className="px-2"
                      onClick={() => setEditing(account)}
                      aria-label={`Edit ${accountDisplayName(account)}`}
                    >
                      <Pencil size={16} />
                    </Button>
                  </div>
                  <p className="mt-5 font-semibold">{accountDisplayName(account)}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {meta?.description ?? account.type.replaceAll("_", " ")}
                    {account.institutionName ? ` · ${account.institutionName}` : ""}
                  </p>
                  <p className="mt-4 text-2xl font-bold">
                    {money(account.currentBalanceMinor, account.currency)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Calculated balance</p>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Accounts are loading"
            description="Hisaab assigns Cash, Bank, UPI, Wallet, and card accounts automatically."
            action={
              <Button onClick={() => void accounts.refetch()}>Refresh accounts</Button>
            }
          />
        )}
      </section>
      <Modal
        open={Boolean(editing)}
        title="Edit account"
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <AccountForm
            key={editing.id}
            catalog={catalog.data}
            currency={profile.data.defaultCurrency}
            initial={editing}
            onSaved={() => {
              setEditing(null);
              toast.success("Account saved");
              refresh();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function AccountForm({
  catalog,
  currency,
  initial,
  onSaved,
}: {
  catalog: AccountCatalogItem[];
  currency: string;
  initial: Account;
  onSaved: () => void;
}) {
  const meta = catalog.find((item) => item.id === initial.catalogId || item.type === initial.type);
  const [name, setName] = useState(initial.name);
  const [institutionName, setInstitution] = useState(initial.institutionName ?? "");
  const [opening, setOpening] = useState(String((initial.openingBalanceMinor ?? 0) / 100));
  const [active, setActive] = useState(initial.isActive);
  const mutation = useMutation({
    mutationFn: () =>
      accountService.update(initial.id, {
        name,
        institutionName: institutionName || null,
        openingBalanceMinor: Math.round(Number(opening) * 100),
        currency,
        isActive: active,
      }),
    onSuccess: onSaved,
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="rounded-[15px] border border-[var(--border)] bg-[var(--muted)] p-3.5 text-[12px] font-medium leading-relaxed text-[var(--muted-foreground)]">
        {meta?.description ?? "This account comes from the Hisaab catalog."} Type cannot be changed.
      </p>
      <Field label="Account name">
        <Input required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Opening balance">
        <Input
          inputMode="decimal"
          required
          value={opening}
          onChange={(event) => setOpening(event.target.value)}
        />
      </Field>
      <Field label="Institution (optional)">
        <Input value={institutionName} onChange={(event) => setInstitution(event.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="accent-[var(--primary)]"
        />
        Account is active
      </label>
      {mutation.error ? (
        <p className="text-sm text-[var(--danger)]">{mutation.error.message}</p>
      ) : null}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save account"}
      </Button>
    </form>
  );
}
