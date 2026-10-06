"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";

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
  const [step, setStep] = useState(1);
  const [fileUrl, setFileUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & Dining");
  const [description, setDescription] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: () =>
      splitMoneyService.uploadReceipt({
        fileUrl: fileUrl || "local://receipt-placeholder",
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 120_000,
      }),
    onSuccess: (receipt) => {
      setReceiptId(receipt.id);
      setTitle(receipt.merchant ? `Dinner at ${receipt.merchant}` : "Imported receipt");
      if (receipt.totalMinor) setAmount((receipt.totalMinor / 100).toFixed(2));
      setDescription(receipt.merchant ? `Receipt from ${receipt.merchant}` : "");
      setProcessing(false);
      setStep(3);
      toast.success("Receipt uploaded. Review extracted details.");
    },
    onError: (e: Error) => {
      setProcessing(false);
      toast.error(e.message || "Upload failed");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const people = await splitMoneyService.listPeople();
      const self = people.find((p) => p.isSelf) ?? people[0];
      if (!self) throw new Error("Add yourself as a person first");
      const amountMinor = Math.round(Number(amount.replace(/,/g, "")) * 100);
      return splitMoneyService.createExpense({
        title,
        description: description || null,
        category,
        totalAmountMinor: amountMinor,
        currency: "INR",
        expenseDate: new Date().toISOString().slice(0, 10),
        splitMethod: "equal",
        receiptId,
        payers: [{ personId: self.id, paidAmountMinor: amountMinor }],
        participants: people.slice(0, Math.min(4, people.length)).map((p) => ({
          personId: p.id,
        })),
        reminder: { enabled: false },
      });
    },
    onSuccess: (expense) => {
      void qc.invalidateQueries({ queryKey: ["split-money"] });
      toast.success("Expense created from receipt.");
      setStep(8);
      setTimeout(() => onCreated(expense.id), 0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startUpload = () => {
    setProcessing(true);
    setStep(2);
    uploadMutation.mutate();
  };

  return (
    <main className="sm-page">
      <header className="sm-create-head">
        <button className="sm-back-title" type="button" onClick={onBack}>
          <ArrowLeft size={18} /> Split Money
        </button>
      </header>
      <section className="sm-wizard-title">
        <p className="sm-kicker">RECEIPT</p>
        <h1>Import Receipt</h1>
        <p>Add a receipt to create an expense automatically.</p>
      </section>

      {step === 1 && (
        <section className="sm-form-card">
          <button className="sm-upload wide" type="button" onClick={startUpload}>
            <ReceiptText size={22} />
            <span>
              <b>Upload receipt</b>
              <small>Drag & drop or click · JPG, PNG or PDF (max 10MB)</small>
            </span>
          </button>
          <div className="sm-methods" style={{ marginTop: 16 }}>
            <button type="button" onClick={startUpload}>
              <b>Camera</b>
              <small>Take a photo</small>
            </button>
            <button type="button" onClick={startUpload}>
              <b>Gallery</b>
              <small>Choose from device</small>
            </button>
            <button type="button" onClick={startUpload}>
              <b>Files</b>
              <small>Browse files</small>
            </button>
          </div>
          <h3 className="sm-small-heading">Import from (coming soon)</h3>
          <div className="sm-filters">
            <button type="button" disabled>
              Gmail
            </button>
            <button type="button" disabled>
              WhatsApp
            </button>
            <button type="button" disabled>
              Google Drive
            </button>
          </div>
          <label className="wide" style={{ marginTop: 16, display: "grid", gap: 6 }}>
            Or paste a file URL (dev)
            <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="sm-form-card" style={{ textAlign: "center" }}>
          <p>{processing ? "Extracting details… This may take a few seconds" : "Processing"}</p>
          <div className="sm-bar" style={{ margin: "20px auto", maxWidth: 320 }}>
            <i style={{ width: "70%" }} />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="sm-form-card">
          <h2>Extracted Details</h2>
          <div className="sm-fields">
            <label className="wide">
              Expense title
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Total amount
              <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Food & Dining</option>
                <option>Travel</option>
                <option>Shopping</option>
                <option>Others</option>
              </select>
            </label>
            <label className="wide">
              Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={() => setStep(1)}>
              Retake
            </button>
            <button className="sm-primary" type="button" onClick={() => createMutation.mutate()}>
              Create Expense · {amount ? money(Math.round(Number(amount) * 100)) : "—"}
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
        </section>
      )}
    </main>
  );
}
