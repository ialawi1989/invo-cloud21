import { Request, Response, NextFunction } from "express";

import { ResponseData } from "@src/models/ResponseData";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { CloudFrontService } from "@src/AWS-SERVICES/cloudfront";

export class DomainController {

    public static async registerDomain(req: Request, res: Response, next: NextFunction) {
        try {
            const { domain, isSubdomain, subdomain } = req.body ?? {};
            const company = res.locals.company;

            if (!domain || typeof domain !== "string") {
                return res.send(new ResponseData(false, "Domain is required", []));
            }

            const cf = new CloudFrontService();

            if (isSubdomain) {
                if (!subdomain || typeof subdomain !== "string") {
                    return res.send(new ResponseData(false, "Subdomain is required", []));
                }
                const fullSubdomain = `${subdomain}.${domain}`;
                const tenant = await cf.createTenantWithSubdomain(fullSubdomain);

                const payload = {
                    domain,
                    subdomain,
                    isSubdomain: true,
                    distributionTenantId: tenant.tenantId,
                    cloudfrontDomain: tenant.cloudfrontDomain,
                    status: "Approved",
                };
                await CompanyRepo.setDomain(payload, company);
                return res.send(new ResponseData(true, "", payload));
            }

            // Custom domain — request cert first, return validation CNAME to tenant.
            const cert = await cf.requestCertificate(domain);
            const payload = {
                domain,
                isSubdomain: false,
                certificateArn: cert.arn,
                status: "pending_cert_validation",
            };
            await CompanyRepo.setDomain(payload, company);
            return res.send(new ResponseData(true, "", payload));
        } catch (error: any) {
             throw error;
        }
    }

    public static async approveDomain(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const result = await CompanyRepo.getDomain(company);
            const D = result?.data?.Domain;

            if (!D || !D.certificateArn) {
                return res.send(new ResponseData(false, "No pending domain to approve", []));
            }

            const cf = new CloudFrontService();
            const v = await cf.getValidationRecord(D.certificateArn);
            if (v.status !== "ISSUED") {
                return res.send(new ResponseData(false, `Certificate not ready: ${v.status ?? "UNKNOWN"}`, []));
            }

            // Idempotency: reuse an existing tenant if one is already attached
            // to this domain in CloudFront, even if our DB lost the reference.
            let existing: { tenantId: string; cloudfrontDomain: string } | null = null;
            if (D.distributionTenantId) {
                const t = await cf.getTenant(D.distributionTenantId);
                if (t?.tenantId) {
                    existing = {
                        tenantId: t.tenantId,
                        cloudfrontDomain: t.cloudfrontDomain ?? "",
                    };
                }
            }
            if (!existing) {
                existing = await cf.findTenantByDomain(D.domain);
            }
            if (existing) {
                const payload = {
                    ...D,
                    distributionTenantId: existing.tenantId,
                    cloudfrontDomain: existing.cloudfrontDomain || D.cloudfrontDomain,
                    status: "Approved",
                };
                await CompanyRepo.setDomain(payload, company);
                return res.send(new ResponseData(true, "Domain already approved", payload));
            }

            const tenant = await cf.createTenantWithCustomDomain(D.domain, D.certificateArn);
            const payload = {
                ...D,
                distributionTenantId: tenant.tenantId,
                cloudfrontDomain: tenant.cloudfrontDomain,
                status: "Approved",
            };
            await CompanyRepo.setDomain(payload, company);
            return res.send(new ResponseData(true, "", payload));
        } catch (error: any) {
             throw error;
        }
    }

    public static async deleteDomain(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const result = await CompanyRepo.getDomain(company);
            const D = result?.data?.Domain;

            if (!D) {
                return res.send(new ResponseData(true, "No domain to delete", []));
            }

            const cf = new CloudFrontService();
            const errors: string[] = [];

            // Resolve a tenant ID even if the DB lost it.
            let tenantId: string | undefined = D.distributionTenantId;
            if (!tenantId && D.domain) {
                const found = await cf.findTenantByDomain(D.domain);
                if (found) tenantId = found.tenantId;
            }

            if (tenantId) {
                try {
                    await cf.deleteTenant(tenantId);
                } catch (e: any) {
                    errors.push(`tenant: ${e.message}`);
                }
            }

            if (D.certificateArn) {
                try {
                    await cf.deleteCertificate(D.certificateArn);
                } catch (e: any) {
                    // Cert may already be gone or still in use elsewhere; surface but don't block.
                    errors.push(`certificate: ${e.message}`);
                }
            }

            await CompanyRepo.clearDomain(company);

            return res.send(new ResponseData(true, errors.join("; "), {
                deletedTenantId: tenantId ?? null,
                deletedCertificateArn: D.certificateArn ?? null,
            }));
        } catch (error: any) {
             throw error;
        }
    }

    public static async DomainStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const result = await CompanyRepo.getDomain(company);
            const D = result?.data?.Domain;

            if (!D) {
                return res.send(new ResponseData(false, "No domain registered", { Status: "No Data" }));
            }

            const cf = new CloudFrontService();

            if (D.status === "pending_cert_validation" && D.certificateArn) {
                const v = await cf.getValidationRecord(D.certificateArn);
                return res.send(new ResponseData(true, "", {
                    domain: D.domain,
                    isSubdomain: D.isSubdomain,
                    status: D.status,
                    certStatus: v.status,
                    validationCNAMEs: v.records,
                    validationCNAME: v.record, // deprecated; use validationCNAMEs
                }));
            }

            if (D.distributionTenantId) {
                const tenant = await cf.getTenant(D.distributionTenantId);
                if (!tenant) {
                    return res.send(new ResponseData(false, "Distribution tenant no longer exists in CloudFront", D));
                }
                return res.send(new ResponseData(true, "", {
                    ...D,
                    cloudfrontDomain: tenant.cloudfrontDomain || D.cloudfrontDomain,
                    tenantStatus: tenant.status,
                    tenantEnabled: tenant.enabled,
                }));
            }

            return res.send(new ResponseData(false, "Domain record incomplete", D));
        } catch (error: any) {
             throw error;
        }
    }

    public static async domainSimilarity(req: Request, res: Response, next: NextFunction) {
        try {
            const slug = req.params.slug;
            const resault = await CompanyRepo.getSlugSimilarty(slug);
            return res.send(resault);
        } catch (error: any) {
             throw error;
        }
    }

    public static async getSlugByDomain(req: Request, res: Response, next: NextFunction) {
        try {
            const resault = await CompanyRepo.getSlugByDomain(req.body.Domain);
            return res.send(resault);
        } catch (error: any) {
             throw error;
        }
    }
}
