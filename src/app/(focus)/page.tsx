import { getPageContext } from "@/server/auth/page-context";
import { getChannelReadiness } from "@/server/config/channels";
import { getConfig } from "@/server/config/env";
import { getDb } from "@/server/db/client";
import { homeView } from "@/server/services/views";
import { VoiceEntry } from "@/components/room/voice-entry";

export default async function VoiceHome({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { t, learner, language } = await getPageContext();
  const { deleted } = await searchParams;
  const home = learner ? await homeView(await getDb(), learner, language) : null;
  const channels = getChannelReadiness(getConfig());
  return (
    <VoiceEntry
      copy={{ app: t.app, room: t.room, common: t.common }}
      language={language}
      ready={channels.browserVoice.available}
      phoneNumber={channels.phone.available ? channels.phone.displayNumber : undefined}
      resumeTitle={home?.focus?.course.title ?? null}
      resumeSummary={home?.focus?.lastCheckpoint?.summary ?? null}
      deleted={Boolean(deleted)}
    />
  );
}
