import { Redis as IORedis } from "ioredis";
import { Queue } from "bullmq";
import { env } from "./env.js";

export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const subRedis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const sendMessageQueue = new Queue("send-message", { connection: redis });

export function campaignChannel(campaignId: string): string {
  return `campaign:${campaignId}`;
}

/** Shared constants used by both the API and worker to coordinate Baileys. */
export const WA_CONTROL_CHANNEL = "wa:control";
export function baileysPairChannel(orgId: string): string {
  return `wa:pair:${orgId}`;
}
