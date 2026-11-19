"use client";

import { useActionState } from "react";
import { requestEmailCode, verifyEmailCode, type SignInState } from "@/app/actions/auth";
import type { Messages } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";
import { FieldError, Input, Label } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form-controls";

type SignInCopy = Messages["signIn"];

export function EmailSignIn({ copy, next }: { copy: SignInCopy; next: string }) {
  const [state, setState] = useActionState<SignInState, FormData>(
    async (prev, formData) => {
      if (formData.get("intent") === "reset") return { step: "email" };
      return prev.step === "code" ? verifyEmailCode(prev, formData) : requestEmailCode(prev, formData);
    },
    { step: "email" },
  );

  if (state.step === "code") {
    return (
      <form action={setState} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-muted" role="status">
          {fmt(copy.codeSent, { email: state.email })}
        </p>
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">{copy.code}</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
            autoFocus
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "code-error" : undefined}
            className="font-mono tracking-[0.3em]"
          />
          {state.error ? (
            <FieldError id="code-error">
              {state.error === "rate_limited" ? copy.rateLimited : copy.invalidCode}
            </FieldError>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel={copy.verifying}>{copy.verify}</SubmitButton>
          <button
            type="submit"
            name="intent"
            value="reset"
            formNoValidate
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            {copy.useDifferentEmail}
          </button>
        </div>
      </form>
    );
  }

  const errorText =
    state.error === "invalid_email"
      ? copy.invalidEmail
      : state.error === "not_configured"
        ? copy.notConfigured
        : state.error === "rate_limited"
          ? copy.rateLimited
          : state.error === "failed"
            ? copy.sendFailed
            : null;

  return (
    <form action={setState} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{copy.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "email-error" : undefined}
        />
        {errorText ? <FieldError id="email-error">{errorText}</FieldError> : null}
      </div>
      <div>
        <SubmitButton pendingLabel={copy.sending}>{copy.sendCode}</SubmitButton>
      </div>
    </form>
  );
}
