import type { Metadata } from "next";
import { PinCollection } from "@/components/pin-collection";

export const metadata: Metadata = { title: "Pin Collection" };

export default function PinsPage() {
  return <PinCollection />;
}
