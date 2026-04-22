import AWS from "aws-sdk";
import {
  ACMClient,
  RequestCertificateCommandInput,
  ListCertificatesCommand,
  RequestCertificateCommand,
  GetCertificateCommand,
  DescribeCertificateCommand,
} from "@aws-sdk/client-acm";
import {
  ElasticLoadBalancingV2Client,
  CreateRuleInput,
  AddListenerCertificatesCommand,
  AddListenerCertificatesInput,
  CreateRuleCommand,
  DescribeListenersCommand,
  DescribeRulesCommand,
  DescribeLoadBalancersCommand,
  DescribeLoadBalancerAttributesCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
const LOAD_BALANCER_ARN = process.env.AWS_LOAD_BALANCER_ARN ?? "";
const LISTENER_ARN = process.env.AWS_LISTENER_ARN ?? "";
const TARGET_GROUP_ARN = process.env.AWS_TARGET_GROUP_ARN ?? "";

export class CertificateService {
  client: ACMClient;
  elasticLoadBalancingClient: ElasticLoadBalancingV2Client;

  constructor() {
    this.client = new ACMClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY
          ? process.env.AWS_ACCESS_KEY
          : "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          ? process.env.AWS_SECRET_ACCESS_KEY
          : "",
      },
    });

    this.elasticLoadBalancingClient = new ElasticLoadBalancingV2Client({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY
          ? process.env.AWS_ACCESS_KEY
          : "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          ? process.env.AWS_SECRET_ACCESS_KEY
          : "",
      },
    });
  }

  public async getCertificates() {
    const command = new ListCertificatesCommand({});
    const response = await this.client.send(command);
    return response.CertificateSummaryList;
  }

  public async getCertificateArnByDomain(Domain: any) {
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    await sleep(5000);
    const response = await this.getCertificates();
    const ARN = response?.find(
      (certificate: any) => certificate.DomainName == Domain,
    )?.CertificateArn;
    return ARN;
  }

  public async getCertificateByDomain(Domain: any) {
    const ARN = await this.getCertificateArnByDomain(Domain);

    const input = {
      // GetCertificateRequest
      CertificateArn: ARN, // required
    };

    const command = new DescribeCertificateCommand(input);
    const response = await this.client.send(command);
    return response;
  }

  public async getCNameByDomain(Domain: any) {
    const Certificate = await this.getCertificateByDomain(Domain);
    let data = JSON.stringify(
      Certificate?.Certificate?.DomainValidationOptions,
    );
    let data2 = JSON.parse(data);
    let name = data2[0]?.ResourceRecord.Name.split(".")[0] + ".";
    let data3 = {
      Name: name,
      Value: data2[0]?.ResourceRecord.Value.slice(0, -1),
      status: data2[0]?.ValidationStatus,
    };

    return data3;
  }

  public async createCertificate(Domain: any) {
    const input: RequestCertificateCommandInput = {
      DomainName: Domain,
      ValidationMethod: "DNS", // Assuming 'ValidationMethod' is an enum type provided by AWS SDK
    };
    const command = new RequestCertificateCommand(input);
    const response = await this.client.send(command);
    return response;
  }

  public async createSubDomainCertificate(Domain: any) {
    try {
      const input: RequestCertificateCommandInput = {
        DomainName: "*." + Domain,
        ValidationMethod: "DNS", // Assuming 'ValidationMethod' is an enum type provided by AWS SDK
      };
      const command = new RequestCertificateCommand(input);
      const response = await this.client.send(command);
      return response;
    } catch (e) {
      console.log(e);
    }
  }

  public async getLoadBalancer() {
    const input = {
      // DescribeLoadBalancerAttributesInput
      LoadBalancerArns: [
        // LoadBalancerArns
        LOAD_BALANCER_ARN,
      ],
    };
    const command = new DescribeLoadBalancersCommand(input);
    const response = await this.elasticLoadBalancingClient.send(command);
    return response;
  }

  public async getLoadBalancerListeners() {
    const input = {
      // DescribeLoadBalancerAttributesInput
      LoadBalancerArn: LOAD_BALANCER_ARN,
    };
    const command = new DescribeListenersCommand(input);
    const response = await this.elasticLoadBalancingClient.send(command);
    return response;
  }

  public async getLoadBalancerListenersRules() {
    const input = {
      // DescribeLoadBalancerAttributesInput
      ListenerArn: LISTENER_ARN,
    };
    const command = new DescribeRulesCommand(input);
    const response = await this.elasticLoadBalancingClient.send(command);
    return response?.Rules;
  }

  public async getLastRulePriority() {
    let rules = JSON.stringify(await this.getLoadBalancerListenersRules());
    const rules2 = JSON.parse(rules);
    const last = rules2[rules2.length - 2];
    return last.Priority;
  }

  public async createLoadBalancerListenersRule(subdomain: any, domain: any) {
    try {
      const Priority = parseInt(await this.getLastRulePriority()) + 1;
      const input: CreateRuleInput = {
        // CreateRuleInput
        ListenerArn: LISTENER_ARN, // required
        Conditions: [
          // RuleConditionList // required
          {
            // RuleCondition
            Field: "host-header",
            // Values: [subdomain +""+domain ],
            HostHeaderConfig: {
              // HostHeaderConditionConfig
              Values: [
                domain,
                subdomain + "." + domain,
                "www." + subdomain + "." + domain,
              ],
            },
          },
        ],
        Priority: Priority, // required
        Actions: [
          // Actions // required
          {
            // Action
            Type: "forward", // required
            TargetGroupArn: TARGET_GROUP_ARN,

            ForwardConfig: {
              // ForwardActionConfig
              TargetGroups: [
                // TargetGroupList
                {
                  // TargetGroupTuple
                  TargetGroupArn: TARGET_GROUP_ARN,
                  Weight: 1,
                },
              ],
              TargetGroupStickinessConfig: {
                // TargetGroupStickinessConfig
                Enabled: false,
              },
            },
          },
        ],
      };
      const command = new CreateRuleCommand(input);
      const response = await this.elasticLoadBalancingClient.send(command);
      return response;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  public async addCertificate(Domain: any, isSubdomain: any) {
    let Certificate;
    if (isSubdomain) {
      Certificate = await this.getCertificateByDomain("*." + Domain);
    } else {
      Certificate = await this.getCertificateByDomain(Domain);
    }

    const CertificateArn = Certificate?.Certificate?.CertificateArn;
    const input: AddListenerCertificatesInput = {
      ListenerArn: LISTENER_ARN,
      Certificates: [
        {
          // Certificate
          CertificateArn: CertificateArn,
        },
      ],
    };

    const command = new AddListenerCertificatesCommand(input);
    const response = await this.elasticLoadBalancingClient.send(command);
    return response;
  }
}
