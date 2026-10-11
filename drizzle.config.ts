import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: ["./db/schema.ts", "./db/profile-schema.ts", "./db/management-schema.ts", "./db/people-hub-schema.ts", "./db/sheets-sync-schema.ts", "./db/cpd-schema.ts", "./db/attendance-schema.ts", "./db/hr-service-schema.ts", "./db/connect-schema.ts", "./db/position-schema.ts", "./db/leave-schema.ts", "./db/nadi-auth-schema.ts", "./db/nadi-notification-schema.ts", "./db/payroll-schema.ts"],
  dialect: "sqlite",
});
