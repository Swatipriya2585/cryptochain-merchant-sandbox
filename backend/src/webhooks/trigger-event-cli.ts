import { prisma } from "../lib/prisma";
import { createFakeWebhookEvent, parseTriggerArgs } from "./trigger-event";

async function main(): Promise<void> {
  const input = parseTriggerArgs(process.argv.slice(2));
  const event = await createFakeWebhookEvent(input);
  console.log("");
  console.log("Created sandbox WebhookEvent");
  console.log(`  id:        ${event.id}`);
  console.log(`  type:      ${event.eventType}`);
  console.log(`  intent:    ${event.paymentIntentId}`);
  console.log(`  attempts:  ${event.attempts}`);
  console.log(`  delivered: ${event.deliveredSuccessfully}`);
  console.log("");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
