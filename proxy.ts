import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
]);

const hasClerkConfig = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const proxy = hasClerkConfig
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : function missingClerkConfigProxy(req: Request) {
      const url = new URL(req.url);

      if (url.pathname.startsWith("/api/health")) {
        return NextResponse.next();
      }

      return NextResponse.json(
        {
          error: "AUTH_CONFIGURATION_MISSING",
          message:
            "Clerk runtime configuration is missing. Configure Preview environment variables before using the application.",
        },
        { status: 503 },
      );
    };

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
