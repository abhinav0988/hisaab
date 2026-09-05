"use client";

import { Button, Field, Input, Switch } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Camera,
  ChevronRight,
  Crown,
  Fingerprint,
  Gem,
  KeyRound,
  Languages,
  Layers3,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Moon,
  MoreVertical,
  Repeat2,
  Search,
  Settings2,
  Shield,
  Sun,
  Tags,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/format";
import { accountService } from "@/services/account.service";
import { authService } from "@/services/auth.service";
import { categoryService } from "@/services/category.service";
import { profileService, type Profile } from "@/services/profile.service";
import { recurringService } from "@/services/recurring.service";
import "../../app/settings38.css";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "security", label: "Security" },
  { id: "workspace", label: "Workspace" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Data & Privacy" },
  { id: "apps", label: "Connected Apps" },
] as const;

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function SettingsThemeButton() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && theme === "dark";
  return (
    <button
      type="button"
      className="s38-btn icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

function SettingsNotifyButton() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="s38-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="s38-btn icon s38-notify"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
        <span className="s38-notify-dot" aria-hidden="true" />
      </button>
      {open ? (
        <div className="s38-notify-panel" role="dialog" aria-label="Settings notifications">
          <header>
            <div>
              <h2>Notifications</h2>
              <p>Account and preference alerts</p>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              Mark read
            </button>
          </header>
          <p className="s38-notify-empty">No new settings alerts. Save changes stay on this page.</p>
        </div>
      ) : null}
    </div>
  );
}

export function SettingsView() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  if (query.isLoading) return <PageSkeleton />;
  if (!query.data) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <SettingsForm
      initial={query.data}
      onSaved={() => {
        toast.success("Preferences updated");
        void client.invalidateQueries({ queryKey: ["profile"] });
      }}
    />
  );
}

function SettingsForm({ initial, onSaved }: { initial: Profile; onSaved: () => void }) {
  const router = useRouter();
  const { theme: liveTheme, setTheme } = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("profile");
  const [search, setSearch] = useState("");
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
  const [trackedTheme, setTrackedTheme] = useState(liveTheme);

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountService.list() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list() });
  const recurring = useQuery({
    queryKey: ["recurring-transactions"],
    queryFn: () => recurringService.list<{ isActive: boolean }>(),
  });

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

  const q = search.trim().toLowerCase();
  const show = useMemo(() => {
    const match = (...parts: string[]) => !q || parts.some((part) => part.toLowerCase().includes(q));
    return {
      profile: match("profile", "name", "email", "note"),
      experience: match("experience", "language", "theme", "notification", "summary", "preferences"),
      regional: match("regional", "country", "currency", "timezone", "location", "preferences"),
      security: match("security", "password", "session", "lock"),
      workspace: match("workspace", "accounts", "categories", "recurring", "bills"),
      access: match("logout", "access", "sign out"),
    };
  }, [q]);

  const accountCount = accounts.data?.length ?? 0;
  const categoryCount = categories.data?.length ?? 0;
  const recurringCount = recurring.data?.filter((item) => item.isActive).length ?? 0;
  const countryLabel =
    countryCode === "NP" ? "Nepal" : countryCode === "PK" ? "Pakistan" : countryCode === "BD" ? "Bangladesh" : "India";
  const cityHint =
    countryCode === "NP"
      ? "Kathmandu, Nepal"
      : countryCode === "PK"
        ? "Karachi, Pakistan"
        : countryCode === "BD"
          ? "Dhaka, Bangladesh"
          : "Kolkata, India";

  function jump(id: (typeof TABS)[number]["id"]) {
    setTab(id);
    const map: Record<string, string> = {
      profile: "s38-sec-profile",
      preferences: "s38-sec-experience",
      security: "s38-sec-security",
      workspace: "s38-sec-workspace",
      notifications: "s38-sec-experience",
      privacy: "s38-sec-access",
      apps: "s38-sec-workspace",
    };
    document.getElementById(map[id] ?? "s38-sec-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (id === "privacy" || id === "apps") {
      toast.info(id === "privacy" ? "Data & Privacy controls are coming soon." : "Connected apps will appear here soon.");
    }
  }

  return (
    <div className="settings38">
      <section className="s38-head">
        <div className="s38-head-left">
          <div className="s38-page-icon" aria-hidden="true">
            <Settings2 size={22} />
          </div>
          <div>
            <h1>Settings</h1>
            <p>Manage your profile, preferences, privacy and access — all in one place.</p>
          </div>
        </div>
        <div className="s38-head-actions">
          <label className="s38-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search settings"
              placeholder="Search settings..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="s38-btn" aria-label="Current month">
            {monthLabel()}
          </button>
          <SettingsNotifyButton />
          <SettingsThemeButton />
          <button
            type="button"
            className="s38-btn icon"
            aria-label="More settings options"
            onClick={() => toast.info("More settings options coming soon.")}
          >
            <MoreVertical size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="s38-btn primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </section>

      <nav className="s38-tabs" aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "is-active" : undefined}
            onClick={() => jump(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="s38-grid">
        <div className="s38-col">
          {show.profile ? (
            <article className="s38-card" id="s38-sec-profile">
              <header className="s38-card-head">
                <div className="s38-avatar-wrap">
                  <span className="s38-avatar" aria-hidden="true">
                    {initials(name)}
                  </span>
                  <button
                    type="button"
                    className="s38-avatar-cam"
                    aria-label="Update profile photo"
                    onClick={() => toast.info("Profile photo upload is coming soon.")}
                  >
                    <Camera size={12} />
                  </button>
                </div>
                <div className="min-w-0">
                  <h2>Profile</h2>
                  <p>Your personal details used across Hisaab.</p>
                </div>
                <span className="s38-premium-pill">
                  <Crown size={12} aria-hidden="true" />
                  <span>
                    <b>Premium User</b>
                    <small>Since Apr 2024</small>
                  </span>
                </span>
              </header>
              <div className="s38-fields">
                <label className="s38-field">
                  <span>Full name</span>
                  <span className="s38-input">
                    <UserRound size={15} aria-hidden="true" />
                    <input value={name} onChange={(event) => setName(event.target.value)} />
                  </span>
                </label>
                <label className="s38-field">
                  <span>Email</span>
                  <span className="s38-input is-disabled">
                    <Mail size={15} aria-hidden="true" />
                    <input className="break-all" value={initial.email} disabled />
                  </span>
                </label>
                <label className="s38-field s38-field-full">
                  <span>Profile note</span>
                  <span className="s38-input is-area">
                    <Layers3 size={15} aria-hidden="true" />
                    <textarea
                      rows={3}
                      value={profileNote}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Optional profile note"
                    />
                  </span>
                </label>
              </div>
            </article>
          ) : null}

          {show.regional ? (
            <article className="s38-card" id="s38-sec-regional">
              <header className="s38-card-head">
                <span className="s38-sec-icon" aria-hidden="true">
                  <MapPin size={16} />
                </span>
                <div className="min-w-0">
                  <h2>Regional preferences</h2>
                  <p>Set your location, currency and timezone for accurate insights.</p>
                </div>
              </header>
              <div className="s38-regional">
                <div className="s38-fields is-stack">
                  <label className="s38-field">
                    <span>Country</span>
                    <span className="s38-input">
                      <MapPin size={15} aria-hidden="true" />
                      <select value={countryCode} onChange={(event) => setCountry(event.target.value)}>
                        <option value="IN">India</option>
                        <option value="NP">Nepal</option>
                        <option value="PK">Pakistan</option>
                        <option value="BD">Bangladesh</option>
                      </select>
                    </span>
                  </label>
                  <label className="s38-field">
                    <span>Currency</span>
                    <span className="s38-input">
                      <Gem size={15} aria-hidden="true" />
                      <select value={defaultCurrency} onChange={(event) => setCurrency(event.target.value)}>
                        <option value="INR">INR — ₹</option>
                        <option value="NPR">NPR — रु</option>
                        <option value="PKR">PKR — Rs</option>
                        <option value="BDT">BDT — ৳</option>
                      </select>
                    </span>
                  </label>
                  <label className="s38-field">
                    <span>Time zone</span>
                    <span className="s38-input">
                      <Monitor size={15} aria-hidden="true" />
                      <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="Asia/Kathmandu">Asia/Kathmandu</option>
                        <option value="Asia/Karachi">Asia/Karachi</option>
                        <option value="Asia/Dhaka">Asia/Dhaka</option>
                      </select>
                    </span>
                  </label>
                </div>
                <div className="s38-map" aria-hidden="true">
                  <div className="s38-map-grid" />
                  <span className="s38-map-pin">
                    <MapPin size={14} />
                  </span>
                </div>
              </div>
              <div className="s38-location">
                <div>
                  <small>Detected location</small>
                  <strong>
                    {cityHint} · {countryLabel}
                  </strong>
                </div>
                <button
                  type="button"
                  className="s38-btn"
                  onClick={() => toast.info("Location detection will use your device settings soon.")}
                >
                  Update location
                </button>
              </div>
            </article>
          ) : null}

          {show.workspace ? (
            <article className="s38-card" id="s38-sec-workspace">
              <header className="s38-card-head">
                <span className="s38-sec-icon" aria-hidden="true">
                  <Layers3 size={16} />
                </span>
                <div className="min-w-0">
                  <h2>Workspace</h2>
                  <p>Manage what you see across Hisaab.</p>
                </div>
                <Link href="/accounts" className="s38-text-link">
                  Manage
                </Link>
              </header>
              <div className="s38-workspace">
                {[
                  {
                    href: "/accounts",
                    label: "Accounts",
                    hint: `${accountCount || "—"} connected`,
                    icon: WalletCards,
                  },
                  {
                    href: "/categories",
                    label: "Categories",
                    hint: `${categoryCount || "—"} categories`,
                    icon: Tags,
                  },
                  {
                    href: "/recurring",
                    label: "Bills & Reminders",
                    hint: `${recurringCount || "—"} active`,
                    icon: Repeat2,
                  },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="s38-workspace-item">
                    <span className="s38-sec-icon" aria-hidden="true">
                      <item.icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </article>
          ) : null}
        </div>

        <div className="s38-col">
          {show.experience ? (
            <article className="s38-card" id="s38-sec-experience">
              <header className="s38-card-head">
                <span className="s38-sec-icon" aria-hidden="true">
                  <Monitor size={16} />
                </span>
                <div className="min-w-0">
                  <h2>Experience</h2>
                  <p>Customize how you use Hisaab.</p>
                </div>
              </header>
              <div className="s38-fields is-stack">
                <label className="s38-field">
                  <span>Language</span>
                  <span className="s38-input">
                    <Languages size={15} aria-hidden="true" />
                    <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                      <option value="en">English</option>
                      <option value="hi">हिन्दी</option>
                      <option value="bn">বাংলা</option>
                      <option value="ur">اردو</option>
                      <option value="ne">नेपाली</option>
                    </select>
                  </span>
                </label>
                <label className="s38-field">
                  <span>Theme</span>
                  <span className="s38-input">
                    <Moon size={15} aria-hidden="true" />
                    <select
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
                    </select>
                  </span>
                </label>
                <div className="s38-toggle-row">
                  <div>
                    <strong>Smart notifications</strong>
                    <small>Budget alerts, bills and saving insights.</small>
                  </div>
                  <Switch checked={smartNotifications} onCheckedChange={setSmart} label="Smart notifications" />
                </div>
                <div className="s38-toggle-row">
                  <div>
                    <strong>Weekly money summary</strong>
                    <small>Receive a concise weekly digest.</small>
                  </div>
                  <Switch checked={weeklySummary} onCheckedChange={setWeekly} label="Weekly money summary" />
                </div>
              </div>
            </article>
          ) : null}

          {show.security ? (
            <article className="s38-card" id="s38-sec-security">
              <header className="s38-card-head">
                <span className="s38-sec-icon" aria-hidden="true">
                  <Shield size={16} />
                </span>
                <div className="min-w-0">
                  <h2>Security</h2>
                  <p>Keep your account safe and secure.</p>
                </div>
              </header>
              <div className="s38-secure-list">
                <div className="s38-secure-row">
                  <span className="s38-sec-icon" aria-hidden="true">
                    <Lock size={15} />
                  </span>
                  <div className="min-w-0">
                    <strong>Password</strong>
                    <small>Last changed recently</small>
                  </div>
                  <button type="button" className="s38-btn" onClick={() => setPasswordOpen(true)}>
                    Change
                  </button>
                </div>
                <div className="s38-secure-row">
                  <span className="s38-sec-icon" aria-hidden="true">
                    <Monitor size={15} />
                  </span>
                  <div className="min-w-0">
                    <strong>Active sessions</strong>
                    <small>Review signed-in devices</small>
                  </div>
                  <button type="button" className="s38-btn" onClick={() => setSessionsOpen(true)}>
                    Manage
                  </button>
                </div>
                <div className="s38-secure-row">
                  <span className="s38-sec-icon" aria-hidden="true">
                    <Fingerprint size={15} />
                  </span>
                  <div className="min-w-0">
                    <strong>App lock</strong>
                    <small>Use device PIN or biometrics</small>
                  </div>
                  <Switch checked={appLockEnabled} onCheckedChange={setLock} label="App lock" />
                </div>
              </div>
            </article>
          ) : null}

          {show.access ? (
            <article className="s38-card is-danger" id="s38-sec-access">
              <header className="s38-card-head">
                <span className="s38-sec-icon is-danger" aria-hidden="true">
                  <UserRound size={16} />
                </span>
                <div className="min-w-0">
                  <h2>Account Access</h2>
                  <p>Manage how you access your account.</p>
                </div>
              </header>
              <div className="s38-logout-box">
                <div>
                  <strong>Log out</strong>
                  <small>Sign out securely from this device.</small>
                </div>
                <button type="button" className="s38-btn danger" onClick={() => setLogoutOpen(true)}>
                  <KeyRound size={14} aria-hidden="true" />
                  Log out
                </button>
              </div>
            </article>
          ) : null}
        </div>
      </div>

      <section className="s38-premium">
        <span className="s38-premium-gem" aria-hidden="true">
          <Gem size={18} />
        </span>
        <div className="min-w-0">
          <h2>Hisaab Premium</h2>
          <p>Get advanced analytics, smart insights and more control over your finances.</p>
        </div>
        <Link href="/premium" className="s38-btn gold">
          <Crown size={14} aria-hidden="true" />
          Explore Premium
        </Link>
      </section>

      {mutation.error ? (
        <p className="s38-error" role="alert">
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
        <Input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(event) => setNext(event.target.value)}
        />
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
  if (!rows.length) return <p className="text-sm text-[var(--muted-foreground)]">No extra sessions found.</p>;
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
