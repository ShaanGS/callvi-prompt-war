import type { StaffRole } from "@/server/domain/types";
import { staffRepo } from "@/server/repositories/learners";
import { arg, fail, loadEnv, openDb, run } from "./_shared";

const USAGE = `Usage:
  npm run staff:grant -- --subject <supabase-auth-user-uuid> [--role staff|admin] [--email-hint a…@example.org]
  npm run staff:grant -- --subject <uuid> --revoke

The subject is the user's id in Supabase Auth (Authentication → Users).`;

const subject = arg("subject");
const roleArg = arg("role") ?? "staff";
const revoke = process.argv.includes("--revoke");
if (!subject || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject)) fail(USAGE);
if (roleArg !== "staff" && roleArg !== "admin") fail(USAGE);
const role: StaffRole = roleArg;

run(async () => {
  const config = loadEnv();
  const db = openDb(config);
  try {
    if (revoke) {
      await staffRepo.revoke(db, "supabase", subject);
      console.log(`Removed staff access for ${subject}.`);
    } else {
      await staffRepo.grant(db, { provider: "supabase", subject, role, emailHint: arg("email-hint") ?? null });
      console.log(`Granted ${role} to ${subject}.`);
    }
  } finally {
    await db.close();
  }
});
