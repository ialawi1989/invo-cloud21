import {
    ACMClient,
    RequestCertificateCommand,
    DescribeCertificateCommand,
    DeleteCertificateCommand,
} from "@aws-sdk/client-acm";
import {
    CloudFrontClient,
    CreateDistributionTenantCommand,
    GetDistributionTenantCommand,
    DeleteDistributionTenantCommand,
    GetConnectionGroupCommand,
    ListDistributionTenantsCommand,
} from "@aws-sdk/client-cloudfront";

const DISTRIBUTION_ID = process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID ?? "";
const ACM_REGION = process.env.AWS_ACM_CLOUDFRONT_REGION ?? "us-east-1";

export class CloudFrontService {
    private acm: ACMClient;
    private cloudfront: CloudFrontClient;

    constructor() {
        if (!DISTRIBUTION_ID) {
            throw new Error("AWS_CLOUDFRONT_DISTRIBUTION_ID is not set for this environment");
        }
        const credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY ?? "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
        };
        // CloudFront ACM certs MUST live in us-east-1.
        this.acm = new ACMClient({ region: ACM_REGION, credentials });
        this.cloudfront = new CloudFrontClient({ region: ACM_REGION, credentials });
    }

    public async requestCertificate(domain: string): Promise<{ arn: string }> {
        const res = await this.acm.send(
            new RequestCertificateCommand({
                DomainName: domain,
                SubjectAlternativeNames: [`www.${domain}`],
                ValidationMethod: "DNS",
            }),
        );
        if (!res.CertificateArn) {
            throw new Error("ACM did not return a certificate ARN");
        }
        return { arn: res.CertificateArn };
    }

    public async getValidationRecord(certArn: string) {
        const res = await this.acm.send(
            new DescribeCertificateCommand({ CertificateArn: certArn }),
        );
        const options = res.Certificate?.DomainValidationOptions ?? [];
        const records = options
            .filter((o) => o.ResourceRecord)
            .map((o) => ({
                Domain: o.DomainName,
                Status: o.ValidationStatus,
                Name: o.ResourceRecord!.Name,
                Value: o.ResourceRecord!.Value,
                Type: o.ResourceRecord!.Type,
            }));
        return {
            status: res.Certificate?.Status,
            records,
            // Kept for backwards compatibility with existing callers
            record: records[0] ?? null,
        };
    }

    public async createTenantWithCustomDomain(domain: string, certArn: string) {
        const res = await this.cloudfront.send(
            new CreateDistributionTenantCommand({
                DistributionId: DISTRIBUTION_ID,
                Name: this.toTenantName(domain),
                Domains: [{ Domain: domain }, { Domain: `www.${domain}` }],
                Customizations: {
                    Certificate: { Arn: certArn },
                },
                Enabled: true,
            }),
        );
        return this.extractTenant(res.DistributionTenant);
    }

    public async createTenantWithSubdomain(fullSubdomain: string) {
        const res = await this.cloudfront.send(
            new CreateDistributionTenantCommand({
                DistributionId: DISTRIBUTION_ID,
                Name: this.toTenantName(fullSubdomain),
                Domains: [{ Domain: fullSubdomain }],
                Enabled: true,
            }),
        );
        return this.extractTenant(res.DistributionTenant);
    }

    public async findTenantByDomain(domain: string) {
        const target = domain.toLowerCase();
        let marker: string | undefined;
        do {
            const res = await this.cloudfront.send(
                new ListDistributionTenantsCommand({
                    AssociationFilter: { DistributionId: DISTRIBUTION_ID },
                    Marker: marker,
                }),
            );
            for (const t of res.DistributionTenantList ?? []) {
                const matches = t.Domains?.some(
                    (d) => d.Domain?.toLowerCase() === target,
                );
                if (matches && t.Id) {
                    return {
                        tenantId: t.Id,
                        cloudfrontDomain: await this.resolveRoutingEndpoint(t.ConnectionGroupId),
                    };
                }
            }
            marker = res.NextMarker;
        } while (marker);
        return null;
    }

    public async getTenant(tenantId: string) {
        const res = await this.cloudfront.send(
            new GetDistributionTenantCommand({ Identifier: tenantId }),
        );
        const t = res.DistributionTenant;
        if (!t) return null;
        return {
            tenantId: t.Id,
            cloudfrontDomain: await this.resolveRoutingEndpoint(t.ConnectionGroupId),
            enabled: t.Enabled,
            status: t.Status,
            domains: t.Domains?.map((d) => d.Domain).filter(Boolean) ?? [],
        };
    }

    public async deleteTenant(tenantId: string) {
        const tenant = await this.cloudfront.send(
            new GetDistributionTenantCommand({ Identifier: tenantId }),
        );
        await this.cloudfront.send(
            new DeleteDistributionTenantCommand({
                Id: tenantId,
                IfMatch: tenant.ETag,
            }),
        );
    }

    public async deleteCertificate(certArn: string) {
        await this.acm.send(new DeleteCertificateCommand({ CertificateArn: certArn }));
    }

    private async extractTenant(t: any) {
        if (!t?.Id) throw new Error("CloudFront did not return a distribution tenant");
        return {
            tenantId: t.Id as string,
            cloudfrontDomain: await this.resolveRoutingEndpoint(t.ConnectionGroupId),
        };
    }

    // The CloudFront edge domain (xxx.cloudfront.net) lives on the connection
    // group, not the tenant. All tenants in the same connection group share it.
    private async resolveRoutingEndpoint(connectionGroupId?: string): Promise<string> {
        if (!connectionGroupId) return "";
        const res = await this.cloudfront.send(
            new GetConnectionGroupCommand({ Identifier: connectionGroupId }),
        );
        return res.ConnectionGroup?.RoutingEndpoint ?? "";
    }

    // CloudFront tenant names must be unique within the distribution and have
    // a restricted character set; convert dots to dashes for a safe identifier.
    private toTenantName(domain: string) {
        return domain.replace(/\./g, "-").toLowerCase();
    }
}
