import { getPublicLandingData } from "@/lib/actions/landing-public.actions";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const result = await getPublicLandingData();
  const logoUrl = result.data?.store?.logoUrl ?? null;

  return (
    <div>
      <LoginForm logoUrl={logoUrl} />
    </div>
  );
}