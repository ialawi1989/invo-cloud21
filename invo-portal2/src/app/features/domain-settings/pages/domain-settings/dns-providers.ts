export interface DnsProvider { id: string; name: string; url: string; steps: string[]; }

/** Step-by-step CNAME instructions per DNS provider (legacy `dnsProviders`, English as in the legacy page). */
export const DNS_PROVIDERS: DnsProvider[] = [
  {
    id: 'godaddy', name: 'GoDaddy', url: 'https://dcc.godaddy.com/control/portfolio',
    steps: [
      'Sign in to your GoDaddy account and open My Products.',
      'Next to your domain, click DNS (or Manage DNS).',
      'Under Records, click Add and choose CNAME from the Type dropdown.',
      'In Name, paste only the host part shown above (the leading portion before your domain).',
      'In Value, paste the full CNAME Value above.',
      'Set TTL to 1 Hour (or default) and click Save.',
    ],
  },
  {
    id: 'cloudflare', name: 'Cloudflare', url: 'https://dash.cloudflare.com',
    steps: [
      'Sign in to Cloudflare and select your domain.',
      'Open the DNS → Records tab and click Add record.',
      'Choose Type: CNAME.',
      'In Name, paste the host part (Cloudflare auto-strips your domain suffix).',
      'In Target, paste the CNAME Value.',
      'IMPORTANT: Set Proxy status to "DNS only" (gray cloud). Proxying breaks certificate validation.',
      'Click Save.',
    ],
  },
  {
    id: 'namecheap', name: 'Namecheap', url: 'https://ap.www.namecheap.com/domains/list',
    steps: [
      'Sign in to Namecheap and go to Domain List.',
      'Click Manage next to your domain, then open the Advanced DNS tab.',
      'Click Add New Record and select Type: CNAME Record.',
      'In Host, paste the host part shown above (without your domain suffix).',
      'In Value, paste the CNAME Value.',
      'Set TTL to Automatic and click the green check to save.',
    ],
  },
  {
    id: 'route53', name: 'AWS Route 53', url: 'https://console.aws.amazon.com/route53/',
    steps: [
      'Open the Route 53 console and select Hosted zones.',
      'Click your domain to open its records.',
      'Click Create record.',
      'In Record name, paste the host part (Route 53 appends the zone for you).',
      'Set Record type to CNAME.',
      'In Value, paste the CNAME Value.',
      'Leave Routing policy as Simple and click Create records.',
    ],
  },
  {
    id: 'google', name: 'Google Domains / Cloud DNS', url: 'https://domains.google.com/registrar',
    steps: [
      'Open Google Domains (or the Cloud DNS zone for your domain).',
      'Go to DNS → Manage custom records (or Add standard).',
      'Click Create new record.',
      'Set Type to CNAME.',
      'In Host name, paste the host part shown above.',
      'In Data, paste the CNAME Value.',
      'Save the record.',
    ],
  },
  {
    id: 'other', name: 'Other provider', url: '',
    steps: [
      'Log in to your DNS provider and open the DNS records / Zone editor for your domain.',
      'Add a new record with Type = CNAME.',
      'Set Host / Name to the host part shown above. Most providers strip the domain suffix automatically.',
      'Set Value / Target / Points to to the CNAME Value shown above. Keep any trailing dot.',
      'Use the default TTL and save.',
      'Wait a few minutes, then click Verify. DNS can take up to 30 minutes to propagate.',
    ],
  },
];
