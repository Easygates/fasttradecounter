import type { Metadata } from "next";
import { OperationsApp } from "@/components/app-shell";
export const metadata: Metadata = { title: "Live Warehouse Queue" };
export default function WarehousePage() { return <OperationsApp view="warehouse"/>; }
