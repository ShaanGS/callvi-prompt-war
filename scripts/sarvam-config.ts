import { agentInstructions, sarvamToolSetup } from "@/server/providers/sarvam/agent-setup";
import { arg, fail, loadEnv } from "./_shared";

const USAGE = "Usage: npm run sarvam:config -- --channel browser|phone [--app-url https://your-deployment] [--json]";
const channel = arg("channel");
if (channel !== "browser" && channel !== "phone") fail(USAGE);

const config = loadEnv();
const appUrl = arg("app-url") ?? config.appUrl;
if (!appUrl) fail(`Set APP_URL or pass --app-url.\n${USAGE}`);
if (!appUrl.startsWith("https://")) console.warn("Warning: Sarvam must reach the tool URLs over public HTTPS.");

const tools = sarvamToolSetup(appUrl, channel);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ channel, instructions: agentInstructions(channel), tools }, null, 2));
} else {
  console.log(`# Sarvam agent configuration — ${channel}\n`);
  console.log("## Agent instructions (paste into the agent prompt)\n");
  console.log(agentInstructions(channel));
  console.log("\n## API tools\n");
  for (const t of tools) {
    console.log(`### ${t.name}  (${t.whenToRun})`);
    console.log(`${t.method} ${t.url}`);
    console.log(`Auth: ${t.auth}`);
    console.log(`Description: ${t.description}`);
    console.log(`Body: ${JSON.stringify(t.bodyTemplate)}\n`);
  }
}
