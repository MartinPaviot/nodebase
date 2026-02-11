export default function FlowEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Flow editor uses full screen without padding
  return <div className="h-screen overflow-hidden">{children}</div>;
}
