"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_IDENTIFIER_LEN = 256;

type ProgressPhase =
  | "idle"
  | "uploading"
  | "parsing"
  | "saving"
  | "done"
  | "error";

type PdfFormat = "ofw_pdf" | "talkingparents_pdf";

export type UploadZoneProps = {
  caseId: string;
  initialParentA?: string;
  initialParentB?: string;
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "",
  "application/octet-stream",
]);

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const validateFile = (f: File): string | null => {
  if (f.size > MAX_BYTES) {
    return "File must be 50MB or smaller.";
  }
  const lower = f.name.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".txt")) {
    return "Only .pdf and .txt files are accepted.";
  }
  if (f.type.length > 0 && !ALLOWED_MIME.has(f.type)) {
    return "Unsupported file type. Use a PDF or plain text export.";
  }
  return null;
};

export const UploadZone = ({
  caseId,
  initialParentA = "Parent A",
  initialParentB = "Parent B",
}: UploadZoneProps) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parentA, setParentA] = useState(initialParentA);
  const [parentB, setParentB] = useState(initialParentB);
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ProgressPhase>("idle");
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [pdfFormat, setPdfFormat] = useState<PdfFormat>("ofw_pdf");

  useEffect(() => {
    setParentA(initialParentA);
    setParentB(initialParentB);
  }, [initialParentA, initialParentB]);

  const isPdf = file != null && file.name.toLowerCase().endsWith(".pdf");

  const assignFile = useCallback((next: File | undefined) => {
    if (next == null) {
      return;
    }
    const err = validateFile(next);
    if (err != null) {
      setClientError(err);
      setFile(null);
      if (inputRef.current != null) {
        inputRef.current.value = "";
      }
      return;
    }
    setClientError(null);
    setServerErrors([]);
    setFile(next);
  }, []);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    assignFile(e.target.files?.[0]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files[0];
    assignFile(dropped);
  };

  const handleZoneClick = () => {
    inputRef.current?.click();
  };

  const handleZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleUpload = async () => {
    if (file == null) {
      return;
    }
    const a = parentA.trim();
    const b = parentB.trim();
    if (a.length === 0 || b.length === 0) {
      setClientError("Both parent identifiers are required.");
      return;
    }
    if (a.length > MAX_IDENTIFIER_LEN || b.length > MAX_IDENTIFIER_LEN) {
      setClientError("Parent identifiers are too long (max 256 characters).");
      return;
    }

    setClientError(null);
    setServerErrors([]);
    setPhase("uploading");

    const form = new FormData();
    form.append("file", file);
    form.append("parent_a_identifier", a);
    form.append("parent_b_identifier", b);
    const lower = file.name.toLowerCase();
    const fileFormat =
      lower.endsWith(".pdf") ? pdfFormat : "generic_text";
    form.append("file_format", fileFormat);

    try {
      const res = await fetch(`/api/cases/${caseId}/upload`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      let data: {
        error?: string;
        errors?: string[];
        success?: boolean;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok) {
        setPhase("error");
        const extra =
          Array.isArray(data.errors) && data.errors.length > 0
            ? data.errors
            : [];
        if (extra.length > 0) {
          setServerErrors(extra);
        } else {
          const msg =
            typeof data.error === "string"
              ? data.error
              : "Upload failed. Please try again.";
          setServerErrors([msg]);
        }
        return;
      }

      setPhase("parsing");
      await new Promise((r) => {
        setTimeout(r, 450);
      });
      setPhase("saving");
      await new Promise((r) => {
        setTimeout(r, 450);
      });

      if (data.success === false) {
        setPhase("error");
        const errs =
          Array.isArray(data.errors) && data.errors.length > 0
            ? data.errors
            : ["Processing completed with errors."];
        setServerErrors(errs);
        router.refresh();
        return;
      }

      setPhase("done");
      router.refresh();
      setTimeout(() => {
        setPhase("idle");
        setFile(null);
        if (inputRef.current != null) {
          inputRef.current.value = "";
        }
      }, 2200);
    } catch {
      setPhase("error");
      setServerErrors(["Network error. Check your connection and try again."]);
    }
  };

  const busy =
    phase === "uploading" ||
    phase === "parsing" ||
    phase === "saving" ||
    phase === "done";

  const phaseLabel =
    phase === "uploading"
      ? "Uploading…"
      : phase === "parsing"
        ? "Parsing…"
        : phase === "saving"
          ? "Saving…"
          : phase === "done"
            ? "Done"
            : phase === "error"
              ? "Error"
              : null;

  return (
    <section
      className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      aria-labelledby="upload-heading"
    >
      <h2
        id="upload-heading"
        className="text-lg font-medium text-zinc-900"
      >
        Upload co-parenting export
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        PDF or plain text only, up to 50MB. Files are parsed and deduplicated by
        content hash.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="parent-a-id"
            className="block text-sm font-medium text-zinc-700"
          >
            Parent A label (sender mapping)
          </label>
          <input
            id="parent-a-id"
            type="text"
            value={parentA}
            onChange={(e) => setParentA(e.target.value)}
            maxLength={MAX_IDENTIFIER_LEN}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-50"
            autoComplete="off"
          />
        </div>
        <div>
          <label
            htmlFor="parent-b-id"
            className="block text-sm font-medium text-zinc-700"
          >
            Parent B label (sender mapping)
          </label>
          <input
            id="parent-b-id"
            type="text"
            value={parentB}
            onChange={(e) => setParentB(e.target.value)}
            maxLength={MAX_IDENTIFIER_LEN}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-50"
            autoComplete="off"
          />
        </div>
      </div>

      {isPdf ? (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-zinc-700">
            PDF export source
          </legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="radio"
                name="pdfFormat"
                value="ofw_pdf"
                checked={pdfFormat === "ofw_pdf"}
                onChange={() => setPdfFormat("ofw_pdf")}
                disabled={busy}
                className="h-4 w-4 border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              OurFamilyWizard
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="radio"
                name="pdfFormat"
                value="talkingparents_pdf"
                checked={pdfFormat === "talkingparents_pdf"}
                onChange={() => setPdfFormat("talkingparents_pdf")}
                disabled={busy}
                className="h-4 w-4 border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              TalkingParents
            </label>
          </div>
        </fieldset>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleFileInputChange}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a file here or press Enter to browse files"
        onClick={handleZoneClick}
        onKeyDown={handleZoneKeyDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <p className="text-sm font-medium text-zinc-800">
          Drag and drop a .pdf or .txt file
        </p>
        <p className="mt-1 text-xs text-zinc-500">or click to browse</p>
      </div>

      {clientError != null ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {clientError}
        </p>
      ) : null}

      {file != null ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
          <span className="font-medium">{file.name}</span>
          <span className="text-zinc-500"> — {formatFileSize(file.size)}</span>
        </div>
      ) : null}

      {serverErrors.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-sm text-red-700" role="alert">
          {serverErrors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      {phaseLabel != null ? (
        <p
          className={`mt-3 text-sm font-medium ${
            phase === "error" ? "text-red-700" : "text-blue-800"
          }`}
          aria-live="polite"
        >
          {phaseLabel}
        </p>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          onClick={handleUpload}
          disabled={file == null || busy}
          className="rounded-md bg-[#1A1A2E] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#252542] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          Upload and parse
        </button>
      </div>
    </section>
  );
};
