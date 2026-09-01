/** Dev-only: end-to-end login check for the seeded QA accounts. */
import "dotenv/config";
import { login } from "../src/modules/auth/auth.service.js";
import { verifyAccessToken } from "../src/modules/auth/auth-token.js";

const cases: Array<{ email: string; password: string; expectRole: string }> = [
  { email: "bahaa@crm.com", password: "123", expectRole: "ADMIN" },
  { email: "bahaa@crm.com", password: "wrong", expectRole: "REJECT" },
  { email: "admin1@crm.local", password: "password123", expectRole: "ADMIN" },
  { email: "manager1@crm.local", password: "password123", expectRole: "MANAGER" },
  { email: "manager2@crm.local", password: "password123", expectRole: "MANAGER" },
  { email: "agent1@crm.local", password: "password123", expectRole: "AGENT" },
  { email: "agent8@crm.local", password: "password123", expectRole: "AGENT" },
  { email: "portal.customer@crm.local", password: "password123", expectRole: "CUSTOMER" },
];

async function main() {
  let ok = 0;
  let fail = 0;
  for (const c of cases) {
    try {
      const res = await login({ email: c.email, password: c.password });
      const claims = verifyAccessToken(res.token);
      const pass = c.expectRole !== "REJECT" && res.user.role === c.expectRole && claims.role === c.expectRole && claims.userId === res.user.id;
      console.log(`${pass ? "PASS" : "FAIL"}  ${c.email.padEnd(28)} -> role=${res.user.role} token=${claims.role === res.user.role ? "valid" : "MISMATCH"}`);
      pass ? ok++ : fail++;
    } catch (e) {
      const rejectedAsExpected = c.expectRole === "REJECT";
      console.log(`${rejectedAsExpected ? "PASS" : "FAIL"}  ${c.email.padEnd(28)} -> rejected (${(e as Error).message})`);
      rejectedAsExpected ? ok++ : fail++;
    }
  }
  console.log(`\n${ok}/${ok + fail} passed`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
