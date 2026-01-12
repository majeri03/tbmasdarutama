import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/actions/password-reset.actions";
import { requestPasswordResetSchema } from "@/lib/validations/password-reset.schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate
    const validated = requestPasswordResetSchema.parse(body);
    
    // Process
    const result = await requestPasswordReset(validated.email);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[REQUEST_RESET_API_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}