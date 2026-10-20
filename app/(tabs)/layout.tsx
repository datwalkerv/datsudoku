import { TabBar } from "@/components/layout/tab-bar";

/** Top-level screens share the bottom tab bar. */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="hero-glow min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <TabBar />
    </>
  );
}
