"use client";

/**
 * Phase 5 spec completion — the Certificates / NOC panel for the OFFICER case
 * file (/gov/venue/[id]).
 *
 * Flow per spec: the officer uploads a certificate photo → /api/certificates/
 * extract (Gemini vision, server-side) pre-fills the fields → the officer
 * reviews/edits them → confirm → the row is saved and the photo uploaded to
 * the report-photos bucket at {venueId}/cert-{ts}.jpg. Status chips derive
 * from expiry_date: 🟢 Valid · 🟡 Expiring soon (<60 days) · 🔴 Expired.
 *
 * Display-only compliance metadata — never touches the risk formula, and the
 * citizen passport only ever reads what the officer recorded here.
 */

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CertStatusChip, CertTypeChip, PhotoThumb } from "@/components/safezone/tokens";
import { CERT_TYPES, certStatus, isIsoDate } from "@/lib/certificates";
import { tr, trParams } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import { prepareImageFromFile } from "@/lib/image-prepare";
import type { Certificate } from "@/lib/types";

const CERT_TYPE_KEYS = {
  fire_noc: "cert_fire_noc",
  health_license: "cert_health_license",
  trade_license: "cert_trade_license",
} as const;

interface FormState {
  certType: Certificate["certType"];
  certNumber: string;
  issueDate: string;
  expiryDate: string;
  authority: string;
}

const EMPTY_FORM: FormState = {
  certType: "fire_noc",
  certNumber: "",
  issueDate: "",
  expiryDate: "",
  authority: "",
};

export function CertificatePanel({
  venueId,
  certificates,
  onSaved,
}: {
  venueId: string;
  certificates: Certificate[];
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const readPhoto = async (file: File) => {
    setError(null);
    setNotice(null);
    // Shared image pipeline — a raw camera photo (6–12 MP, base64-inflated)
    // would exceed the serverless request-body cap before /api/certificates/
    // extract even runs. Downscaled + byte-bounded here, EXIF-oriented.
    const prepared = await prepareImageFromFile(file);
    if (!prepared) {
      setError(tr(lang, "photo_invalid"));
      return;
    }
    setPhoto(prepared.dataUrl);
  };

  // Gemini OCR — pre-fill only; the officer reviews/edits before saving.
  const extract = async () => {
    if (!photo) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/certificates/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const fields = (await res.json()) as {
        cert_number: string | null;
        issue_date: string | null;
        expiry_date: string | null;
        authority: string | null;
      };
      setForm((f) => ({
        ...f,
        certNumber: fields.cert_number ?? "",
        issueDate: fields.issue_date ?? "",
        expiryDate: fields.expiry_date ?? "",
        authority: fields.authority ?? "",
      }));
    } catch {
      setError(tr(lang, "ocr_failed"));
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    if (!isIsoDate(form.issueDate) && form.issueDate !== "") {
      setError(tr(lang, "issue_date") + ": YYYY-MM-DD");
      return;
    }
    if (!isIsoDate(form.expiryDate) && form.expiryDate !== "") {
      setError(tr(lang, "expiry_date") + ": YYYY-MM-DD");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          certType: form.certType,
          certNumber: form.certNumber || null,
          issueDate: form.issueDate || null,
          expiryDate: form.expiryDate || null,
          authority: form.authority || null,
          photoDataUrl: photo,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? String(res.status));
      }
      setForm(EMPTY_FORM);
      setPhoto(null);
      setOpen(false);
      setNotice(tr(lang, "cert_saved"));
      onSaved(); // parent refetches the venue detail → the list + chips refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certificate");
    } finally {
      setSaving(false);
    }
  };

  const resetUpload = () => {
    setPhoto(null);
    setForm(EMPTY_FORM);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section aria-label="Certificates" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">{tr(lang, "certificates")}</h2>
        {!open && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(true);
              setNotice(null);
            }}
            className="h-8 gap-1.5 rounded-lg border-edge px-3 text-xs"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {tr(lang, "upload_certificate")}
          </Button>
        )}
      </div>

      {notice && (
        <p className="flex items-center gap-1.5 rounded-xl border border-trust-verified/40 bg-trust-verified-soft px-3 py-2 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {notice}
        </p>
      )}

      {/* Existing certificates — the read-side every officer + citizen sees */}
      {certificates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge bg-surface p-4 text-center text-xs text-ink-muted">
          {tr(lang, "no_certificates")}
        </p>
      ) : (
        <ul className="space-y-2">
          {certificates.map((cert) => (
            <li key={cert.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <CertTypeChip certType={cert.certType} />
                <CertStatusChip status={certStatus(cert.expiryDate)} />
                <span className="ml-auto text-[11px] text-ink-muted">
                  {cert.certNumber ? `#${cert.certNumber}` : ""}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                {cert.expiryDate && (
                  <span className="font-medium text-ink">
                    {trParams(lang, "cert_valid_until", { date: cert.expiryDate })}
                  </span>
                )}
                {cert.issueDate && <span>· {tr(lang, "issue_date")}: {cert.issueDate}</span>}
                {cert.authority && <span>· {cert.authority}</span>}
              </div>
              {cert.photoUrl && (
                <div className="mt-2">
                  <PhotoThumb
                    src={cert.photoUrl}
                    alt={`${cert.certType} certificate photo`}
                    caption={tr(lang, "certificates")}
                    className="h-20 w-28"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Upload flow — photo → OCR pre-fill → review → confirm */}
      {open && (
        <div className="space-y-3 rounded-xl border border-navy/25 bg-navy-soft/50 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readPhoto(file);
            }}
          />

          {!photo ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-navy/40 bg-surface px-4 py-6 text-center transition-colors hover:border-navy/70"
            >
              <Upload className="h-6 w-6 text-navy" aria-hidden />
              <span className="text-sm font-medium text-navy">{tr(lang, "upload_certificate")}</span>
              <span className="text-[11px] text-ink-muted">
                Fire NOC · Health licence · Trade licence — photo of the document
              </span>
            </button>
          ) : (
            <>
              <figure className="flex items-start gap-3">
                <PhotoThumb
                  src={photo}
                  alt="Certificate photo preview"
                  caption={tr(lang, "certificates")}
                  className="h-20 w-28 shrink-0"
                />
                <figcaption className="flex min-w-0 flex-1 flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={extract}
                    disabled={extracting || saving}
                    className="h-9 w-fit gap-1.5 rounded-lg border-edge px-3 text-xs"
                  >
                    {extracting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {extracting ? tr(lang, "extracting") : tr(lang, "extract_details")}
                  </Button>
                  <button
                    onClick={resetUpload}
                    disabled={extracting || saving}
                    className="w-fit text-[11px] font-medium text-ink-muted underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Choose a different photo
                  </button>
                </figcaption>
              </figure>

              {/* Review / edit the extracted fields — the officer confirms everything */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-type" className="text-xs font-medium text-ink">
                    {tr(lang, "cert_type")}
                  </Label>
                  <select
                    id="cert-type"
                    value={form.certType}
                    onChange={(e) => setForm((f) => ({ ...f, certType: e.target.value as FormState["certType"] }))}
                    disabled={saving}
                    className="h-10 w-full rounded-xl border border-edge bg-surface px-3 text-sm shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                  >
                    {CERT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {tr(lang, CERT_TYPE_KEYS[t])}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cert-number" className="text-xs font-medium text-ink">
                    {tr(lang, "cert_number")}
                  </Label>
                  <Input
                    id="cert-number"
                    value={form.certNumber}
                    onChange={(e) => setForm((f) => ({ ...f, certNumber: e.target.value }))}
                    placeholder="MP/FNOC/2024/0812"
                    disabled={saving}
                    className="h-10 rounded-xl border-edge bg-surface text-sm shadow-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cert-issue" className="text-xs font-medium text-ink">
                    {tr(lang, "issue_date")}
                  </Label>
                  <Input
                    id="cert-issue"
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    disabled={saving}
                    className="h-10 rounded-xl border-edge bg-surface text-sm shadow-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cert-expiry" className="text-xs font-medium text-ink">
                    {tr(lang, "expiry_date")}
                  </Label>
                  <Input
                    id="cert-expiry"
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    disabled={saving}
                    className="h-10 rounded-xl border-edge bg-surface text-sm shadow-card"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cert-authority" className="text-xs font-medium text-ink">
                    {tr(lang, "authority")}
                  </Label>
                  <Input
                    id="cert-authority"
                    value={form.authority}
                    onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))}
                    placeholder="Directorate of Fire Services, Bhopal"
                    disabled={saving}
                    className="h-10 rounded-xl border-edge bg-surface text-sm shadow-card"
                  />
                </div>
              </div>

              {form.expiryDate && isIsoDate(form.expiryDate) && (
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  <CertStatusChip status={certStatus(form.expiryDate)} />
                </div>
              )}

              {error && (
                <p className="rounded-lg border border-risk-urgent/40 bg-risk-urgent-soft px-3 py-2 text-xs font-medium text-risk-urgent" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={save}
                  disabled={saving || extracting}
                  className="h-10 gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white shadow-card hover:bg-navy-hover"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {tr(lang, "save_certificate")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetUpload();
                  }}
                  disabled={saving}
                  className="h-10 rounded-xl border-edge px-5 text-sm"
                >
                  {tr(lang, "cancel")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
