import type { Metadata } from "next";
import { OperationsApp } from "@/components/app-shell";
export const metadata: Metadata = { title: "Order History" };
export default function HistoryPage() { return <OperationsApp view="history"/>; }
