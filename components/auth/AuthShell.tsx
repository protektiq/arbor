import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  children: ReactNode;
};

/**
 * Minimal legal-tool layout: dark navy header, white form card.
 */
export const AuthShell = ({ title, children }: AuthShellProps) => {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
      <header
        className="shrink-0 border-b border-[#1A1A2E]/20 bg-[#1A1A2E] px-6 py-5"
        style={{ backgroundColor: "#1A1A2E" }}
      >
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-medium tracking-wide text-white/90">
            Arbor
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">{title}</h1>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
};
