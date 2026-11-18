import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireLearnerPage } from "@/server/auth/actor";
import { getPageContext } from "@/server/auth/page-context";
import { getConfig } from "@/server/config/env";
import { getChannelReadiness } from "@/server/config/channels";
import { getDb } from "@/server/db/client";
import { sessionService } from "@/server/services/session-service";
import { sessionView } from "@/server/services/views";
import { browserVoiceConfig } from "@/server/providers/browser-voice";
import { LearningRoom } from "@/components/room/learning-room";

export const metadata: Metadata = { title: "Learning session" };

export default async function LearningRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!z.string().uuid().safeParse(sessionId).success) notFound();
  const learner = await requireLearnerPage(`/learn/${sessionId}`);
  const { t } = await getPageContext();
  const db = await getDb();
  const session = await sessionService.getOwned(db, sessionId, learner.id).catch(() => null);
  if (!session) notFound();
  const view = await sessionView(db, learner, session);

  // Browser voice: a fresh signed token for this session. No provider secret reaches the page.
  const voiceReady = getChannelReadiness(getConfig()).browserVoice.available;
  const voice = session.channel === "browser" && view.open && voiceReady ? browserVoiceConfig(learner, session) : null;

  return <LearningRoom key={session.id} initialView={view} voice={voice} copy={{ app: t.app, room: t.room, common: t.common }} />;
}
