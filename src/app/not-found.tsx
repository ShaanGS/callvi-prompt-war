import { getPageContext } from "@/server/auth/page-context";
import { ButtonLink } from "@/components/ui/button";

export default async function NotFound() {
  const { t } = await getPageContext();
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-prose flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t.errors.notFoundTitle}</h1>
      <p className="text-muted">{t.errors.notFoundBody}</p>
      <div>
        <ButtonLink href="/">{t.errors.home}</ButtonLink>
      </div>
    </main>
  );
}
