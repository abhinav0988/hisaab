"use client";
import type { Account } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Landmark, Pencil, Plus, WalletCards } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { accountService } from "@/services/account.service";
import { profileService } from "@/services/profile.service";
import { money } from "@/lib/format";

export function AccountsView() {
  const client = useQueryClient();
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list(),
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.get(),
  });
  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  if (accounts.isLoading || profile.isLoading) return <PageSkeleton />;
  if (!accounts.data || !profile.data) return <ErrorState retry={() => void accounts.refetch()} />;
  const refresh = () => void client.invalidateQueries({ queryKey: ["accounts"] });
  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Accounts"
        description="Organize where money lives — cash, bank, cards, wallets, and UPI."
        actions={
          <Button onClick={() => setAccountOpen(true)}>
            <Plus size={17} />
            New account
          </Button>
        }
      />
      <section className="mt-7">
        {accounts.data.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.data.map((account) => (
              <Card key={account.id} className={`p-5 ${!account.isActive ? "opacity-60" : ""}`}>
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
                    aria-label="Edit account"
                  >
                    <Pencil size={16} />
                  </Button>
                </div>
                <p className="mt-5 font-semibold">{account.name}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {account.type.replaceAll("_", " ")}
                  {account.institutionName ? ` · ${account.institutionName}` : ""}
                </p>
                <p className="mt-4 text-2xl font-bold">
                  {money(account.currentBalanceMinor, account.currency)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Calculated balance</p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No accounts yet"
            description="Create a cash, bank, card, wallet, or UPI account to begin."
            action={<Button onClick={() => setAccountOpen(true)}>Create account</Button>}
          />
        )}
      </section>
      <Modal
        open={accountOpen || Boolean(editing)}
        title={editing ? "Edit account" : "Create account"}
        onClose={() => {
          setAccountOpen(false);
          setEditing(null);
        }}
      >
        <AccountForm
          key={editing?.id ?? "new"}
          currency={profile.data.defaultCurrency}
          initial={editing ?? undefined}
          onSaved={() => {
            setAccountOpen(false);
            setEditing(null);
            toast.success("Account saved");
            refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function AccountForm({
  currency,
  initial,
  onSaved,
}: {
  currency: string;
  initial?: Account;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "CASH");
  const [institutionName, setInstitution] = useState(initial?.institutionName ?? "");
  const [opening, setOpening] = useState(String((initial?.openingBalanceMinor ?? 0) / 100));
  const [active, setActive] = useState(initial?.isActive ?? true);
  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? accountService.update(initial.id, {
            name,
            type,
            institutionName: institutionName || null,
            openingBalanceMinor: Math.round(Number(opening) * 100),
            currency,
            isActive: active,
          })
        : accountService.create({
            name,
            type,
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
      <Field label="Account name">
        <Input required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select value={type} onChange={(event) => setType(event.target.value as Account["type"])}>
            {["CASH", "BANK", "CREDIT_CARD", "DEBIT_CARD", "MOBILE_WALLET", "UPI", "OTHER"].map(
              (value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field label="Opening balance">
          <Input
            inputMode="decimal"
            required
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Institution (optional)">
        <Input value={institutionName} onChange={(event) => setInstitution(event.target.value)} />
      </Field>
      {initial ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="accent-[var(--primary)]"
          />
          Account is active
        </label>
      ) : null}
      {mutation.error ? (
        <p className="text-sm text-[var(--danger)]">{mutation.error.message}</p>
      ) : null}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save account"}
      </Button>
    </form>
  );
}
