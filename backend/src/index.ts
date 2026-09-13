import { createApp } from "./app";
import { getConfig } from "./config";

const config = getConfig();

if (config.nodeEnv === "production") {
  console.warn(
    "Never point NODE_ENV=production at a wallet holding real funds without going through the cutover checklist in /infra/CUTOVER_CHECKLIST.md",
  );
}

const app = createApp();

app.listen(config.port, () => {
  console.log(`cryptochain-sandbox backend listening on :${config.port} (${config.nodeEnv})`);
});
