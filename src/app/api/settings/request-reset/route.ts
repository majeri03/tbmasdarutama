import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/actions/password-reset.actions";
import { requestPasswordResetSchema } from "@/lib/validations/password-reset.schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate
    const validated = requestPasswordResetSchema.parse(body);

    // HARDENING (24 Nov 2026): teruskan token Turnstile dari form
    // lupa-password ke action (zod .parse membuang key yang tidak ada
    // di schema, jadi dibaca langsung dari body).
    const turnstileToken =
      typeof (body as { turnstileToken?: unknown }).turnstileToken ===
      "string"
        ? (body as { turnstileToken: string }).turnstileToken
        : undefined;

    // Process
    const result = await requestPasswordReset(validated.email, turnstileToken);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[REQUEST_RESET_API_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}