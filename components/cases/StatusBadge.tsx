type CaseStatus =
  | "pending"
  | "ingesting"
  | "analyzing"
  | "ready"
  | "error";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

const statusStyles: Record<CaseStatus, string> = {
  pending: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  ingesting: "bg-amber-50 text-amber-900 ring-amber-200",
  analyzing: "bg-amber-50 text-amber-900 ring-amber-200",
  ready: "bg-blue-50 text-blue-900 ring-blue-200",
  error: "bg-red-50 text-red-800 ring-red-200",
};

const isCaseStatus = (s: string): s is CaseStatus =>
  s === "pending" ||
  s === "ingesting" ||
  s === "analyzing" ||
  s === "ready" ||
  s === "error";

export const StatusBadge = ({ status, className = "" }: StatusBadgeProps) => {
  const key = isCaseStatus(status) ? status : "pending";
  const styles = statusStyles[key];
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${styles} ${className}`}
    >
      {label}
    </span>
  );
};
