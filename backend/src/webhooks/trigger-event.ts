#!/usr/bin/env node
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { deliverWebhookEvent } from "./dispatcher";
import {
  isWebhookEventType,
  normalizeEventType,
  statusForEventType,
  WEBHOOK_EVENT_TYPES,
} from "./event-types";

export type TriggerEventInput = {
  paymentIntentId: string;
  type: string;
  dispatch?: boolean;
  updateIntent?: boolean;
};

export async function createFakeWebhookEvent(input: TriggerEventInput) {
  const eventType = normalizeEventType(input.type);
  if (!isWebhookEventType(eventType)) {
    throw new Error(
      `Unknown event type "${input.type}". Use one of: ${WEBHOOK_EVENT_TYPES.join(", ")}`,
    );
  }

  const intent = await prisma.paymentIntent.findUnique({
    where: { id: input.paymentIntentId },
    include: { merchant: true },
  });
  if (!intent) {
    throw new Error(`PaymentIntent not found: ${input.paymentIntentId}`);
  }

  const toStatus = statusForEventType(eventType) ?? intent.status;
  const payload = {
    paymentIntentId: intent.id,
    merchantId: intent.merchantId,
    fromStatus: intent.status,
    toStatus,
    reference: intent.reference,
    source: "sandbox:trigger-event",
    fake: true,
  };

  const event = await prisma.$transaction(async (tx) => {
    if (input.updateIntent !== false && toStatus !== intent.status) {
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: toStatus as PaymentStatus },
      });
      await tx.auditLog.create({
        data: {
          paymentIntentId: intent.id,
          fromStatus: intent.status,
          toStatus,
          message: `Sandbox trigger-event ${eventType}`,
          metadata: payload,
        },
      });
    }

    return tx.webhookEvent.create({
      data: {
        paymentIntentId: intent.id,
        eventType,
        payload,
      },
    });
  });

  if (input.dispatch !== false) {
    await deliverWebhookEvent(event.id);
  }

  return event;
}

function readArg(flag: string, argv: string[]): string | undefined {
  const prefix = `${flag}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = argv.indexOf(flag);
  if (index >= 0) {
    return argv[index + 1];
  }
  return undefined;
}

export function parseTriggerArgs(argv: string[]): TriggerEventInput {
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  const paymentIntentId =
    readArg("--paymentIntentId", argv) ?? readArg("--payment-intent-id", argv) ?? positional[0];
  const type = readArg("--type", argv) ?? positional[1];
  if (!paymentIntentId || !type) {
    throw new Error(
      "Usage: npm run sandbox:trigger-event -- <paymentIntentId> <eventType>\n" +
        "   or: npm run sandbox:trigger-event -- --paymentIntentId=<id> --type=payment_intent.succeeded\n" +
        `Event types: ${WEBHOOK_EVENT_TYPES.join(", ")}`,
    );
  }
  return { paymentIntentId, type };
}
