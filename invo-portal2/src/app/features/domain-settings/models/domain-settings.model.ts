/** One ACM validation record the customer adds to their DNS (InvoCloudBack `CloudFrontService.getValidationRecord`). */
export interface ValidationCname {
  Domain: string;
  /** 'SUCCESS' | 'PENDING_VALIDATION' | 'FAILED' ... */
  Status: string;
  Name: string;
  Value: string;
  Type?: string;
}

/** The company's custom domain (`company/domainStatus`). An empty `status` means no domain was registered yet. */
export interface DomainSettings {
  domain: string;
  subdomain: string;
  isSubdomain: boolean;
  /** '' (none) | 'pending_cert_validation' | 'Approved' */
  status: string;
  /** ACM certificate status while validating: 'PENDING_VALIDATION' | 'ISSUED' | 'FAILED' | 'EXPIRED' | 'REVOKED' | 'INACTIVE' */
  certStatus: string;
  certificateArn: string;
  distributionTenantId: string;
  cloudfrontDomain: string;
  validationCNAMEs: ValidationCname[];
}

export const emptyDomainSettings = (): DomainSettings => ({
  domain: '', subdomain: '', isSubdomain: true, status: '', certStatus: '', certificateArn: '',
  distributionTenantId: '', cloudfrontDomain: '', validationCNAMEs: [],
});

/** Body of `company/registerDomain`: a subdomain of the customer's domain, or the root domain itself. */
export type RegisterDomainPayload =
  | { domain: string; subdomain: string; isSubdomain: true }
  | { domain: string; isSubdomain: false };

export const CERT_TERMINAL_FAIL = ['FAILED', 'EXPIRED', 'REVOKED', 'INACTIVE'];
