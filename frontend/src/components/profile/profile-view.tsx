"use client";
import { Button, Card, Field, Input, Select, Switch } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Repeat2, Tags, WalletCards } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CardHead, SettingRow } from "@/components/layout/chrome";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { initials } from "@/lib/format";
import { authClient } from "@/lib/auth-client";
import { authService } from "@/services/auth.service";
import { profileService, type Profile } from "@/services/profile.service";

export function ProfileView() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  if (query.isLoading) return <PageSkeleton />;
  if (!query.data) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <ProfileForm
      initial={query.data}
      onSaved={() => {
        toast.success("Preferences updated");
        void client.invalidateQueries({ queryKey: ["profile"] });
      }}
    />
  );
}

function ProfileForm({ initial, onSaved }: { initial: Profile; onSaved: () => void }) {
  const router = useRouter();
  const { theme: liveTheme, setTheme } = useTheme();
  const [name, setName] = useState(initial.name);
  const [profileNote, setNote] = useState(initial.profileNote ?? "");
  const [countryCode, setCountry] = useState(initial.countryCode);
  const [defaultCurrency, setCurrency] = useState(initial.defaultCurrency);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [language, setLanguage] = useState(initial.language ?? "en");
  const [theme, setThemeValue] = useState<"light" | "dark">(() =>
    liveTheme === "dark" || liveTheme === "light"
      ? liveTheme
      : initial.theme === "dark"
        ? "dark"
        : initial.theme === "light"
          ? "light"
          : "dark",
  );
  const [smartNotifications, setSmart] = useState(initial.smartNotifications ?? true);
  const [weeklySummary, setWeekly] = useState(initial.weeklySummary ?? true);
  const [appLockEnabled, setLock] = useState(initial.appLockEnabled ?? false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const pathname = usePathname();
  const [trackedTheme, setTrackedTheme] = useState(liveTheme);
  if (liveTheme !== trackedTheme) {
    setTrackedTheme(liveTheme);
    if (liveTheme === "dark" || liveTheme === "light") setThemeValue(liveTheme);
  }
  const mutation = useMutation({
    mutationFn: () =>
      profileService.update({
        name,
        profileNote: profileNote || null,
        countryCode,
        defaultCurrency,
        timezone,
        language,
        theme,
        smartNotifications,
        weeklySummary,
        appLockEnabled,
      }),
    onSuccess: onSaved,
  });
  const logout = async () => {
    await authService.signOut();
    router.replace("/login");
    router.refresh();
  };
  return (
    <div>
      <PageHeader
        eyebrow="Your account"
        title={pathname.startsWith("/profile") ? "Profile" : "Settings"}
        description="Manage profile, regional preferences, privacy, notifications and access."
        actions={
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      />
      <div className="grid gap-[18px] lg:grid-cols-2">
        <div className="grid gap-[18px]">
          <Card className="p-[22px]">
            <CardHead
              title="Profile"
              description="Personal details used across Hisaab."
              action={
                <span className="grid size-11 place-items-center rounded-[15px] bg-[var(--mint)] text-sm font-black text-[var(--primary)]">
                  {initials(name)}
                </span>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Email">
                <Input className="break-all" value={initial.email} disabled />
              </Field>
              <Field label="Profile note">
                <Input
                  value={profileNote}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional profile note"
                />
              </Field>
            </div>
          </Card>
          <Card className="p-[22px]">
            <h2 className="mb-3 text-[15px] font-semibold">Regional preferences</h2>
            <SettingRow title="Country" description="Controls regional defaults.">
              <Select className="h-11" value={countryCode} onChange={(event) => setCountry(event.target.value)}>
                <option value="IN">India</option>
                <option value="NP">Nepal</option>
                <option value="PK">Pakistan</option>
                <option value="BD">Bangladesh</option>
              </Select>
            </SettingRow>
            <SettingRow title="Currency" description="Used for new transactions.">
              <Select className="h-11" value={defaultCurrency} onChange={(event) => setCurrency(event.target.value)}>
                <option value="INR">INR — ₹</option>
                <option value="NPR">NPR — रु</option>
                <option value="PKR">PKR — Rs</option>
                <option value="BDT">BDT — ৳</option>
              </Select>
            </SettingRow>
            <SettingRow title="Time zone" description="Controls reporting boundaries.">
              <Select className="h-11" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Kathmandu">Asia/Kathmandu</option>
                <option value="Asia/Karachi">Asia/Karachi</option>
                <option value="Asia/Dhaka">Asia/Dhaka</option>
              </Select>
            </SettingRow>
          </Card>
          <Card className="p-[22px]">
            <h2 className="mb-3 text-[15px] font-semibold">Workspace</h2>
            <p className="mb-3 text-[11px] text-[var(--muted-foreground)]">
              Accounts, categories, and recurring bills live here.
            </p>
            <div className="grid gap-2">
              {[
                { href: "/accounts", label: "Accounts", hint: "Cash, bank, UPI", icon: WalletCards },
                { href: "/categories", label: "Categories", hint: "Income & spend labels", icon: Tags },
                { href: "/recurring", label: "Recurring", hint: "Bills and repeats", icon: Repeat2 },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border p-3 hover:bg-[var(--muted)]"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-[var(--muted)] text-[var(--primary)]">
                    <item.icon size={18} />
                  </span>
                  <span>
                    <b className="block text-xs">{item.label}</b>
                    <small className="text-[11px] text-[var(--muted-foreground)]">{item.hint}</small>
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-[18px]">
          <Card className="p-[22px]">
            <h2 className="mb-3 text-[15px] font-semibold">Experience</h2>
            <SettingRow title="Language" description="Choose interface language.">
              <Select className="h-11" value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="bn">বাংলা</option>
                <option value="ur">اردو</option>
                <option value="ne">नेपाली</option>
              </Select>
            </SettingRow>
            <SettingRow title="Theme" description="Choose light or dark.">
              <Select
                className="h-11"
                aria-label="Theme"
                value={theme}
                onChange={(event) => {
                  const next = event.target.value === "dark" ? "dark" : "light";
                  setThemeValue(next);
                  setTheme(next);
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </SettingRow>
            <SettingRow title="Smart notifications" description="Budget alerts, bills and saving insights.">
              <Switch checked={smartNotifications} onCheckedChange={setSmart} label="Smart notifications" />
            </SettingRow>
            <SettingRow title="Weekly money summary" description="Receive a concise weekly digest.">
              <Switch checked={weeklySummary} onCheckedChange={setWeekly} label="Weekly money summary" />
            </SettingRow>
          </Card>
          <Card className="p-[22px]">
            <h2 className="mb-3 text-[15px] font-semibold">Security</h2>
            <SettingRow title="Password" description="Keep your account protected.">
              <Button variant="secondary" className="h-11 w-full" onClick={() => setPasswordOpen(true)}>
                Change
              </Button>
            </SettingRow>
            <SettingRow title="Active sessions" description="Review signed-in devices.">
              <Button variant="secondary" className="h-11 w-full" onClick={() => setSessionsOpen(true)}>
                Manage
              </Button>
            </SettingRow>
            <SettingRow title="App lock" description="Use device PIN or biometrics.">
              <Switch checked={appLockEnabled} onCheckedChange={setLock} label="App lock" />
            </SettingRow>
          </Card>
          <Card className="border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] p-[22px]">
            <h2 className="mb-3 text-[15px] font-semibold">Account Access</h2>
            <SettingRow title="Log out" description="Sign out securely from this device.">
              <Button variant="danger" className="h-11 w-full" onClick={() => setLogoutOpen(true)}>
                Log out
              </Button>
            </SettingRow>
          </Card>
        </div>
      </div>
      {mutation.error ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {mutation.error.message}
        </p>
      ) : null}
      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Change password">
        <PasswordForm onSaved={() => setPasswordOpen(false)} />
      </Modal>
      <Modal open={sessionsOpen} onClose={() => setSessionsOpen(false)} title="Active sessions">
        <SessionsPanel />
      </Modal>
      <ConfirmDialog
        open={logoutOpen}
        title="Log out of Hisaab?"
        description="You will need to sign in again to see your accounts, budgets, and goals on this device."
        confirmLabel="Log out"
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void logout()}
      />
    </div>
  );
}

function PasswordForm({ onSaved }: { onSaved: () => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setSaving(true);
        try {
          const result = await authClient.changePassword({ currentPassword, newPassword });
          if (result.error) throw new Error(result.error.message);
          toast.success("Password updated");
          onSaved();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Unable to change password.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="Current password">
        <Input type="password" required value={currentPassword} onChange={(event) => setCurrent(event.target.value)} />
      </Field>
      <Field label="New password">
        <Input type="password" required minLength={8} value={newPassword} onChange={(event) => setNext(event.target.value)} />
      </Field>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={saving}>{saving ? "Saving…" : "Update password"}</Button>
    </form>
  );
}

function SessionsPanel() {
  const [rows, setRows] = useState<
    Array<{ token: string; userAgent?: string | null; createdAt?: Date | string }>
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void authClient
      .listSessions()
      .then((result) => {
        if (result.error) throw new Error(result.error.message);
        setRows(result.data ?? []);
      })
      .catch(() => setError("Sessions are not available on this device yet."));
  }, []);
  if (error) return <p className="text-sm text-[var(--muted-foreground)]">{error}</p>;
  if (!rows.length)
    return <p className="text-sm text-[var(--muted-foreground)]">No extra sessions found.</p>;
  return (
    <div className="grid gap-2">
      {rows.map((session) => (
        <div key={session.token} className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <b className="block text-xs">{session.userAgent || "Signed-in device"}</b>
            <small className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">
              {session.createdAt ? String(session.createdAt) : ""}
            </small>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await authClient.revokeSession({ token: session.token });
              setRows((current) => current.filter((item) => item.token !== session.token));
              toast.success("Session revoked");
            }}
          >
            Revoke
          </Button>
        </div>
      ))}
    </div>
  );
}
