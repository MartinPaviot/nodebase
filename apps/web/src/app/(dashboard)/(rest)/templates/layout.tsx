// Force dynamic rendering to avoid static generation errors with Suspense + tRPC
export const dynamic = "force-dynamic";

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
