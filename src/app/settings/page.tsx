import type { Metadata } from "next";
import { OperationsApp } from "@/components/app-shell";
export const metadata: Metadata = { title: "Workspace Settings" };
export default function SettingsPage() { return <OperationsApp view="settings"/>; }
