import IORedis from "ioredis";
import { Queue } from "bullmq";
import { env } from "./env.js";

export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const subRedis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const sendMessageQueue = new Queue("send-message", { connection: redis });

export function campaignChannel(campaignId: string): string {
  return `campaign:${campaignId}`;
}
