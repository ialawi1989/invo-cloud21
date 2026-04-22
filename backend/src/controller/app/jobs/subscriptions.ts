
import { DB } from '@src/dbconnection/dbconnection';
import { CronJob } from 'cron';
import { ViewQueue } from '../../../utilts/viewQueue';
import { RedisClient } from '@src/redisClient';
import { ResponseData } from '@src/models/ResponseData';
import { json } from 'body-parser';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import SFTPClient from 'ssh2-sftp-client';

import { Company } from '@src/models/admin/company';
import { InvoicingRepo } from '@src/repo/adminApp/invoicing.Repo';
import { Request, Response, NextFunction } from 'express';
export class SubscriptionsJob {

	public job;
	constructor() {
		this.job = new CronJob(
			'0 5 0 * * *', // every day at 00:05
			() => this.processSubscriptions(),
		);
	}

	/**
	 * Daily cron job that:
	 * 1. Auto-renews subscriptions that ended today and have autoRenew = true
	 * 2. Expires subscriptions that have passed their endDate (without renewal)
	 * 3. Deactivates subscription items past their endDate
	 * 4. Marks overdue billing invoices
	 */
	async processSubscriptions() {
		const client = await DB.excu.client(120, "admin");
		try {
			await client.query("BEGIN");

			// 1. AUTO-RENEW company subscriptions ending today with autoRenew = true
			// Skip subscriptions that already have a successor period created manually
			const companiesToRenew = await client.query(
				`SELECT cs.* FROM admin."CompanySubscriptions" cs
				 WHERE cs.status = 'active'
				   AND cs."autoRenew" = true
				   AND cs."endDate" <= CURRENT_DATE
				   AND NOT EXISTS (
				       SELECT 1 FROM admin."CompanySubscriptions" succ
				       WHERE succ."companyId" = cs."companyId"
				         AND succ.id != cs.id
				         AND succ.status IN ('active', 'pending')
				         AND succ."startDate" >= cs."endDate"
				         AND succ."startDate" <= cs."endDate" + INTERVAL '7 days'
				   )`
			);

			for (const sub of companiesToRenew.rows) {
				const monthsToAdd = sub.billingCycle === 'yearly' ? 12 : 1;
				// Mark old as expired
				await client.query(
					`UPDATE admin."CompanySubscriptions" SET status = 'expired', "updatedAt" = NOW() WHERE id = $1`,
					[sub.id]
				);

				// Create a new subscription period
				const newSub = await client.query(
					`INSERT INTO admin."CompanySubscriptions"
					 ("companyId", "planId", status, "billingCycle", "startDate", "endDate", "renewalDate", "autoRenew", "basePrice", currency, notes)
					 VALUES ($1, $2, 'active', $3, $4,
					         ($4::DATE + ($5 || ' months')::INTERVAL)::DATE,
					         ($4::DATE + ($5 || ' months')::INTERVAL)::DATE,
					         true, $6, $7, $8)
					 RETURNING *`,
					[sub.companyId, sub.planId, sub.billingCycle, sub.endDate, monthsToAdd,
					 sub.basePrice, sub.currency, `Auto-renewed from ${sub.id}`]
				);
				const newSubId = newSub.rows[0].id;

				// Copy active subscription items to the new period
				await client.query(
					`INSERT INTO admin."SubscriptionItems"
					 ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate", "isActive")
					 SELECT $1, 'company', "featureId", quantity, "unitPrice", $2,
					        ($2::DATE + ($3 || ' months')::INTERVAL)::DATE, true
					 FROM admin."SubscriptionItems"
					 WHERE "subscriptionId" = $4 AND "subscriptionType" = 'company' AND "isActive" = true`,
					[newSubId, sub.endDate, monthsToAdd, sub.id]
				);

				// Log renewal
				await client.query(
					`INSERT INTO admin."SubscriptionChanges"
					 ("subscriptionId", "subscriptionType", "changeType", "effectiveDate", notes)
					 VALUES ($1, 'company', 'renewal', CURRENT_DATE, $2)`,
					[newSubId, `Auto-renewed from previous period (${sub.startDate} → ${sub.endDate})`]
				);
			}

			// 2. AUTO-RENEW branch subscriptions
			// Skip branches that already have a successor period created manually
			const branchesToRenew = await client.query(
				`SELECT bs.* FROM admin."BranchSubscriptions" bs
				 WHERE bs.status = 'active'
				   AND bs."autoRenew" = true
				   AND bs."endDate" <= CURRENT_DATE
				   AND NOT EXISTS (
				       SELECT 1 FROM admin."BranchSubscriptions" succ
				       WHERE succ."branchId" = bs."branchId"
				         AND succ.id != bs.id
				         AND succ.status IN ('active', 'pending')
				         AND succ."startDate" >= bs."endDate"
				         AND succ."startDate" <= bs."endDate" + INTERVAL '7 days'
				   )`
			);

			for (const sub of branchesToRenew.rows) {
				const monthsToAdd = sub.billingCycle === 'yearly' ? 12 : 1;
				await client.query(
					`UPDATE admin."BranchSubscriptions" SET status = 'expired', "updatedAt" = NOW() WHERE id = $1`,
					[sub.id]
				);

				const newSub = await client.query(
					`INSERT INTO admin."BranchSubscriptions"
					 ("branchId", "companyId", "planId", status, "billingCycle", "startDate", "endDate", "renewalDate", "autoRenew", "basePrice", currency, notes)
					 VALUES ($1, $2, $3, 'active', $4, $5,
					         ($5::DATE + ($6 || ' months')::INTERVAL)::DATE,
					         ($5::DATE + ($6 || ' months')::INTERVAL)::DATE,
					         true, $7, $8, $9)
					 RETURNING *`,
					[sub.branchId, sub.companyId, sub.planId, sub.billingCycle, sub.endDate, monthsToAdd,
					 sub.basePrice, sub.currency, `Auto-renewed from ${sub.id}`]
				);
				const newSubId = newSub.rows[0].id;

				await client.query(
					`INSERT INTO admin."SubscriptionItems"
					 ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate", "isActive")
					 SELECT $1, 'branch', "featureId", quantity, "unitPrice", $2,
					        ($2::DATE + ($3 || ' months')::INTERVAL)::DATE, true
					 FROM admin."SubscriptionItems"
					 WHERE "subscriptionId" = $4 AND "subscriptionType" = 'branch' AND "isActive" = true`,
					[newSubId, sub.endDate, monthsToAdd, sub.id]
				);

				await client.query(
					`INSERT INTO admin."SubscriptionChanges"
					 ("subscriptionId", "subscriptionType", "changeType", "effectiveDate", notes)
					 VALUES ($1, 'branch', 'renewal', CURRENT_DATE, $2)`,
					[newSubId, `Auto-renewed from previous period (${sub.startDate} → ${sub.endDate})`]
				);
			}

			// 3. Expire non-renewed subscriptions (autoRenew = false or already cancelled)
			await client.query(
				`UPDATE admin."CompanySubscriptions"
				 SET status = 'expired', "updatedAt" = NOW()
				 WHERE status = 'active' AND "endDate" < CURRENT_DATE`
			);
			await client.query(
				`UPDATE admin."BranchSubscriptions"
				 SET status = 'expired', "updatedAt" = NOW()
				 WHERE status = 'active' AND "endDate" < CURRENT_DATE`
			);

			// 4. Deactivate subscription items past their end date
			await client.query(
				`UPDATE admin."SubscriptionItems"
				 SET "isActive" = false, "updatedAt" = NOW()
				 WHERE "isActive" = true AND "endDate" IS NOT NULL AND "endDate" < CURRENT_DATE`
			);

			// 5. Mark overdue billing invoices
			await client.query(
				`UPDATE admin."BillingInvoices"
				 SET status = 'overdue', "updatedAt" = NOW()
				 WHERE status IN ('issued', 'partially_paid') AND "dueDate" < CURRENT_DATE`
			);

			await client.query("COMMIT");
			console.log(`[SubscriptionsJob] Done. Renewed ${companiesToRenew.rows.length} company + ${branchesToRenew.rows.length} branch subscriptions`);
		} catch (error) {
			await client.query("ROLLBACK");
			console.error('[SubscriptionsJob] Error processing subscriptions:', error);
		} finally {
			client.release();
		}
	}
}
