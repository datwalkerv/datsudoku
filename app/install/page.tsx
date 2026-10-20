import type { Metadata } from "next";
import { InstallScreen } from "@/components/pwa/install-screen";

export const metadata: Metadata = { title: "Add to Home Screen" };

export default function InstallPage() {
  return <InstallScreen />;
}
