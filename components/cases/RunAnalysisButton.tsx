"use client";

type RunAnalysisButtonProps = {
  disabled: boolean;
};

export const RunAnalysisButton = ({ disabled }: RunAnalysisButtonProps) => {
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={disabled}
        aria-disabled={disabled}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
      >
        Run analysis
      </button>
      {disabled ? (
        <p className="mt-2 text-xs text-zinc-500">
          Available when the case status is ready and at least one message has
          been ingested.
        </p>
      ) : null}
    </div>
  );
};
