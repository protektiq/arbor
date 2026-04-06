"use client";

import { useEffect, useState } from "react";

import { UploadZone } from "@/components/upload/UploadZone";

const storageKey = (caseId: string) => `arbor:caseParents:${caseId}`;

type StoredParents = {
  parentA?: string;
  parentB?: string;
};

type CaseUploadSectionProps = {
  caseId: string;
};

export const CaseUploadSection = ({ caseId }: CaseUploadSectionProps) => {
  const [parentA, setParentA] = useState("Parent A");
  const [parentB, setParentB] = useState("Parent B");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(caseId));
      if (raw == null || raw.trim() === "") {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (parsed == null || typeof parsed !== "object") {
        return;
      }
      const o = parsed as StoredParents;
      if (typeof o.parentA === "string" && o.parentA.trim().length > 0) {
        setParentA(o.parentA.trim().slice(0, 256));
      }
      if (typeof o.parentB === "string" && o.parentB.trim().length > 0) {
        setParentB(o.parentB.trim().slice(0, 256));
      }
    } catch {
      /* ignore malformed session data */
    }
  }, [caseId]);

  return (
    <UploadZone
      caseId={caseId}
      initialParentA={parentA}
      initialParentB={parentB}
    />
  );
};
