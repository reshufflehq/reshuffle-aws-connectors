import AWS from 'aws-sdk'
import objhash from 'object-hash'
import { CoreConnector, Options, Reshuffle } from './CoreConnector'

AWS.config.signatureVersion = 'v4'

export { AWS }

class AWSAccount {
  private options?: Options
  private clients: Record<string, any> = {}

  public getClient(service: string, options: Options = {}): any {
    if (!this.options) {
      throw new Error(
        'Account not initialized. Use update() to set account options',
      )
    }
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

  public update(options: Options): void {
    validateAccesKeyId(options.accessKeyId)
    validateSecretAccessKey(options.secretAccessKey)
    if (options.region) {
      validateRegion(options.region)
    }

    this.options = options
    this.clients = {}
  }
}

export class BaseAWSConnector extends CoreConnector {
  protected account = new AWSAccount()

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    this.updateOptions(options)
  }

  protected onOptionsChanged(options: Options) {
    this.account.update(options)
  }
}

export function validateAccesKeyId(accessKeyId: string): string {
  if (
    typeof accessKeyId !== 'string' ||
    !/^AK[A-Z0-9]{18}$/.test(accessKeyId)
  ) {
    throw new Error(`Invalid accessKeyId: ${accessKeyId}`)
  }
  return accessKeyId
}

export function validateBucket(bucket: string): string {
  if (
    typeof bucket !== 'string' ||
    !/(?=^.{3,63}$)(?!^(\d+\.)+\d+$)(^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$)/.test(bucket)
  ) {
    throw new Error(`Invalid bucket: ${bucket}`)
  }
  return bucket
}

export function validateRegion(region: string): string {
  if (
    typeof region !== 'string' ||
    !/^(af|ap|ca|cn|eu|me|sa|us|us-gov)-(central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region)
  ) {
    throw new Error(`Invalid region: ${region}`)
  }
  return region
}

export function validateS3URL(url: string): string {
  const match: any = url.match(/^s3:\/\/(.*)\/(.*)$/)

  try {
    validateBucket(match[1])
  } catch {
    throw new Error(`Invalid bucket in S3 URL: ${url}`)
  }

  const key = match[2]
  if (typeof key !== 'string' || !/^[a-zA-Z0-9\._-]+$/.test(key)) {
    throw new Error(`Invalid object key in S3 URL: ${url}`)
  }

  return url
}

export function validateSecretAccessKey(secretAccessKey: string): string {
  if (
    typeof secretAccessKey !== 'string' ||
    !/^[A-Za-z0-9\/\+=]{40}$/.test(secretAccessKey)
  ) {
    throw new Error(`Invalid secretAccessKey: ${secretAccessKey}`)
  }
  return secretAccessKey
}
