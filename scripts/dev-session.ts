// Mints a signed session cookie for local screenshots and tests, without PayPal.
//   npm run -s dev-session -- company            -> value for the remedy_company cookie
//   npm run -s dev-session -- owner --payer TESTPAYER01 --unverified
// Prints the cookie VALUE only, so it can be captured: shots --cookie remedy_company=$(npm run -s dev-session -- company)
import { parseArgs } from "node:util";
import { mintSession, Role } from "../src/lib/session-token";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    payer: { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
    unverified: { type: "boolean", default: false },
  },
});

const role = Role.parse(positionals[0] ?? "company");
const fake = role === "company" ? { payer: "DEVCOMPANY01", name: "Kikea Store (dev)", email: "recalls@kikea.test" } : { payer: "DEVOWNER0001", name: "Pat Doe (dev)", email: "pat@owner.test" };

process.stdout.write(
  mintSession({
    role,
    payerId: values.payer ?? fake.payer,
    verified: !values.unverified,
    name: values.name ?? fake.name,
    email: values.email ?? fake.email,
  }) + "\n",
);
