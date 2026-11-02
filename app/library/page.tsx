import type { Metadata } from "next";
import { Library } from "@/components/library";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return <Library />;
}
