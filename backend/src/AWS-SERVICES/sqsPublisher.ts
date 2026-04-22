// src/sqsPublisher.ts
import { Architecture, CreateEventSourceMappingCommand, CreateFunctionCommand, GetFunctionCommand, LambdaClient, ListEventSourceMappingsCommand, PackageType, ResourceNotFoundException, Runtime, UpdateEventSourceMappingCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import {
    SQSClient,
    GetQueueUrlCommand,
    CreateQueueCommand,
    SendMessageCommand,
    GetQueueAttributesCommand,
    ListQueuesCommand,
    ListQueueTagsCommand
} from "@aws-sdk/client-sqs";
import JSZip from "jszip";

//TODO: add AWS tags on the QUEUE


const sqsClient = getSqsClient();
function getSqsClient() {
    if(isEnabled()) {
        return new SQSClient({
            region: process.env.AWS_REGION || "me-south-1",
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
            }
        });
    }
    return null;
}

const lambda = new LambdaClient({
    region: process.env.AWS_REGION || "me-south-1",
    credentials: {
        accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
        secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
    }
});

const BATCH_SIZE = parseInt("10", 10);
const MAX_BATCHING_WINDOW_SECONDS = parseInt("0", 10);
const cache = new Map<string, string>();
const ROLE_ARN = process.env.AWS_ROLE;

async function buildPollerZip(): Promise<Buffer> {
    const zip = new JSZip();

    // CommonJS + AWS SDK v2 (preinstalled in Lambda runtime)
    const handlerCode = `import {
  LambdaClient,
  InvokeCommand,
  ListFunctionsCommand,
  ListTagsCommand,
} from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({ region: "${process.env.AWS_REGION || "me-south-1"}" });

async function getTaggedLambdas(tagKey, tagValue) {
  let functions = [];
  let marker;

  do {
    const res = await lambda.send(new ListFunctionsCommand({ Marker: marker }));
    if (res.Functions) {
      for (const fn of res.Functions) {
        if (!fn.FunctionArn) continue;

        // get tags for this lambda
        const tagRes = await lambda.send(
          new ListTagsCommand({ Resource: fn.FunctionArn })
        );

        if (tagRes.Tags) {
          const hasTag =
            tagKey in tagRes.Tags &&
            (tagValue ? tagRes.Tags[tagKey] === tagValue : true);

          if (hasTag) {
            functions.push({ target: fn.FunctionArn, name: fn.FunctionName });
          }
        }
      }
    }
    marker = res.NextMarker;
  } while (marker);

  return functions;
}

export const handler = async (sqsEvent) => {
  console.log(sqsEvent)
  const batchItemFailures = [];

  for (const r of sqsEvent.Records) {
    let evt;
    try {
      evt = JSON.parse(r.body);
    } catch (e) {
      console.error("JSON parse failed for messageId", r.messageId, "body:", r.body, "err:", e);
      // mark this record failed so SQS will retry it (if Partial Batch Response is enabled)
      batchItemFailures.push({ itemIdentifier: r.messageId });
      continue;
    }

    // Build the two async invokes
    let tasks = await getTaggedLambdas("queueName", process.env.queueName);
    tasks = tasks.map(({ target, name }) =>
      lambda.send(new InvokeCommand({
        FunctionName: target,
        InvocationType: "Event", // async fire-and-forget
        Payload: Buffer.from(JSON.stringify(evt)),
      }))
        .then(res => ({ ok: true, name, target, res }))
        .catch(err => ({ ok: false, name, target, err }))
    );

    const results = await Promise.all(tasks);

    // If any invoke was rejected, mark this SQS record as failed so it will be retried
    let thisRecordFailed = false;
    for (const r2 of results) {
      if (r2.ok) {
        console.log("Invoke accepted (202) =>", r2.name, r2.target);
      } else {
        thisRecordFailed = true;
        console.error("Invoke FAILED =>", r2.name, r2.target, "reason:", r2.err);
      }
    }

    if (thisRecordFailed) {
      batchItemFailures.push({ itemIdentifier: r.messageId });
    }
  }

  // IMPORTANT:
  // - Returning batchItemFailures tells the SQS/Lambda integration which messages to retry.
  // - Messages not listed here are deleted from the queue.
  return { batchItemFailures };
};
`;

    zip.file("index.mjs", handlerCode);
    return await zip.generateAsync({ type: "nodebuffer" });
}

function isEnabled(): boolean {
    const v = process.env.SQS_PUBLISH_ENABLED;
    if (v == null) return true; // default enabled
    return !/^(0|false|off|no)$/i.test(v.trim());
}

async function getQueueArnFromUrl(queueUrl: string): Promise<string> {
    if(!sqsClient) throw new Error("SQS is disabled");

    const res = await sqsClient.send(
        new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ["QueueArn"],
        })
    );
    const arn = res.Attributes?.QueueArn;
    if (!arn) throw new Error("Could not resolve QueueArn from QueueUrl");
    return arn;
}

async function getFunctionArn(name: string): Promise<string | null> {
    try {
        const res = await lambda.send(new GetFunctionCommand({ FunctionName: name }));
        return res.Configuration?.FunctionArn ?? null;
    } catch (e: any) {
        if (e instanceof ResourceNotFoundException || e?.name === "ResourceNotFoundException") return null;
        throw e;
    }
}
async function createOrUpdateLambda(functionName: string, queueName: string): Promise<string> {
    const zip = await buildPollerZip();
    const existingArn = await getFunctionArn(functionName);

    if (!existingArn) {
        const created = await lambda.send(
            new CreateFunctionCommand({
                FunctionName: functionName,
                Role: ROLE_ARN,
                Code: { ZipFile: zip },
                Architectures: [Architecture.arm64],
                Handler: "index.handler", // Required when sending a .zip file
                PackageType: PackageType.Zip, // Required when sending a .zip file
                Runtime: Runtime.nodejs18x, // Required when sending a .zip file
                Publish: true,
                Environment: {
                    Variables: {
                        queueName: queueName, // 👈 pass the queueName into the poller Lambda
                    },
                },
            })
        );
        if (!created.FunctionArn) throw new Error("CreateFunction returned no FunctionArn");
        return created.FunctionArn;
    } else {
        await lambda.send(
            new UpdateFunctionCodeCommand({
                FunctionName: functionName,
                ZipFile: zip,
                Publish: true,
            })
        );

        const current = await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
        const existingVars = current.Configuration?.Environment?.Variables ?? {};
        await lambda.send(
            new UpdateFunctionConfigurationCommand({
                FunctionName: functionName,
                Environment: {
                    Variables: {
                        ...existingVars,
                        queueName: queueName,
                    },
                },
            })
        );
        return existingArn;
    }
}


async function ensureSqsEventSource(queueArn: string, functionName: string) {
    const list = await lambda.send(
        new ListEventSourceMappingsCommand({
            EventSourceArn: queueArn,
            FunctionName: functionName,
        })
    );
    const existing = list.EventSourceMappings?.[0];

    if (!existing) {
        await lambda.send(
            new CreateEventSourceMappingCommand({
                EventSourceArn: queueArn,
                FunctionName: functionName,
                BatchSize: BATCH_SIZE,
                MaximumBatchingWindowInSeconds: MAX_BATCHING_WINDOW_SECONDS,
                Enabled: true,
            })
        );
        return;
    }

    const needsUpdate =
        (existing.BatchSize ?? 10) !== BATCH_SIZE ||
        (existing.MaximumBatchingWindowInSeconds ?? 0) !== MAX_BATCHING_WINDOW_SECONDS ||
        existing.State !== "Enabled";

    if (needsUpdate && existing.UUID) {
        await lambda.send(
            new UpdateEventSourceMappingCommand({
                UUID: existing.UUID,
                BatchSize: BATCH_SIZE,
                MaximumBatchingWindowInSeconds: MAX_BATCHING_WINDOW_SECONDS,
                Enabled: true,
                FunctionName: functionName,
            })
        );
    }
}


async function ensureLambdaWhenQueueCreated(queueName: string, queueURL: string) {
    const queueArn = await getQueueArnFromUrl(queueURL);
    const fnName = queueName + "-poller";
    const fnArn = await createOrUpdateLambda(fnName, queueName);
    await ensureSqsEventSource(queueArn, fnName);

    console.log(`[sqsPublisher] Ready Lambda for ${queueName}`, { fnName, fnArn, queueArn });
}


async function GetEventQueue(eventName: string): Promise<string> {
    if(sqsClient == null) throw "SQS events are disabled";
    if (cache.has(eventName)) return cache.get(eventName)!;
    const queueName = eventName + '_' + process.env.NODE_ENV;
    try {
        const res = await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }));
        cache.set(eventName, res.QueueUrl!);
        return res.QueueUrl!;
    } catch {
        const res = await sqsClient.send(
            new CreateQueueCommand({
                QueueName: queueName,
                Attributes: {},
                tags: {
                    createdBy: process.env.solotionName || "InvoBackEnd",
                }, // standard queue, no special attributes
            })
        );
        cache.set(eventName, res.QueueUrl!);
        ensureLambdaWhenQueueCreated(queueName, res.QueueUrl!).catch((e) => {
            console.error(`[sqsPublisher] ensureLambdaWhenQueueCreated failed for ${queueName}:`, e);
        });

        return res.QueueUrl!;
    }
}









export async function publishSqsEvent<T extends object>(
    eventName: string,
    payload: T,
    delaySeconds?: number
): Promise<string> {

    if (!sqsClient) {
        console.warn(
            `[sqsPublisher] Disabled by SQS_PUBLISH_ENABLED. Skipping send to ${eventName}`
        );
        return "SQS_PUBLISH_DISABLED";
    }
    try {
        const queueUrl = await GetEventQueue(eventName);
        const res = await sqsClient.send(
            new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify(payload),
                ...(delaySeconds ? { DelaySeconds: delaySeconds } : {}),
            })
        );
        return res.MessageId!;
    } catch (err) {
        console.error(`[sqsPublisher] Failed to publish to ${eventName}`, err);
        return "SQS_PUBLISH_ERROR";
    }
}


function buildFunctionName(webhookUrl: string, eventName: string, env: string | undefined) {
    const safeUrl = urlToSafeName(webhookUrl);
    const queueName = `${eventName}_${env || "dev"}`.replace(/[^a-zA-Z0-9-]/g, "-");
    let name = `wh-${safeUrl}-${queueName}`;
    if (name.length > 64) name = name.slice(0, 64);
    return name;
}


async function functionExists(name: string) {
    try {
        const res = await lambda.send(new GetFunctionCommand({ FunctionName: name }));
        return res.Configuration;
    } catch (e: any) {
        if (e?.name === "ResourceNotFoundException") return null;
        throw e;
    }
}



function urlToSafeName(url: string): string {
    try {
        const u = new URL(url);
        // use host + pathname so you can still identify it
        let base = (u.hostname + u.pathname)
            .replace(/[^a-zA-Z0-9-]/g, "-") // only valid chars
            .replace(/-+/g, "-");           // collapse multiple dashes

        // Lambda limit is 64 chars → cut if needed
        if (base.length > 40) {
            base = base.slice(0, 40);
        }

        return base;
    } catch {
        // fallback if invalid
        return url.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40);
    }
}

export async function Subscribe(eventName: string, webhookUrl: string) {
    try {
        if (!isEnabled()) {
            console.warn("SQS_PUBLISH_ENABLED=false: skipping webhook subscription");
            return "SQS_PUBLISH_DISABLED";
        }

        // Validate URL (fail fast)
        new URL(webhookUrl);

        const functionName = buildFunctionName(webhookUrl, eventName, process.env.NODE_ENV);
        // Ensure uniqueness without DB by appending a serial only if needed:
        // const functionName = await findAvailableName(functionBase);

        // Lambda handler code (create-only)
        const handlerCode = `
const lamdaName = "${functionName}";
export const handler = async (event) => {
const ac = new AbortController();
  const timeoutMs = Number(process.env.WEBHOOK_TIMEOUT_MS || 10000);
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(process.env.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json","x-lamdaName":lamdaName },
      body: JSON.stringify(event),
      signal: ac.signal
    });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    // Return as API Gateway style to be safe
    return { statusCode: res.status, body: typeof body === "string" ? body : JSON.stringify(body) };
  } catch (err) {
    console.error("Webhook call failed", err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err?.message || err) }) };
  } finally {
    clearTimeout(t);
  }
};
`;

        // Prepare zip
        const zipJs = new JSZip();
        zipJs.file("index.mjs", handlerCode);
        const zip = await zipJs.generateAsync({ type: "nodebuffer" });

        // If same name already exists, ensure it’s truly the same subscription
        const existing = await functionExists(functionName);
        if (existing) {
            // Read existing webhook URL from env if available
            const existingUrl = existing.Environment?.Variables?.WEBHOOK_URL;
            if (existingUrl === webhookUrl) {
                // Idempotent: same URL & name -> return ARN
                return existing.FunctionArn!;
            }
            // Different URL under same name (likely due to trimming collisions)
            // Since you want create-only: tell caller to pick a new URL/name or delete old one
            throw new Error(
                `Lambda "${functionName}" already exists for a different URL (${existingUrl}). Please unsubscribe/delete it first or use a different URL (the name was likely trimmed).`
            );
        }

        // Create-only flow
        const created = await lambda.send(
            new CreateFunctionCommand({
                FunctionName: functionName,
                Role: ROLE_ARN,
                Code: { ZipFile: zip },
                Architectures: [Architecture.arm64],
                Handler: "index.handler",
                PackageType: PackageType.Zip,
                Runtime: Runtime.nodejs18x,
                Timeout: 15,
                MemorySize: 128,
                Publish: true,
                Environment: {
                    Variables: {
                        WEBHOOK_URL: webhookUrl,
                        WEBHOOK_TIMEOUT_MS: "10000",
                    },
                },
                Tags: {
                    queueName: eventName + "_" + process.env.NODE_ENV,
                },
            })
        );

        if (!created.FunctionArn) throw new Error("CreateFunction returned no FunctionArn");
        return created.FunctionArn;
    } catch (err) {
        console.error(`[subscribe] Failed to create webhook function for ${eventName}`, err);
        return "SQS_PUBLISH_ERROR";
    }
}

//TODO: call in healthcheck api to check on this queue situation
export async function findMissingPollers() {
    if(!sqsClient) return;
    const res = await sqsClient.send(new ListQueuesCommand({}));
    const urls = res.QueueUrls || [];
    const output: any[] = [];

    for (const url of urls) {
        const queueName = url.split("/").pop()!;
        const tagsRes = await sqsClient.send(new ListQueueTagsCommand({ QueueUrl: url }));
        const tags = tagsRes.Tags || {};
        const tagName = process.env.solotionName || "InvoBackEnd"
        if (tags["createdBy"] !== tagName) {
            continue; // skip queues not created by us
        }
        const arn = (await sqsClient.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ["QueueArn"] }))).Attributes!.QueueArn!;
        const fn = queueName + "-poller";

        try {
            await lambda.send(new GetFunctionCommand({ FunctionName: fn }));
            const maps = (await lambda.send(new ListEventSourceMappingsCommand({ EventSourceArn: arn, FunctionName: fn }))).EventSourceMappings;
            if (!maps?.some(m => m.State === "Enabled")) output.push({ queue: queueName, reason: "NoEnabledMapping" });
        } catch (e: any) {
            if (e.name === "ResourceNotFoundException") output.push({ queue: queueName, reason: "FunctionMissing" });
            else throw e;
        }
    }

    return output;
}




