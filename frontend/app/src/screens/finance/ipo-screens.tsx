import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { majorToMinor } from "@hisaab/validation";
import type { IpoMarketCategory, IpoStatus } from "@hisaab/types";
import type { AppStackParamList } from "../../navigation/types";
import { accountService } from "../../services/account.service";
import { categoryService } from "../../services/category.service";
import { financeService } from "../../services/finance.service";
import { Screen } from "../../components/ui/screen";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { DateField } from "../../components/ui/date-field";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { bankAccountLabel, bankAccountName } from "../../lib/accounts";
import { localDateKey } from "../../lib/datetime";
import { money } from "../../lib/format";
import {
  IPO_MARKET_CATEGORIES,
  IPO_STATUSES,
  blockBankForIpo,
  isAllottedStatus,
  releaseBankForIpo,
  shouldBlockBankHold,
  shouldReleaseBankHold,
} from "../../lib/ipo";
import { colors } from "../../theme/tokens";

function fail(error: unknown) {
  return error instanceof Error ? error.message : "Try again.";
}

function parseOptionalMinor(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  try {
    return majorToMinor(cleaned);
  } catch {
    return null;
  }
}

async function invalidateIpoQueries(client: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["ipos"] }),
    client.invalidateQueries({ queryKey: ["accounts"] }),
    client.invalidateQueries({ queryKey: ["account-banks"] }),
    client.invalidateQueries({ queryKey: ["transactions"] }),
    client.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
}

export function IpoListScreen({ navigation }: NativeStackScreenProps<AppStackParamList, "Ipos">) {
  const q = useQuery({ queryKey: ["ipos"], queryFn: financeService.listIpos });
  if (q.isLoading) {
    return (
      <Screen onBack={() => navigation.goBack()}>
        <Text style={s.title}>IPO tracker</Text>
        <LoadingBlock />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen onBack={() => navigation.goBack()}>
        <Text style={s.title}>IPO tracker</Text>
        <ErrorBlock message="Could not load IPO applications." onRetry={() => void q.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>IPO tracker</Text>
      <View style={s.actions}>
        <AppButton label="Add IPO" icon="add" onPress={() => navigation.navigate("CreateIpo")} />
        <AppButton
          label="Upcoming"
          icon="calendar-outline"
          outline
          onPress={() => navigation.navigate("UpcomingIpos")}
        />
      </View>
      {q.data?.length ? (
        q.data.map((item) => (
          <Pressable key={item.id} onPress={() => navigation.navigate("IpoDetail", { id: item.id })}>
            <Card style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.sub}>
                  {item.marketCategory} · {item.appliedOn} · {item.status}
                  {item.paymentSource ? " · Bank hold" : ""}
                </Text>
              </View>
              <Text style={s.amount}>{money(item.amountMinor, item.currency)}</Text>
            </Card>
          </Pressable>
        ))
      ) : (
        <EmptyBlock title="No IPO applications" body="Track an application here." />
      )}
    </Screen>
  );
}

export function IpoDetailScreen({
  navigation,
  route,
}: NativeStackScreenProps<AppStackParamList, "IpoDetail">) {
  const q = useQuery({ queryKey: ["ipos"], queryFn: financeService.listIpos });
  const banks = useQuery({ queryKey: ["account-banks"], queryFn: () => accountService.listBanks() });
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => financeService.deleteIpo(route.params.id),
    onSuccess: async () => {
      await invalidateIpoQueries(client);
      navigation.goBack();
    },
    onError: (error) => Alert.alert("Could not delete", fail(error)),
  });
  const item = q.data?.find((row) => row.id === route.params.id);
  const bank = banks.data?.find((row) => row.id === item?.paymentSource);

  if (!item) {
    return (
      <Screen onBack={() => navigation.goBack()}>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>{item.name}</Text>
      <Card style={s.hero}>
        <Text style={s.sub}>{item.status.toUpperCase()}</Text>
        <Text style={s.big}>{money(item.amountMinor, item.currency)}</Text>
        <Text style={s.sub}>
          {item.lots} lots · Applied {item.appliedOn}
        </Text>
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={s.name}>Allotment: {item.allotmentOn ?? "Pending"}</Text>
        <Text style={s.sub}>
          Allotted{" "}
          {item.allottedAmountMinor === null
            ? "—"
            : money(item.allottedAmountMinor, item.currency)}{" "}
          · Listing{" "}
          {item.listingPriceMinor === null ? "—" : money(item.listingPriceMinor, item.currency)}
        </Text>
        <Text style={s.sub}>
          Current price{" "}
          {item.currentPriceMinor === null ? "—" : money(item.currentPriceMinor, item.currency)}
        </Text>
        <Text style={s.sub}>
          Bank: {bank ? bankAccountName(bank) : item.paymentSource ? "Linked bank" : "Not linked"}
        </Text>
        {item.paymentSource && shouldBlockBankHold(item.status) && !item.holdReleased ? (
          <Text style={s.holdNote}>
            {money(item.amountMinor, item.currency)} is blocked in this bank until allotment.
          </Text>
        ) : null}
        {item.holdReleased ? (
          <Text style={s.holdNote}>Application amount was credited back to your bank.</Text>
        ) : null}
      </Card>
      <AppButton
        label="Edit"
        icon="create-outline"
        outline
        onPress={() => navigation.navigate("EditIpo", { id: item.id })}
      />
      <AppButton
        label={remove.isPending ? "Deleting…" : "Delete"}
        icon="trash-outline"
        outline
        onPress={() =>
          Alert.alert("Delete IPO?", "This removes the application.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
          ])
        }
      />
    </Screen>
  );
}

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.pickerLabel}>{label}</Text>
      <View style={s.chips}>
        {options.map((item) => (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={[s.chip, value === item && s.chipOn]}
          >
            <Text style={s.chipText}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function IpoForm({
  navigation,
  id,
}: {
  navigation: NativeStackScreenProps<AppStackParamList, "CreateIpo" | "EditIpo">["navigation"];
  id?: string;
}) {
  const client = useQueryClient();
  const ipos = useQuery({
    queryKey: ["ipos"],
    queryFn: financeService.listIpos,
    enabled: Boolean(id),
  });
  const banks = useQuery({ queryKey: ["account-banks"], queryFn: () => accountService.listBanks() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list() });
  const initial = ipos.data?.find((row) => row.id === id);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [lots, setLots] = useState("1");
  const [appliedOn, setAppliedOn] = useState(localDateKey());
  const [status, setStatus] = useState<IpoStatus>("Applied");
  const [marketCategory, setMarketCategory] = useState<IpoMarketCategory>("Mainboard");
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [allotted, setAllotted] = useState("");
  const [listing, setListing] = useState("");
  const [current, setCurrent] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!initial || hydrated) return;
    setName(initial.name);
    setAmount(String(initial.amountMinor / 100));
    setLots(String(initial.lots));
    setAppliedOn(initial.appliedOn);
    setStatus(initial.status);
    setMarketCategory(initial.marketCategory);
    setBankAccountId(initial.paymentSource);
    setAllotted(
      initial.allottedAmountMinor != null ? String(initial.allottedAmountMinor / 100) : "",
    );
    setListing(initial.listingPriceMinor != null ? String(initial.listingPriceMinor / 100) : "");
    setCurrent(initial.currentPriceMinor != null ? String(initial.currentPriceMinor / 100) : "");
    setHydrated(true);
  }, [initial, hydrated]);

  const bankOptions = useMemo(
    () => (banks.data ?? []).filter((item) => item.isActive),
    [banks.data],
  );
  const selectedBank = bankOptions.find((item) => item.id === bankAccountId) ?? null;
  const allottedView = isAllottedStatus(status);
  const currency = initial?.currency ?? "INR";

  const bankPreview = useMemo(() => {
    if (!selectedBank || id) return null;
    let amountMinor = 0;
    try {
      amountMinor = majorToMinor(String(amount || "0").replace(/,/g, ""));
    } catch {
      amountMinor = 0;
    }
    if (!amountMinor || !shouldBlockBankHold(status)) return null;
    return {
      amountMinor,
      nextBalanceMinor: selectedBank.currentBalanceMinor - amountMinor,
    };
  }, [amount, id, selectedBank, status]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Enter IPO name.");
      const amountMinor = majorToMinor(amount.replace(/,/g, "").trim());
      if (!amountMinor || amountMinor <= 0) throw new Error("Enter a valid applied amount.");
      if (!categories.data?.length) throw new Error("Load categories first, then try again.");

      const allottedAmountMinor = allottedView ? parseOptionalMinor(allotted) : null;
      const listingPriceMinor = allottedView ? parseOptionalMinor(listing) : null;
      const currentPriceMinor = allottedView ? parseOptionalMinor(current) : null;
      if (allottedView && allotted.trim() && allottedAmountMinor === null) {
        throw new Error("Enter a valid allotted amount.");
      }

      const body = {
        name: trimmed,
        appliedOn,
        allotmentOn: initial?.allotmentOn ?? (allottedView ? localDateKey() : null),
        amountMinor,
        lots: Number(lots) || 1,
        status,
        marketCategory,
        allottedAmountMinor,
        listingPriceMinor,
        currentPriceMinor,
        paymentSource: id
          ? (initial?.paymentSource ?? null)
          : bankAccountId || null,
        currency,
      };

      if (!id) {
        const created = await financeService.createIpo(body);
        const needsHold =
          Boolean(bankAccountId) && shouldBlockBankHold(status) && Boolean(categories.data);
        if (needsHold && bankAccountId) {
          try {
            await blockBankForIpo(bankAccountId, categories.data!, {
              amountMinor,
              name: trimmed,
              appliedOn,
              currency,
            });
          } catch (error) {
            await financeService.deleteIpo(created.id);
            throw error;
          }
        }
        return created;
      }

      if (!initial) throw new Error("IPO not found.");
      const result = await financeService.updateIpo(id, body);
      const bankId = initial.paymentSource;
      const isValidBank = bankId && bankOptions.some((item) => item.id === bankId);
      if (!isValidBank || !categories.data) return result;

      const nextStatus = status;
      const nextAmount = amountMinor;
      const wasBlocking = shouldBlockBankHold(initial.status);
      const nowBlocking = shouldBlockBankHold(nextStatus);
      const holdActive = wasBlocking && !Boolean(initial.holdReleased);

      if (holdActive && shouldReleaseBankHold(nextStatus)) {
        await releaseBankForIpo(bankId, categories.data, {
          amountMinor: initial.amountMinor,
          name: initial.name,
          currency: initial.currency,
        });
        await financeService.updateIpo(id, { holdReleased: true });
      } else if (initial.holdReleased && nowBlocking) {
        await blockBankForIpo(bankId, categories.data, {
          amountMinor: nextAmount,
          name: initial.name,
          appliedOn: initial.appliedOn,
          currency: initial.currency,
        });
        await financeService.updateIpo(id, { holdReleased: false });
      } else if (!initial.holdReleased && !wasBlocking && nowBlocking) {
        await blockBankForIpo(bankId, categories.data, {
          amountMinor: nextAmount,
          name: initial.name,
          appliedOn: initial.appliedOn,
          currency: initial.currency,
        });
      }
      return result;
    },
    onSuccess: async () => {
      await invalidateIpoQueries(client);
      navigation.goBack();
    },
    onError: (error) => Alert.alert("Could not save", fail(error)),
  });

  if (id && !initial) {
    return (
      <Screen onBack={() => navigation.goBack()}>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>{id ? "Edit IPO" : "Add IPO"}</Text>
      <Field label="Company" placeholder="IPO name" value={name} onChangeText={setName} />
      <ChipRow
        label="Category"
        value={marketCategory}
        options={IPO_MARKET_CATEGORIES}
        onChange={setMarketCategory}
      />
      <Field
        label="Lots"
        placeholder="1"
        value={lots}
        onChangeText={setLots}
        keyboardType="number-pad"
      />
      <ChipRow label="Status" value={status} options={IPO_STATUSES} onChange={setStatus} />
      <Field
        label={`Applied amount (${currency})`}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      {allottedView ? (
        <>
          <Field
            label={`Allotted amount (${currency})`}
            placeholder="Optional"
            value={allotted}
            onChangeText={setAllotted}
            keyboardType="decimal-pad"
          />
          <Field
            label="Listing price"
            placeholder="Per share"
            value={listing}
            onChangeText={setListing}
            keyboardType="decimal-pad"
          />
          <Field
            label="Current price"
            placeholder="Live price"
            value={current}
            onChangeText={setCurrent}
            keyboardType="decimal-pad"
          />
        </>
      ) : null}
      <DateField label="Applied on" value={appliedOn} onChange={setAppliedOn} />

      <Text style={s.pickerLabel}>Bank account</Text>
      {id ? (
        <Text style={s.hint}>
          {selectedBank
            ? bankAccountLabel(selectedBank)
            : initial?.paymentSource
              ? "Linked bank (unchanged on edit)"
              : "No bank linked"}
        </Text>
      ) : (
        <>
          <Text style={s.hint}>
            {shouldBlockBankHold(status)
              ? "Optional. If selected, the applied amount is blocked in this bank until allotment."
              : "Optional. Select the savings bank used for this IPO."}
          </Text>
          {banks.isLoading ? (
            <Text style={s.hint}>Loading banks…</Text>
          ) : bankOptions.length ? (
            <View style={s.chips}>
              <Pressable
                onPress={() => setBankAccountId(null)}
                style={[s.chip, !bankAccountId && s.chipOn]}
              >
                <Text style={s.chipText}>No bank hold</Text>
              </Pressable>
              {bankOptions.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setBankAccountId(item.id)}
                  style={[s.chip, bankAccountId === item.id && s.chipOn]}
                >
                  <Text style={s.chipText} numberOfLines={1}>
                    {bankAccountLabel(item)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={s.hint}>Add a bank account first to block IPO application money.</Text>
              <AppButton
                label="Open Accounts"
                outline
                onPress={() => navigation.navigate("Accounts")}
              />
            </View>
          )}
          {selectedBank && bankPreview ? (
            <View style={s.preview}>
              <Text style={s.previewTitle}>{bankAccountName(selectedBank)}</Text>
              <Text style={s.previewBody}>
                {money(bankPreview.amountMinor, currency)} will be deducted from this account for
                the IPO hold. Available balance will be{" "}
                {money(bankPreview.nextBalanceMinor, currency)}.
              </Text>
            </View>
          ) : null}
        </>
      )}

      {initial?.holdReleased ? (
        <Text style={s.holdNote}>Application amount was credited back to your bank.</Text>
      ) : null}
      {id &&
      initial?.paymentSource &&
      shouldBlockBankHold(initial.status) &&
      !initial.holdReleased ? (
        <Text style={s.hint}>
          Changing status to Not Allotted will credit the blocked amount back to the linked bank.
        </Text>
      ) : null}

      <AppButton
        label={save.isPending ? "Saving…" : "Save IPO"}
        icon="checkmark"
        disabled={save.isPending}
        onPress={() => {
          if (save.isPending) return;
          save.mutate();
        }}
      />
    </Screen>
  );
}

export function CreateIpoScreen(props: NativeStackScreenProps<AppStackParamList, "CreateIpo">) {
  return <IpoForm navigation={props.navigation} />;
}

export function EditIpoScreen({
  navigation,
  route,
}: NativeStackScreenProps<AppStackParamList, "EditIpo">) {
  return <IpoForm navigation={navigation} id={route.params.id} />;
}

export function UpcomingIpoScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, "UpcomingIpos">) {
  const q = useQuery({
    queryKey: ["ipos", "upcoming"],
    queryFn: financeService.listUpcomingIpos,
  });
  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>Upcoming IPOs</Text>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorBlock message="Could not load upcoming IPOs." onRetry={() => void q.refetch()} />
      ) : (
        (q.data?.items ?? []).map((item) => (
          <Card key={item.id} style={{ gap: 4 }}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.sub}>
              {item.marketCategory} · {item.status} · {item.priceBand}
            </Text>
            <Text style={s.sub}>
              Open {item.openOn ?? "—"} · Close {item.closeOn ?? "—"}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: colors.white, fontSize: 29, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 8 },
  row: { flexDirection: "row", gap: 10, padding: 14 },
  name: { color: colors.white, fontWeight: "800", fontSize: 16 },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  amount: { color: colors.white, fontWeight: "900" },
  hero: { gap: 7, backgroundColor: colors.panel2 },
  big: { color: colors.white, fontSize: 31, fontWeight: "900" },
  pickerLabel: { color: colors.white, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  holdNote: { color: colors.green, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel2,
    maxWidth: "100%",
  },
  chipOn: { borderColor: colors.green, backgroundColor: "#0B3A2C" },
  chipText: { color: colors.white, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  preview: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    backgroundColor: colors.panel2,
  },
  previewTitle: { color: colors.white, fontWeight: "800", fontSize: 13 },
  previewBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
