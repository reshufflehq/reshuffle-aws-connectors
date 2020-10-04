import AWS from 'aws-sdk'
import crypto from 'crypto'
import objhash from 'object-hash'
import { CoreConnector, Options, Reshuffle } from './CoreConnector'

AWS.config.signatureVersion = 'v4'

export { AWS }

export function validateAccesKeyId(accessKeyId: string): string {
  if (!/^AK[A-Z0-9]{18}$/.test(accessKeyId)) {
    throw new Error(`Invalid accessKeyId: ${accessKeyId}`)
  }
  return accessKeyId
}

export function validateBucket(bucket: string): string {
  if (!bucket || !/(?=^.{3,63}$)(?!^(\d+\.)+\d+$)(^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$)/.test(bucket)) {
    throw new Error(`Invalid bucket: ${bucket}`)
  }
  return bucket
}

export function validateRegion(region: string): string {
  if (!/^(af|ap|ca|cn|eu|me|sa|us|us-gov)-(central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region)) {
    throw new Error(`Invalid region: ${region}`)
  }
  return region
}

export function validateS3URL(url: string): string {
  const match: any = url.match(/^s3:\/\/([^\/]+)\/(([^\/]+\/)*)([^\/]+)$/)
  try {
    validateBucket(match[1])
  } catch {
    throw new Error(`Invalid bucket in S3 URL: ${url}`)
  }
  return url
}

export function validateSecretAccessKey(secretAccessKey: string): string {
  if (!/^[A-Za-z0-9\/\+=]{40}$/.test(secretAccessKey)) {
    throw new Error(`Invalid secretAccessKey: ${secretAccessKey}`)
  }
  return secretAccessKey
}

export function validateURL(url: string): string {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error(`Invalid URL: ${url}`)
  }
  return url
}

class AWSAccount {
  private clients: Record<string, any> = {}

  constructor(private options: Options) {
    validateAccesKeyId(options.accessKeyId)
    validateSecretAccessKey(options.secretAccessKey)
    if (options.region) {
      validateRegion(options.region)
    }
  }

  public getClient(service: string, options: Options = {}): any {
    const opts = { ...this.options, ...options }
    const hash = objhash({ service, opts })
    if (!this.clients[hash]) {
      const constructor: any = (AWS as any)[service]
      this.clients[hash] = new constructor(opts)
    }
    return this.clients[hash]
  }

  public getCredentials() {
    return {
      accessKeyId: this.options!.accessKeyId,
      secretAccessKey: this.options!.secretAccessKey,
    }
  }
}

export interface AWSPolicyStatement {
  effect: string
  action: string[]
  resource: string
}

class AWSIdentity {
  constructor(private account: AWSAccount) {
  }

  public createPolicy(statements: AWSPolicyStatement | AWSPolicyStatement[]) {
    const sts = Array.isArray(statements) ? statements : [statements]

    return {
      Version: '2012-10-17',
      Statement: sts.map((st) => ({
        Effect: st.effect,
        Action: st.action,
        Resource: st.resource,
      })),
    }
  }

  public createSimplePolicy(
    resource: string,
    action: string[],
    effect = 'Allow',
  ) {
    return this.createPolicy({ effect, resource, action })
  }

  public async getOrCreateServiceRole(
    roleName: string,
    service: string,
    policies?: string | Record<string, any> | (string | Record<string, any>)[],
  ) {
    const iam = this.account.getClient('IAM')

    try {
      const res = await iam.getRole({ RoleName: roleName }).promise()
      return res.Role

    } catch (e) {
      if (e.code !== 'NoSuchEntity') {
        throw e
      }

      console.log(`Creating IAM role for service ${service}: ${roleName}`)
      const res = await iam.createRole({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: service,
              },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
      }).promise()

      const policiesArray =
        policies === undefined ? [] :
        Array.isArray(policies) ? policies :
        [policies]

      for (const policy of policiesArray) {
        if (typeof policy === 'string') {
          await iam.attachRolePolicy({
            RoleName: roleName,
            PolicyArn: policy,
          }).promise()
        } else {
          await iam.putRolePolicy({
            PolicyDocument: JSON.stringify(policy),
            PolicyName: `policy_${roleName}_${
              crypto.randomBytes(4).toString('hex')}`,
            RoleName: roleName,
          }).promise()
        }
      }

      // It takes a while for a service role to become assumable
      await new Promise((resolve) => setTimeout(resolve, 10000))

      return res.Role
    }
  }
}

export class BaseAWSConnector extends CoreConnector {
  protected account: AWSAccount
  protected identity: AWSIdentity

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    this.account = new AWSAccount(options)
    this.identity = new AWSIdentity(this.account)
  }
}
