"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { computeParticipantShares } from "@hisaab/validation";
import type { SplitMethod } from "@hisaab/types";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  HardDrive,
  ReceiptText,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { avatarTone, initials, majorStringToMinor, statusLabel } from "./split-format";

type ReceiptMime = "image/jpeg" | "image/png" | "application/pdf";
type Extracted = {
  merchant: string | null;
  receiptDate: string | null;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
};

const STEPS = ["Details", "Split With", "Method", "Due Date", "Review"] as const;
const METHODS: Array<{ id: Exclude<SplitMethod, "itemwise">; label: string; hint: string }> = [
  { id: "equal", label: "Equal Split", hint: "Everyone pays the same" },
  { id: "exact", label: "Exact Amount", hint: "Set custom amounts" },
  { id: "percentage", label: "Percentage", hint: "Set percentage share" },
  { id: "shares", label: "Shares", hint: "Set custom shares" },
];
const CATEGORIES = ["Food & Dining", "Travel", "Shopping", "Entertainment", "Bills", "Others"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Receipt import UI + adapter boundary.
 * Live Gmail/WhatsApp/Drive integrations are placeholders.
 * OCR uses backend ReceiptParserService (mock when SPLIT_RECEIPT_OCR=mock).
 */
export function ReceiptImportView({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  // 1 import, 2 processing, 3 details, 4 split with, 5 method, 6 due date, 7 review, 8 success
  const [step, setStep] = useState(1);
  const [fileUrl, setFileUrl] = useState("");
  const [file, setFile] = useState<{ name: string; mime: ReceiptMime; size: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & Dining");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const binary = useRef<File | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [method, setMethod] = useState<Exclude<SplitMethod, "itemwise">>("equal");
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState("");
  const [remind, setRemind] = useState(true);
  const [remindDays, setRemindDays] = useState(2);
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const peopleQuery = useQuery({
    queryKey: ["split-people"],
    queryFn: () => splitMoneyService.listPeople(),
  });
  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data]);
  const self = people.find((p) => p.isSelf) ?? people[0];

  useEffect(() => {
    if (self && !payerId) setPayerId(self.id);
    if (self && participantIds.length === 0) setParticipantIds([self.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self?.id]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const totalMinor = useMemo(() => {
    try {
      return majorStringToMinor(amount);
    } catch {
      return 0;
    }
  }, [amount]);

  const shareResult = useMemo(() => {
    if (!participantIds.length || totalMinor <= 0) {
      return { rows: [] as ReturnType<typeof computeParticipantShares>, error: null as string | null };
    }
    try {
      const parts = participantIds.map((personId) => {
        if (method === "exact")
          return { personId, shareAmountMinor: majorStringToMinor(exactAmounts[personId] || "0") };
        if (method === "percentage")
          return {
            personId,
            sharePercentageBps: Math.round(Number(percentages[personId] || "0") * 100),
          };
        if (method === "shares")
          return { personId, shareValue: Math.max(1, Math.round(Number(shares[personId] || "1"))) };
        return { personId };
      });
      return {
        rows: computeParticipantShares({ totalAmountMinor: totalMinor, method, participants: parts }),
        error: null,
      };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : "Invalid split" };
    }
  }, [participantIds, totalMinor, method, exactAmounts, percentages, shares]);

  const nameOf = (id: string) => people.find((p) => p.id === id)?.fullName ?? "Unknown";

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (binary.current) {
        const stored = await splitMoneyService.uploadFile(binary.current);
        const receipt = await splitMoneyService.uploadReceipt({ fileId: stored.id });
        try {
          const scan = await splitMoneyService.scanReceipt(stored.id);
          return {
            ...receipt,
            merchant: scan.merchant,
            receiptDate: scan.date,
            taxMinor: scan.taxMinor,
            totalMinor: scan.totalMinor,
            subtotalMinor: null,
          };
        } catch {
          return receipt;
        }
      }
      if (fileUrl.startsWith("https://") || fileUrl.startsWith("http://")) {
        return splitMoneyService.uploadReceipt({
          fileUrl,
          fileName: file?.name ?? "receipt.jpg",
          mimeType: file?.mime ?? "image/jpeg",
          fileSizeBytes: file?.size && file.size > 0 ? file.size : undefined,
        });
      }
      throw new Error("Choose a receipt file. A local path is not stored.");
    },
    onSuccess: (receipt) => {
      setReceiptId(receipt.id);
      setExtracted({
        merchant: receipt.merchant,
        receiptDate: receipt.receiptDate,
        subtotalMinor: receipt.subtotalMinor,
        taxMinor: receipt.taxMinor,
        totalMinor: receipt.totalMinor,
      });
      setTitle(receipt.merchant ? `Dinner at ${receipt.merchant}` : "Imported receipt");
      if (receipt.totalMinor) setAmount((receipt.totalMinor / 100).toFixed(2));
      if (receipt.receiptDate && /^\d{4}-\d{2}-\d{2}/.test(receipt.receiptDate)) {
        setExpenseDate(receipt.receiptDate.slice(0, 10));
      }
      setDescription(receipt.merchant ? `Receipt from ${receipt.merchant}` : "");
      setProgress(100);
      setStep(3);
      toast.success("Receipt uploaded. Review extracted details.");
    },
    onError: (e: Error) => {
      setStep(1);
      toast.error(e.message || "Upload failed");
    },
  });

  // Simulated progress bar while the upload/parse request is in flight.
  useEffect(() => {
    if (step !== 2 || !uploadMutation.isPending) return;
    const id = setInterval(() => setProgress((p) => (p < 90 ? p + 6 : p)), 250);
    return () => clearInterval(id);
  }, [step, uploadMutation.isPending]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!self) throw new Error("Add yourself as a person first");
      if (totalMinor <= 0) throw new Error("Enter a valid amount");
      if (shareResult.error || !shareResult.rows.length) {
        throw new Error(shareResult.error ?? "Choose who to split with");
      }
      return splitMoneyService.createExpense({
        title: title.trim(),
        description: description || null,
        category,
        totalAmountMinor: totalMinor,
        currency: "INR",
        expenseDate,
        splitMethod: method,
        dueDate: dueDate || null,
        receiptId,
        payers: [{ personId: payerId || self.id, paidAmountMinor: totalMinor }],
        participants: shareResult.rows.map((s) => ({
          personId: s.personId,
          sharePercentageBps: s.sharePercentageBps,
          shareValue: s.shareValue,
          shareAmountMinor: s.shareAmountMinor,
        })),
        reminder:
          remind && dueDate
            ? {
                enabled: true,
                channels: ["in_app"],
                firstReminderDaysBefore: remindDays,
                message: message || null,
              }
            : { enabled: false },
      });
    },
    onSuccess: (expense) => {
      void qc.invalidateQueries({ queryKey: ["split-money"] });
      void qc.invalidateQueries({ queryKey: ["split-expenses"] });
      toast.success("Expense created from receipt.");
      setCreatedId(expense.id);
      setStep(8);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startUpload = () => {
    setProgress(8);
    setStep(2);
    uploadMutation.mutate();
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const mime = (["image/jpeg", "image/png", "application/pdf"] as const).find((m) => m === f.type);
    if (!mime) {
      toast.error("Use a JPG, PNG or PDF receipt");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Receipt must be 8MB or smaller");
      return;
    }
    binary.current = f;
    setFile({ name: f.name, mime, size: f.size });
    setPreviewUrl(mime === "application/pdf" ? null : URL.createObjectURL(f));
    startUpload();
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    binary.current = null;
    setPreviewUrl(null);
    setFileUrl("");
    setExtracted(null);
    setTitle("");
    setAmount("");
    setDescription("");
    setReceiptId(null);
    setExactAmounts({});
    setPercentages({});
    setShares({});
    setDueDate("");
    setMessage("");
    setCreatedId(null);
    setExpenseDate(todayIso());
    setProgress(0);
    if (self) setParticipantIds([self.id]);
  };

  const toggleParticipant = (id: string) =>
    setParticipantIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const goNextFromDetails = () => {
    if (!title.trim()) return toast.error("Expense title is required");
    if (totalMinor <= 0) return toast.error("Enter a valid total amount");
    setStep(4);
  };
  const goNextFromSplit = () => {
    if (!participantIds.length) return toast.error("Select at least one person");
    setStep(5);
  };
  const goNextFromMethod = () => {
    if (shareResult.error) return toast.error(shareResult.error);
    setStep(6);
  };

  const wizardStep = step >= 3 && step <= 7 ? step - 2 : 0;
  const stepTitle =
    step === 1
      ? "Add a receipt to create an expense automatically."
      : step === 2
        ? "We're extracting details from your receipt."
        : step === 3
          ? "Review and edit the extracted details."
          : step === 4
            ? "Select who paid and who to split with."
            : step === 5
              ? "Choose how to split this expense."
              : step === 6
                ? "Set a due date and a reminder for payments."
                : step === 7
                  ? "Review all details before creating this split expense."
                  : "";

  const totalPct = participantIds.reduce((s, id) => s + Number(percentages[id] || 0), 0);
  const exactSum = participantIds.reduce((s, id) => {
    try {
      return s + majorStringToMinor(exactAmounts[id] || "0");
    } catch {
      return s;
    }
  }, 0);

  return (
    <main className="sm-page sm-import-page">
      <header className="sm-create-head">
        <button
          className="sm-back-title"
          type="button"
          onClick={() => (step === 1 || step === 8 ? onBack() : setStep(step === 3 ? 1 : step - 1))}
        >
          <ArrowLeft size={18} /> {step === 1 || step === 8 ? "Split Money" : "Back"}
        </button>
      </header>
      {step !== 8 && (
        <section className="sm-wizard-title">
          <p className="sm-kicker">RECEIPT</p>
          <h1>Import Receipt</h1>
          <p>{stepTitle}</p>
        </section>
      )}

      {wizardStep > 0 && (
        <nav className="sm-stepper" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={wizardStep === i + 1 ? "current" : wizardStep > i + 1 ? "done" : ""}
            >
              <span>{wizardStep > i + 1 ? <Check size={13} /> : i + 1}</span>
              <b>{label}</b>
            </button>
          ))}
        </nav>
      )}

      {step === 1 && (
        <section className="sm-form-card">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/jpeg,image/png"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <input
            ref={filesRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <div
            className="sm-upload sm-dropzone"
            role="button"
            tabIndex={0}
            onClick={() => filesRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") filesRef.current?.click();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <UploadCloud size={44} />
            <b>Drag &amp; drop your receipt here</b>
            <span>
              or <u>click to browse</u>
            </span>
            <small>Supports JPG, PNG, PDF (max 10MB)</small>
          </div>
          <div className="sm-source-grid">
            <button type="button" onClick={() => cameraRef.current?.click()}>
              <Camera size={24} />
              <b>Camera</b>
              <small>Take a photo</small>
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()}>
              <ImageIcon size={24} />
              <b>Gallery</b>
              <small>Choose from device</small>
            </button>
            <button type="button" onClick={() => filesRef.current?.click()}>
              <FolderOpen size={24} />
              <b>Files</b>
              <small>Browse files</small>
            </button>
          </div>
          <h3 className="sm-small-heading">Or import from</h3>
          <div className="sm-import-chips">
            <button type="button" disabled title="Coming soon">
              <Mail size={16} />
              <span>
                <b>Gmail</b>
                <small>Coming soon</small>
              </span>
            </button>
            <button type="button" disabled title="Coming soon">
              <MessageCircle size={16} />
              <span>
                <b>WhatsApp</b>
                <small>Coming soon</small>
              </span>
            </button>
            <button type="button" disabled title="Coming soon">
              <HardDrive size={16} />
              <span>
                <b>Google Drive</b>
                <small>Coming soon</small>
              </span>
            </button>
          </div>
          <label className="wide" style={{ marginTop: 16, display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
            Or paste a file URL (dev)
            <input
              className="sm-plain-input"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          {fileUrl.trim() && (
            <footer className="sm-wizard-footer">
              <span />
              <button className="sm-primary" type="button" onClick={startUpload}>
                Import from URL <ArrowRight size={15} />
              </button>
            </footer>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="sm-form-card sm-scan-card">
          <div className="sm-scan-frame">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Receipt preview" />
            ) : (
              <div className="sm-scan-placeholder">
                {file?.mime === "application/pdf" ? <FileText size={54} /> : <ReceiptText size={54} />}
                <small>{file?.name ?? "Receipt"}</small>
              </div>
            )}
            <i className="sm-scan-line" />
          </div>
          <p className="sm-scan-title">Extracting details…</p>
          <small className="sm-scan-sub">This may take a few seconds</small>
          <div className="sm-bar sm-scan-bar">
            <i style={{ width: `${progress}%` }} />
          </div>
          <small>{progress}%</small>
        </section>
      )}

      {step === 3 && (
        <section className="sm-form-card sm-extract">
          <div className="sm-extract-grid">
            <aside className="sm-extract-receipt">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Receipt" />
              ) : (
                <ReceiptText size={42} />
              )}
              <dl>
                <dt>Merchant</dt>
                <dd>{extracted?.merchant ?? "—"}</dd>
                <dt>Date</dt>
                <dd>{extracted?.receiptDate?.slice(0, 10) ?? "—"}</dd>
                {extracted?.subtotalMinor != null && (
                  <>
                    <dt>Subtotal</dt>
                    <dd>{money(extracted.subtotalMinor)}</dd>
                  </>
                )}
                {extracted?.taxMinor != null && (
                  <>
                    <dt>Tax</dt>
                    <dd>{money(extracted.taxMinor)}</dd>
                  </>
                )}
                {extracted?.totalMinor != null && (
                  <>
                    <dt>Total</dt>
                    <dd>{money(extracted.totalMinor)}</dd>
                  </>
                )}
              </dl>
            </aside>
            <div className="sm-fields">
              <label className="wide">
                Expense title *
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                Total amount *
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Date
                <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
              </label>
              <label className="wide">
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Description (optional)
                <textarea
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>
          </div>
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={reset}>
              Retake
            </button>
            <button className="sm-primary" type="button" onClick={goNextFromDetails}>
              Next: Split With <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      )}

      {step === 4 && (
        <section className="sm-form-card">
          <h3 className="sm-small-heading" style={{ marginTop: 0 }}>
            Who paid the full amount?
          </h3>
          <div className="sm-people-grid sm-payer-grid">
            {people.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={payerId === p.id ? "selected" : ""}
                onClick={() => setPayerId(p.id)}
              >
                <span className={`sm-avatar ${avatarTone(i)}`}>{initials(p.fullName)}</span>
                {p.isSelf ? `${p.fullName} (You)` : p.fullName}
                {payerId === p.id && <Check size={14} />}
              </button>
            ))}
          </div>
          <div className="sm-split-with-head">
            <h3 className="sm-small-heading">Split with ({participantIds.length} people)</h3>
            <label className="sm-check">
              <input
                type="checkbox"
                checked={people.length > 0 && participantIds.length === people.length}
                onChange={(e) => setParticipantIds(e.target.checked ? people.map((p) => p.id) : [])}
              />
              Select All
            </label>
          </div>
          <div className="sm-contact-list">
            {people.map((p, i) => (
              <button key={p.id} type="button" onClick={() => toggleParticipant(p.id)}>
                <input type="checkbox" readOnly checked={participantIds.includes(p.id)} tabIndex={-1} />
                <span className={`sm-avatar small ${avatarTone(i)}`}>{initials(p.fullName)}</span>
                <b>{p.isSelf ? `${p.fullName} (You)` : p.fullName}</b>
              </button>
            ))}
            {!people.length && <p className="sm-empty">Add people in Split Money → People first.</p>}
          </div>
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={() => setStep(3)}>
              Back
            </button>
            <button className="sm-primary" type="button" onClick={goNextFromSplit}>
              Next: Split Method <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      )}

      {step === 5 && (
        <section className="sm-form-card">
          <div className="sm-method-cards">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={method === m.id ? "active" : ""}
                onClick={() => setMethod(m.id)}
              >
                <b>{m.label}</b>
                <small>{m.hint}</small>
              </button>
            ))}
          </div>
          <div className="sm-split-with-head">
            <h3 className="sm-small-heading">Split between {participantIds.length} people</h3>
            <span className="sm-muted">Total: {money(totalMinor)}</span>
          </div>
          <div className="sm-split-rows">
            {participantIds.map((id, i) => {
              const row = shareResult.rows.find((r) => r.personId === id);
              return (
                <div key={id}>
                  <span className={`sm-avatar small ${avatarTone(i)}`}>{initials(nameOf(id))}</span>
                  <b>{nameOf(id)}</b>
                  {method === "exact" && (
                    <input
                      aria-label={`Amount for ${nameOf(id)}`}
                      inputMode="decimal"
                      value={exactAmounts[id] ?? ""}
                      placeholder="0.00"
                      onChange={(e) => setExactAmounts({ ...exactAmounts, [id]: e.target.value })}
                    />
                  )}
                  {method === "percentage" && (
                    <input
                      aria-label={`Percent for ${nameOf(id)}`}
                      inputMode="decimal"
                      value={percentages[id] ?? ""}
                      placeholder="%"
                      onChange={(e) => setPercentages({ ...percentages, [id]: e.target.value })}
                    />
                  )}
                  {method === "shares" && (
                    <input
                      aria-label={`Shares for ${nameOf(id)}`}
                      inputMode="numeric"
                      value={shares[id] ?? "1"}
                      onChange={(e) => setShares({ ...shares, [id]: e.target.value })}
                    />
                  )}
                  <strong>{row ? money(row.shareAmountMinor) : "—"}</strong>
                </div>
              );
            })}
          </div>
          {method === "exact" && (
            <p className="sm-muted">
              Assigned {money(exactSum)} of {money(totalMinor)}
            </p>
          )}
          {method === "percentage" && <p className="sm-muted">Total {totalPct}% of 100%</p>}
          {shareResult.error && <p className="sm-error">{shareResult.error}</p>}
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={() => setStep(4)}>
              Back
            </button>
            <button className="sm-primary" type="button" onClick={goNextFromMethod}>
              Next: Due Date <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      )}

      {step === 6 && (
        <section className="sm-form-card">
          <div className="sm-fields">
            <label>
              Payment due date
              <input type="date" value={dueDate} min={expenseDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label>
              Reminder
              <select
                value={remindDays}
                disabled={!remind}
                onChange={(e) => setRemindDays(Number(e.target.value))}
              >
                {[0, 1, 2, 3, 7].map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? "On the due date" : `${d} day${d > 1 ? "s" : ""} before`}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm-toggle-row wide">
              <div>
                <b>Send reminders to all</b>
                <small>Notify members before the due date (needs a due date)</small>
              </div>
              <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
            </label>
            <label className="wide">
              Message (optional)
              <textarea
                maxLength={200}
                value={message}
                placeholder="Please settle your share 🙂"
                onChange={(e) => setMessage(e.target.value)}
              />
              <small className="sm-muted">{message.length}/200</small>
            </label>
          </div>
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={() => setStep(5)}>
              Back
            </button>
            <button className="sm-primary" type="button" onClick={() => setStep(7)}>
              Next: Review <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      )}

      {step === 7 && (
        <section className="sm-form-card">
          <div className="sm-review-head">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Receipt" />
            ) : (
              <span>
                <ReceiptText size={26} />
              </span>
            )}
            <div>
              <b>{title}</b>
              <small>
                {expenseDate} · {category}
              </small>
            </div>
            <button className="sm-outline" type="button" onClick={() => setStep(3)}>
              Edit
            </button>
          </div>
          <div className="sm-review-card">
            <div>
              <span>Total Amount</span>
              <b>{money(totalMinor)}</b>
            </div>
            <div>
              <span>Paid by</span>
              <b>{nameOf(payerId)}</b>
            </div>
            <div>
              <span>Split between</span>
              <b>{participantIds.length} people</b>
            </div>
            <div>
              <span>Method</span>
              <b>{statusLabel(method)}</b>
            </div>
            <div>
              <span>Due date</span>
              <b>
                {dueDate || "None"}
                {dueDate && remind ? ` (Reminder: ${remindDays} day${remindDays === 1 ? "" : "s"} before)` : ""}
              </b>
            </div>
            <div>
              <span>Receipt</span>
              <b>{receiptId ? "1 file attached" : "None"}</b>
            </div>
          </div>
          <div className="sm-split-rows">
            {shareResult.rows.map((r, i) => (
              <div key={r.personId}>
                <span className={`sm-avatar small ${avatarTone(i)}`}>{initials(nameOf(r.personId))}</span>
                <b>{nameOf(r.personId)}</b>
                <strong>{money(r.shareAmountMinor)}</strong>
              </div>
            ))}
          </div>
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={() => setStep(6)}>
              Back
            </button>
            <button
              className="sm-primary"
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Create Expense"} <Check size={15} />
            </button>
          </footer>
        </section>
      )}

      {step === 8 && (
        <section className="sm-success">
          <span>
            <Check size={62} />
          </span>
          <h1>Expense Created Successfully!</h1>
          <p>The split expense has been created from your receipt.</p>
          <button
            className="sm-primary"
            type="button"
            onClick={() => createdId && onCreated(createdId)}
          >
            View Expense
          </button>
          <button className="sm-outline" type="button" onClick={reset}>
            Create Another Expense
          </button>
        </section>
      )}
    </main>
  );
}
