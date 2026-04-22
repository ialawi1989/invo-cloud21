import { DB } from "@src/dbconnection/dbconnection"
import { PoolClient } from "pg"
import { Movment } from "./inventoryMovmentTrigger";
import format from "pg-format";

import { queueRedisConnection } from "@src/utilts/QueueRedisConnection";
import { DelayedError } from 'bullmq'
const redis = queueRedisConnection.get();
export class CostAllocationManager {

    /**
  * ✅ Advisory lock key helper (stable + no collisions per tenant if you add companyId too)
  * Using 2-int advisory lock: (hash(branchId), hash(productId))
  */
    private static async lockProductBranch(client: PoolClient, branchId: string, productId: string) {
        // pg_advisory_xact_lock works for the duration of the transaction
        await client.query(
            `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
            [branchId, productId],
        );
    }
    public static async minReallocationCost(client: PoolClient, companyId: string, branchId: string, referenceId: string, productId: string) {

        try {
            const query = {
                text: `WITH current_cost AS (
                            SELECT *
                            FROM "InventoryMovmentRecords"
                            WHERE "companyId" = $1
                            AND "branchId" =  $2
                            AND "productId"= $4
                            AND "referenceId" = $3
                        
                        ),
                        Nearest_breack_point AS (
                            SELECT max(imr."createdAt") AS "createdAt"
                            FROM current_cost cc
                            JOIN "InventoryMovmentRecords" imr
                            ON imr."companyId" = cc."companyId"
                            AND imr."branchId" = cc."branchId"
                            AND imr."productId" = cc."productId"
                            AND imr."createdAt" < cc."createdAt"
                            AND imr."qty" >=0 
                            and  imr."referenceTable" in ('Opening Balance','Manual Adjustment (UnitCost Adjustment)')
                        )
                        SELECT
                            cast  ("createdAt" as text) as "createdAt"
                        FROM Nearest_breack_point
                        UNION ALL
                        SELECT
                            cast  ( cc."createdAt" as text)  as "createdAt"
                        FROM current_cost cc
                        WHERE NOT EXISTS (SELECT 1 FROM Nearest_breack_point)`,
                values: [companyId, branchId, referenceId, productId]
            }

            let data = await client.query(query.text, query.values);
            return data && data.rows && data.rows.length > 0 ? data.rows[0].createdAt : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    private static makeToken(): string {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    public static async acquireLock(
        key: string,
        ttlMs: number
    ): Promise<string | null> {
        const token = this.makeToken();
        const res = await redis.set(key, token, "PX", ttlMs, "NX");
        return res === "OK" ? token : null;
    }



    public static async releaseLock(
        key: string,
        token: string
    ): Promise<boolean> {
        const lua = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
            else
            return 0
            end
  `;
        const res = await redis.eval(lua, 1, key, token);
        return Number(res) === 1;
    }
    public static async extendLock(
        key: string,
        token: string,
        ttlMs: number
    ): Promise<boolean> {
        const lua = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("PEXPIRE", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
        const res = await redis.eval(lua, 1, key, token, String(ttlMs));
        return Number(res) === 1;
    }
    public static async reallocateCost(
        job: any,
        productId: string,
        costId: string | null,
        branchId: string,
        companyId: string,
        isDeleted: boolean = false
    ) {

        const lockKey = `lock:unitCost:${productId}:${branchId}`;
        const token = await this.acquireLock(lockKey, 2 * 60 * 1000); // 2 min

        if (!token) {
            await job.moveToDelayed(Date.now() + (1000 * 60 * 5)); // (1000 * 60 * 5) after 5 min
            return;
        }
        let heartbeat: NodeJS.Timeout | null = null;
        // Get a DB client / connection

        const LOCK_TTL_MS = 2 * 60 * 1000; // 2 minutes lock TTL (set > worst-case work time)
        const HEARTBEAT_EVERY_MS = 20 * 1000; // extend every 20s
        const HEARTBEAT_TTL_MS = LOCK_TTL_MS; // renew back to full TTL

        heartbeat = setInterval(async () => {
            try {
                const ok = await this.extendLock(
                    lockKey,
                    token,
                    HEARTBEAT_TTL_MS
                );
                if (!ok) {
                    // If we can't extend, someone else might have taken over (or lock expired).
                    // We can't safely stop the job mid-flight without more design,
                    // but logging helps diagnose TTL issues.
                    console.warn(
                        `⚠️ Lost lock extension for product ${productId}`
                    );
                }
            } catch (e) {
                console.warn("⚠️ Heartbeat extend error:", e);
            }
        }, HEARTBEAT_EVERY_MS);

        const client = await DB.excu.client()
        try {


            // Start DB transaction
            await client.query("BEGIN")


            // Will hold the earliest date from which reallocation should start
            let startFrom

            // If a costId is provided, find the minimum reallocation date
            if (costId) {
                startFrom = await this.minReallocationCost(client, companyId, branchId, costId, productId);
            }

            // If the transaction was deleted, remove it from InventoryMovmentRecords
            if (isDeleted) {
                await client.query(
                    `DELETE FROM "InventoryMovmentRecords"
                 WHERE "companyId" = $1
                   AND "branchId" = $2
                   AND "referenceId" = $3`,
                    [companyId, branchId, costId]
                )
            }

            // Will store transactions whose cost or qty must be updated
            const updatedTransactions: any[] = []

            // Flag to know if any physical count caused a qty change
            let hasPhysicalCount = false

            // Track added and deleted unit cost adjustment transactions
            const addedUnitCostAdjustments: any[] = [];
            const deletedUnitCostAdjustments: any[] = [];
            let unitCostAdjustments: any[] = []

            // Optional date filter used when reallocating from a certain point
            let dateFilter = ''

            // Will store FIFO cost adjustments that must be applied later
            const adjustments: any[] = [];

            // Opening balance qty before reallocation
            let openingBalanceQty = 0;

            // Running opening qty used for physical count recalculation
            let physicalCountOpeningQty = 0
            let negativeUncoveredQty = 0
            // Transaction types that are considered "incoming" and keep their own cost
            const inTransactionTypes = [
                'InventoryTransfers',
                'Billing',
                'Opening Balance',
                'Supplier Credit',
                'Manual Adjustment (UnitCost Adjustment)'
            ]

            // Apply date filter if reallocation has a starting point
            if (startFrom) {
                dateFilter = ` AND "InventoryMovmentRecords"."createdAt" >= '${startFrom}' `
            }

            // Remove previously generated FIFO cost adjustment records
            await client.query(
                `DELETE FROM "InventoryMovmentRecords"
             WHERE "companyId" = $1
               AND "branchId" = $2
               AND "productId" = $3
               AND "referenceTable" = 'FIFO Cost Adjusment'
               ${dateFilter}`,
                [companyId, branchId, productId]
            )

            // Calculate opening balance qty before the reallocation start date
            if (startFrom) {
                const query = {
                    text: `
                    SELECT  COALESCE(SUM("qty"),0)  AS "qtyOpeningBalnace"
                    FROM "InventoryMovmentRecords"
                    WHERE "productId" = $1
                      AND "branchId" = $2
                      AND "createdAt" < $3
                     AND "referenceTable" NOT IN (
                                        'FIFO Cost Adjusment',
                                        'Manual Adjustment (UnitCost Adjustment)'
                                    );

                `,
                    values: [productId, branchId, startFrom]
                }

                const openingBalance = await client.query(query.text, query.values);

                // Initialize opening balance values
                if (openingBalance?.rows?.length > 0) {
                    openingBalanceQty = openingBalance.rows[0].qtyOpeningBalnace ?? 0
                    physicalCountOpeningQty = openingBalanceQty
                    negativeUncoveredQty = openingBalanceQty
                }
            }

            // Load all inventory transactions ordered by time
            const query = {
                text: `
                SELECT
                    "referenceId",
                    "branchId",
                    "companyId",
                    "referenceCostId",
                    "transactionId",
                    "referenceTable",
                    "qty",
                    "cost",
                    "costId",
                    CAST("createdAt" AS text),
                    SUM("qty") OVER (
                        ORDER BY "createdAt" ASC, "incrementalId" ASC
                    ) AS "qtyBalance"
                FROM "InventoryMovmentRecords"
                WHERE "companyId" = $1
                  AND "branchId" = $2
                  AND "productId" = $3
                  ${dateFilter}
                  AND "referenceTable" <> 'FIFO Cost Adjusment'
                ORDER BY "createdAt" ASC, "incrementalId" ASC
            `,
                values: [companyId, branchId, productId]
            }

            // Execute transaction query
            const transactionsData = await client.query(query.text, query.values);

            // Extract physical count reference IDs
            let physicalCountIds = transactionsData.rows
                .filter((f: any) => f.referenceTable == 'PhysicalCount')
                .map(f => f.referenceId);


            // unitCost Adjustments cost

            const unitCostAdjustmentIds = transactionsData.rows
                .filter((f: any) => f.referenceTable == 'Manual Adjustment (UnitCost Adjustment)' && f.qty >= 0)



            // Store physical count entered quantities
            let physicalCountTransactions: { id: string, enteredQty: number }[] = []

            // Load physical count lines if they exist
            if (physicalCountIds && physicalCountIds.length > 0) {
                const physicalCountQuery = {
                    text: `SELECT id, "enteredQty" FROM "PhysicalCountLines" WHERE "id" = ANY($1)`,
                    values: [physicalCountIds]
                }

                let physicalCountRows = await client.query(
                    physicalCountQuery.text,
                    physicalCountQuery.values
                )

                physicalCountTransactions = physicalCountRows.rows.map(f => ({
                    id: f.id,
                    enteredQty: f.enteredQty
                }))
            }

            // All transactions to be processed
            const listOfTransactions: any = transactionsData.rows

            // FIFO queue of incoming transactions
            let inTransactions: any[] = []

            // Track last known cost and its reference
            let lastCost = 0
            let lastCostId = null

            // Total quantity consumed so far
            let totalUsages = 0;


            let startIndex = 0


            // Iterate through all transactions in chronological order
            for (let index = startIndex; index < listOfTransactions.length; index++) {

                const current = listOfTransactions[index];

                // Parse DB row into Movment object
                const element = new Movment();
                element.ParseJson(current)

                let cost = 0
                if (physicalCountOpeningQty <= 0 && inTransactions.length > 0) {
                    lastCostId = inTransactions[inTransactions.length - 1].referenceId
                    lastCost = inTransactions[inTransactions.length - 1].cost
                    inTransactions = []
                }
                // Handle Physical Count transactions
                if (element.referenceTable == 'PhysicalCount') {
                    let currentPhysicalCount = physicalCountTransactions
                        .find(f => f.id == element.referenceId);

                    if (currentPhysicalCount && !isNaN(currentPhysicalCount.enteredQty)) {
                        let oldQty = element.qty;

                        // Adjust qty based on physical count difference
                        element.qty = currentPhysicalCount.enteredQty - physicalCountOpeningQty
                        physicalCountOpeningQty = currentPhysicalCount.enteredQty

                        // Detect if physical count caused a change
                        if (oldQty != element.qty) {
                            hasPhysicalCount = true
                        }
                    }
                } else if (
                    element.referenceTable !== 'FIFO Cost Adjusment' &&
                    element.referenceTable !== 'Manual Adjustment (UnitCost Adjustment)'
                ) {
                    physicalCountOpeningQty += element.qty;
                }
                negativeUncoveredQty += element.qty
                const transactionQty = element.qty

                // Incoming transaction
                if (transactionQty >= 0) {

                    /**
                     * Incoming transactions that are NOT part of the allowed list
                     * inherit the last known cost
                     */
                    if (!inTransactionTypes.includes(element.referenceTable)) {
                        element.cost = lastCost
                        updatedTransactions.push({ ...element })
                    }

                    // Handle Manual Unit Cost Adjustment
                    if (element.referenceTable === 'Manual Adjustment (UnitCost Adjustment)') {
                        let totalAdjQty = 0;

                        // Mark old manual adjustments for deletion
                        for (const adj of unitCostAdjustments) {
                            deletedUnitCostAdjustments.push(adj.referenceId);
                        }
                        deletedUnitCostAdjustments.push(element.referenceId);

                        // Reverse existing FIFO layers into adjustment lines
                        if (inTransactions.length > 0) {
                            const groupedByCost = new Map<number, number>();

                            for (const tx of inTransactions) {
                                const cost = Number(tx.cost);
                                const qty = Number(tx.qty || 0);

                                // Sum all FIFO adjustments for this transaction
                                const fifoQty = adjustments
                                    .filter(f => f.newCostId === tx.referenceId)
                                    .reduce((sum, f) => sum + (f.adjustedQty || 0), 0);

                                const totalQty = qty - fifoQty;
                                if (totalQty <= 0) continue;

                                groupedByCost.set(cost, (groupedByCost.get(cost) || 0) + totalQty);
                            }

                            // Push adjustments per cost
                            for (const [cost, totalQty] of groupedByCost.entries()) {
                                const netQty = Math.max(0, totalQty);
                                if (netQty <= 0) continue;

                                totalAdjQty += netQty;

                                addedUnitCostAdjustments.push({
                                    ...element,
                                    qty: netQty * -1,
                                    cost,
                                    productId: productId
                                });
                            }
                        }

                        // Update element qty to total manual adjustment applied
                        element.qty = Math.abs(totalAdjQty);
                        element.productId = productId
                        // physicalCountOpeningQty = totalAdjQty;

                        // Reset state
                        unitCostAdjustments = [];
                        inTransactions = [];

                        // ✅ Remove the push of the main element itself — already accounted above
                        addedUnitCostAdjustments.push({ ...element });
                    }

                    // Push incoming transaction to FIFO queue
                    inTransactions.push(element)
                    totalUsages += element.qty;

                    // Track cost changes when negative inventory is resolved
                    if (index > 0) {
                        const lastTransaction = listOfTransactions[index - 1]
                        if (
                            lastTransaction &&
                            (negativeUncoveredQty - element.qty) < 0 &&
                            lastCost != element.cost
                            && element.referenceTable != 'PhysicalCount'
                            && element.referenceTable != 'Manual Adjustment (UnitCost Adjustment)'
                        ) {
                            lastCostId = lastCostId == '' ? null : lastCostId
                            adjustments.push({
                                oldCost: lastCost,
                                oldCostId: lastCostId ?? null,
                                newCost: element.cost,
                                newCostId: element.referenceId,
                                adjustedQty: Math.abs((negativeUncoveredQty - element.qty)),
                                greatestDate: element.createdAt,
                                productId,
                                branchId,
                                companyId: element.companyId
                            })
                        }
                    }

                    // Update last known cost
                    lastCost = element.cost;
                    lastCostId = element.referenceId;


                } else {
                    // Outgoing transaction (usage)

                    /** in case the first transaction returned is not a cost entry (check min date) */
                    if (index == 0) {
                        lastCost = element.cost
                    }
                    // Collect unit cost adjustment usage
                    if (element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)') {
                        unitCostAdjustments.push(element);
                        continue;
                    }

                    // Supplier credits do not affect FIFO usage
                    if (element.referenceTable == 'Supplier Credit') {
                        continue;
                    }

                    let remainingUsage = Math.abs(transactionQty);
                    let totalCost = 0;

                    // If no inventory exists, inherit last cost
                    if (inTransactions.length == 0) {
                        element.cost = lastCost;
                        updatedTransactions.push({ ...element })
                        continue;
                    } else {
                        // FIFO consumption loop
                        while (remainingUsage > 0 && inTransactions.length > 0) {
                            const currentCost = inTransactions[0];

                            if (currentCost.qty < 0) {
                                inTransactions.shift()
                                continue;
                            }

                            if (currentCost.qty <= remainingUsage) {
                                totalCost += currentCost.qty * currentCost.cost;
                                lastCost = currentCost.cost;
                                lastCostId = currentCost.referenceId;
                                remainingUsage -= currentCost.qty;
                                totalUsages -= currentCost.qty;
                                inTransactions.shift();
                            } else {
                                totalCost += remainingUsage * currentCost.cost;
                                lastCost = currentCost.cost;
                                lastCostId = currentCost.referenceId;
                                currentCost.qty -= remainingUsage;
                                totalUsages -= remainingUsage;
                                remainingUsage = 0;
                            }
                        }

                        // Cost for uncovered qty uses last known cost
                        let remainingQtyWithNoInventory = remainingUsage * lastCost;
                        cost = totalCost + remainingQtyWithNoInventory

                        // Assign average cost to outgoing transaction
                        element.cost = element.qty !== 0
                            ? cost / Math.abs(element.qty)
                            : 0;

                        updatedTransactions.push({ ...element })
                    }
                }
            }

            // Prepare updated transaction values for bulk update
            const transactionValues = updatedTransactions.map(update => [
                update.referenceId,
                update.cost,
                productId,
                update.qty,
                update.branchId
            ]);

            // Delete obsolete unit cost adjustments
            if (deletedUnitCostAdjustments.length > 0) {
                const tempDeleted = [... new Set(deletedUnitCostAdjustments)]
                await client.query(
                    `
                DELETE FROM "InventoryMovmentRecords"
                WHERE "companyId" = $1
                  and "branchId" = $2
                  AND "productId" = $3
                  and "referenceId" = any($4)
                  AND "referenceTable" = 'Manual Adjustment (UnitCost Adjustment)'
                `,
                    [companyId, branchId, productId, tempDeleted]
                )
            }
            const BATCH_SIZE = 100;
            // Insert newly generated unit cost adjustments
            if (addedUnitCostAdjustments.length > 0) {

                const tempAdded = this.uniqueAdjustments(addedUnitCostAdjustments);
                if (tempAdded && tempAdded.length > 0) {


                    const insertQuery = `
                INSERT INTO "InventoryMovmentRecords" (
                    "referenceId",
                    "productId",
                    "branchId",
                    "qty",
                    "cost",
                    "createdAt",
                    "referenceTable",
                    "companyId"
                )
                SELECT
                    data."referenceId"::uuid,
                    data."productId"::uuid,
                    data."branchId"::uuid,
                    data.qty::real,
                    data.cost::real,
                    data."createdAt"::timestamp,
                    data."referenceTable",
                    data."companyId"::uuid
                FROM (VALUES %L) AS data(
                    "referenceId",
                    "productId",
                    "branchId",
                    qty,
                    cost,
                    "createdAt",
                    "referenceTable",
                    "companyId",
                    "transactionId"
                );
            `;

                    const insertValues = tempAdded.map(t => [
                        t.referenceId,
                        productId,
                        t.branchId,
                        t.qty,
                        t.cost,
                        t.createdAt,
                        t.referenceTable,
                        t.companyId,
                        t.transactionId
                    ]);

                    for (let i = 0; i < insertValues.length; i += BATCH_SIZE) {
                        const batch = insertValues.slice(i, i + BATCH_SIZE);

                        const formattedInsert = format(insertQuery, batch);
                        await client.query(formattedInsert);
                    }
                }
            }

            // Apply cost and qty updates to InventoryMovmentRecords
            if (transactionValues.length > 0) {
                const updateQuery = `
                UPDATE "InventoryMovmentRecords"
                SET "cost" = data.cost::real,
                    "qty" = CASE
                        WHEN "referenceTable" IN ('PhysicalCount')
                        THEN data."qty"::numeric
                        ELSE "InventoryMovmentRecords"."qty"
                    END
                FROM (VALUES %L) AS data(
                    "referenceId",
                    cost,
                    "productId",
                    "qty",
                    "branchId"
                )
                WHERE   "InventoryMovmentRecords"."productId" = data."productId"::uuid  
                  AND "InventoryMovmentRecords"."branchId" = data."branchId"::uuid
                  AND  "InventoryMovmentRecords"."referenceId" = data."referenceId"::uuid 
                  ;
            `;
                for (let i = 0; i < transactionValues.length; i += BATCH_SIZE) {
                    const batch = transactionValues.slice(i, i + BATCH_SIZE);
                    const formattedQuery = format(updateQuery, batch);
                    await client.query(formattedQuery);
                }
                // Apply FIFO cost adjustments
                await this.setAdjusment(client, adjustments)
            }

            // Final on-hand quantity after reallocation
            let totalQty = physicalCountOpeningQty;

            /**
             * If physical count changed any qty,
             * reset BranchProducts.onHand to the recalculated value
             */
            if (hasPhysicalCount) {
                await client.query(
                    `UPDATE "BranchProducts"
                 SET "onHand" = $1
                 WHERE "branchId" = $2
                   AND "productId" = $3`,
                    [totalQty, branchId, productId]
                )
            }

            // Commit transaction
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")
            if (heartbeat) clearInterval(heartbeat);
            if (error instanceof DelayedError) {
                throw error;
            }

            throw error;
        } finally {
            if (heartbeat) clearInterval(heartbeat);
            const released = await this.releaseLock(lockKey, token);
            if (!released) {
                // This can happen if TTL expired and another job acquired lock.
                // If you see this often, increase LOCK_TTL_MS or ensure heartbeat is stable.
                console.warn(
                    `⚠️ Lock not released (token mismatch/expired) for ${productId}`
                );
            }
            // Release DB client
            client.release()
        }
    }



    private static async setAdjusment(client: PoolClient, data: any[]) {
        try {
            const values: any[][] = [];

            for (const element of data) {
                values.push([
                    element.productId,
                    element.greatestDate,
                    element.branchId,
                    'FIFO Cost Adjusment',
                    Math.abs(element.adjustedQty),
                    element.oldCost,
                    element.oldCostId ?? null,
                    element.newCostId,
                    element.companyId
                ]);

                values.push([
                    element.productId,
                    element.greatestDate,
                    element.branchId,
                    'FIFO Cost Adjusment',
                    Math.abs(element.adjustedQty) * -1,
                    element.newCost,
                    element.newCostId,
                    element.oldCostId ?? null,
                    element.companyId
                ]);
            }

            if (!values.length) return;

            const insertQuery = `
                        INSERT INTO "InventoryMovmentRecords"
                        ("productId","createdAt","branchId","referenceTable","qty","cost","costId","adjustedWithCostId","companyId")
                        VALUES %L
    `;

            const BATCH_SIZE = 100;

            for (let i = 0; i < values.length; i += BATCH_SIZE) {
                const batch = values.slice(i, i + BATCH_SIZE);
                await client.query(format(insertQuery, batch));
            }

        } catch (error: any) {

            throw error;
        }
    }
    static uniqueAdjustments(adjustments: any[]) {
        const map = new Map<string, any>();

        for (const adj of adjustments) {
            const key = `${adj.referenceId}_${adj.cost}_${adj.qty}`;
            if (!map.has(key)) {
                map.set(key, adj);
            }
        }

        return Array.from(map.values());
    }

    public static async reallocateTheProducts(job: any, data: any) {
        try {

            const products = data.products;
            const branchId = data.branchId;
            const companyId = data.companyId;
            for (let index = 0; index < products.length; index++) {
                const productId = products[index];
                await this.reallocateCost(job, productId, null, branchId, companyId, false)
            }


        } catch (error: any) {
            throw new Error(error)
        }
    }
}