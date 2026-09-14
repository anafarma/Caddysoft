import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { WorkerHeartbeat } from "./worker-heartbeat";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caddysoft — AI Video Studio",
  description: "Professional AI video production workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
          <WorkerHeartbeat />
        </body>
      </html>
    </ClerkProvider>
  );
}
