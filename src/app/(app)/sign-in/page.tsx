import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { getPageContext } from "@/server/auth/page-context";
import { getIdentity } from "@/server/auth/actor";
import { getConfig } from "@/server/config/env";
import { devSignIn } from "@/app/actions/auth";
import { EmailSignIn } from "@/components/learner/email-sign-in";
import { SubmitButton } from "@/components/ui/form-controls";
import { Container, FieldError, Input, Label, Notice } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(value: string | undefined): string {
  return value && /^\/(?!\/)[\w\-/?=&%.]*$/.test(value) ? value : "/home";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  // Login remains an operator-only route. Old learner links enter the app.
  if (next !== "/staff" && !next.startsWith("/staff/")) redirect(next === "/sign-in" ? "/home" : next);
  const { t } = await getPageContext();
  const identity = await getIdentity();
  if (identity && identity.provider !== "browser") redirect(next);
  const config = getConfig();

  return (
    <Container width="prose" className="flex flex-col gap-10 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.signIn.title}</h1>
        <p className="text-muted">{t.signIn.lead}</p>
      </div>

      {config.auth.supabase ? (
        <EmailSignIn copy={t.signIn} next={next} />
      ) : (
        <Notice tone="warning" title={t.signIn.notConfigured}>
          NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — see docs/SETUP.md.
        </Notice>
      )}

      {config.auth.devAuthEnabled && !config.isProduction ? (
        <section
          aria-labelledby="dev-title"
          className="flex flex-col gap-4 rounded-lg border border-dashed border-warning/50 bg-warning-soft/40 p-5"
        >
          <div className="flex items-start gap-3">
            <FlaskConical aria-hidden className="mt-0.5 size-5 text-warning" />
            <div className="flex flex-col gap-1">
              <h2 id="dev-title" className="font-semibold">
                {t.signIn.devTitle}
              </h2>
              <p className="text-sm text-muted">{t.signIn.devBody}</p>
            </div>
          </div>
          <form action={devSignIn} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="dev-name">{t.signIn.devName}</Label>
              <Input id="dev-name" name="name" required maxLength={40} autoComplete="off" />
              {params.error === "dev_name" ? <FieldError>{t.signIn.devName}</FieldError> : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="staff" className="size-4 accent-[var(--color-accent)]" />
              {t.signIn.devStaff}
            </label>
            <div>
              <SubmitButton variant="secondary" pendingLabel={t.common.loading}>
                {t.signIn.devSubmit}
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}
    </Container>
  );
}
