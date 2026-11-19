import type { Metadata } from "next";
import { Ban, Database, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { fmt, formatDate, labelFor } from "@/lib/i18n";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { requireLearnerPage } from "@/server/auth/actor";
import { getPageContext } from "@/server/auth/page-context";
import { getDb } from "@/server/db/client";
import { learnersRepo } from "@/server/repositories/learners";
import { memoryService } from "@/server/services/memory-service";
import { preferenceValueSchemas } from "@/server/domain/types";
import {
  deleteAccount,
  deleteLearningMemory,
  deletePreference,
  resetConcept,
  setMemoryConsent,
  updateGoal,
  updatePreference,
  updateProfile,
} from "@/app/actions/learner";
import { SubmitButton } from "@/components/ui/form-controls";
import {
  Container,
  FieldError,
  Input,
  Label,
  Notice,
  PageHeader,
  Section,
  Select,
  Tag,
  Textarea,
} from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Privacy and memory" };

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const learner = await requireLearnerPage("/privacy");
  const { t, language } = await getPageContext();
  const params = await searchParams;
  const db = await getDb();
  const [summary, consentHistory] = await Promise.all([
    memoryService.getSummary(db, learner, language),
    learnersRepo.listConsentRecords(db, learner.id),
  ]);
  const p = t.privacy;
  const durable = summary.memoryMode === "durable";

  return (
    <Container className="flex flex-col gap-12 py-10">
      <PageHeader title={p.title} lead={p.lead} />

      {params.done ? (
        <Notice tone="success" role="status">
          {params.done === "goal" ? p.goalUpdated : params.done === "deleted" ? p.deleted : t.common.saved}
        </Notice>
      ) : null}
      {params.error ? (
        <Notice tone="danger" role="alert">
          {t.common.unknownError}
        </Notice>
      ) : null}

      {/* Memory setting */}
      <Section title={p.status} id="memory">
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {durable ? (
              <Database aria-hidden className="mt-0.5 size-5 text-accent" />
            ) : (
              <Ban aria-hidden className="mt-0.5 size-5 text-subtle" />
            )}
            <p className="text-ink">
              {summary.consentStatus === "pending" ? p.statusPending : durable ? p.statusOn : p.statusOff}
            </p>
          </div>
          <form action={setMemoryConsent}>
            {durable ? (
              <SubmitButton
                name="decision"
                value="revoked"
                variant="secondary"
                pendingLabel={t.common.saving}
                confirmMessage={p.turnOffConfirm}
              >
                {p.turnOff}
              </SubmitButton>
            ) : (
              <SubmitButton name="decision" value="granted" pendingLabel={t.common.saving}>
                {p.turnOn}
              </SubmitButton>
            )}
          </form>
        </div>
        <p className="flex gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          {p.neverList}
        </p>
      </Section>

      {/* Profile */}
      <Section title={p.profile} id="profile">
        <form action={updateProfile} className="grid max-w-xl gap-4">
          {durable ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{p.name}</Label>
              <Input
                id="name"
                name="name"
                maxLength={80}
                defaultValue={summary.profile.displayName ?? ""}
                placeholder={p.noName}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="language">{p.language}</Label>
            <Select id="language" name="language" defaultValue={summary.profile.preferredLanguage}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {t.languageNames[code]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <SubmitButton variant="secondary" pendingLabel={t.common.saving}>
              {t.common.save}
            </SubmitButton>
          </div>
        </form>
      </Section>

      {durable ? (
        <>
          {/* Goal */}
          <Section title={p.goal} id="goal">
            <form action={updateGoal} className="grid max-w-xl gap-3">
              <Label htmlFor="goal-text" className="sr-only">
                {p.goal}
              </Label>
              <Textarea
                id="goal-text"
                name="goal"
                minLength={3}
                maxLength={500}
                required
                defaultValue={summary.activeGoal?.text ?? ""}
                placeholder={p.noGoal}
              />
              {params.error === "goal" ? <FieldError>{t.onboarding.goal.tooShort}</FieldError> : null}
              {summary.activeGoal ? (
                <p className="text-xs text-subtle">
                  {p.source}: {labelFor(p.sources, summary.activeGoal.source)} ·{" "}
                  {fmt(p.updated, { date: formatDate(summary.activeGoal.updatedAt, language) })}
                </p>
              ) : null}
              <div>
                <SubmitButton variant="secondary" pendingLabel={t.common.saving}>
                  {t.common.save}
                </SubmitButton>
              </div>
            </form>
          </Section>

          {/* Preferences */}
          <Section title={p.preferences} id="preferences">
            <div className="grid max-w-xl gap-6">
              {(["explanation_style", "pace"] as const).map((key) => {
                const current = summary.preferences.find((pref) => pref.key === key);
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <form action={updatePreference} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <input type="hidden" name="key" value={key} />
                      <div className="flex flex-1 flex-col gap-2">
                        <Label htmlFor={`pref-${key}`}>{p.preferenceKeys[key]}</Label>
                        <Select id={`pref-${key}`} name="value" defaultValue={current?.value ?? ""}>
                          {current ? null : <option value="">—</option>}
                          {preferenceValueSchemas[key].options.map((value) => (
                            <option key={value} value={value}>
                              {p.preferenceValues[value]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <SubmitButton variant="secondary" pendingLabel={t.common.saving}>
                        {t.common.save}
                      </SubmitButton>
                    </form>
                    {current ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                        <span>
                          {p.source}: {labelFor(p.sources, current.source)} ·{" "}
                          {fmt(p.updated, { date: formatDate(current.updatedAt, language) })}
                        </span>
                        <form action={deletePreference}>
                          <input type="hidden" name="id" value={current.id} />
                          <SubmitButton
                            variant="ghost"
                            size="sm"
                            pendingLabel={t.common.saving}
                            icon={<Trash2 aria-hidden className="size-3.5" />}
                          >
                            {t.common.remove}
                          </SubmitButton>
                        </form>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Course progress */}
          <Section title={p.progressTitle} id="progress">
            {summary.enrollments.length === 0 ? (
              <p className="text-muted">{p.noProgress}</p>
            ) : (
              <div className="flex flex-col gap-6">
                {summary.enrollments.map((e) => (
                  <div key={e.id} className="flex flex-col gap-2">
                    <h3 className="font-semibold">{e.courseTitle}</h3>
                    {e.mastery.length === 0 ? (
                      <p className="text-sm text-muted">{e.currentLessonTitle}</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-line border-y border-line">
                        {e.mastery.map((m) => (
                          <li key={m.conceptId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="text-ink">{m.conceptTitle}</span>
                              <Tag>{t.room.state[m.state]}</Tag>
                              <span className="text-xs text-subtle">{formatDate(m.updatedAt, language)}</span>
                            </div>
                            <form action={resetConcept}>
                              <input type="hidden" name="enrollment_id" value={e.id} />
                              <input type="hidden" name="concept_id" value={m.conceptId} />
                              <SubmitButton
                                variant="ghost"
                                size="sm"
                                pendingLabel={t.common.saving}
                                confirmMessage={p.resetConfirm}
                                icon={<RotateCcw aria-hidden className="size-3.5" />}
                              >
                                {p.resetIdea}
                              </SubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            {summary.lastCheckpoint ? (
              <p className="max-w-prose text-sm text-muted">
                <span className="font-medium text-ink">
                  {p.checkpoint} · {formatDate(summary.lastCheckpoint.createdAt, language)}:
                </span>{" "}
                {summary.lastCheckpoint.summary}
              </p>
            ) : null}
          </Section>
        </>
      ) : (
        <Notice tone="info">{p.sessionOnlyNoEdit}</Notice>
      )}

      {/* Consent history */}
      <Section title={p.consentHistory} id="consent">
        <ul className="flex flex-col divide-y divide-line border-y border-line text-sm">
          {consentHistory.map((c) => (
            <li
              key={`${c.created_at.toISOString()}-${c.decision}`}
              className="flex flex-wrap justify-between gap-2 py-2"
            >
              <span className="text-ink">{labelFor(p.consentDecision, c.decision)}</span>
              <span className="text-subtle">{formatDate(c.created_at, language, true)}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Deletion */}
      <Section title={p.delete} id="delete">
        <div className="flex flex-col gap-6 rounded-lg border border-danger/30 p-5">
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">{p.deleteMemory}</h3>
            <p className="text-sm text-muted">{p.deleteMemoryBody}</p>
            <form action={deleteLearningMemory}>
              <SubmitButton
                variant="secondary"
                pendingLabel={t.common.saving}
                confirmMessage={p.deleteMemoryConfirm}
                icon={<Trash2 aria-hidden className="size-4" />}
              >
                {p.deleteMemory}
              </SubmitButton>
            </form>
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h3 className="font-semibold">{p.deleteAccount}</h3>
            <p className="text-sm text-muted">{p.deleteAccountBody}</p>
            <form action={deleteAccount} className="flex max-w-md flex-col gap-3">
              <Label htmlFor="confirm-delete">{p.deleteAccountConfirmLabel}</Label>
              <Input
                id="confirm-delete"
                name="confirm"
                autoComplete="off"
                required
                pattern="DELETE"
                className="font-mono"
              />
              {params.error === "confirm" ? <FieldError>{p.deleteAccountConfirmLabel}</FieldError> : null}
              <div>
                <SubmitButton
                  variant="danger"
                  pendingLabel={t.common.saving}
                  icon={<Trash2 aria-hidden className="size-4" />}
                >
                  {p.deleteAccount}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      </Section>
    </Container>
  );
}
