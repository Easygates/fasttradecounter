import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", timeout: 180000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1, reporter: "list", use: { baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3000", headless: true, trace: "retain-on-failure", launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] } } });
