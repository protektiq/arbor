export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {children}
    </div>
  );
}
