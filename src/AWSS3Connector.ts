import { CoreEventHandler, EventConfiguration, Options, Reshuffle } from './CoreConnector'
import { AWS, BaseAWSConnector, validateBucket } from './BaseAWSConnector'

interface EventOptions {
  type: string
}

interface S3Object {
  key: string
  lastModified: number
  eTag: string
  size: number
}

type S3Bucket = Record<string, S3Object>

export class AWSS3Connector extends BaseAWSConnector {
  private bucket: string
  private s3: AWS.S3
  private rs3?: AWS.S3

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    this.s3 = this.account.getClient('S3')
    this.bucket = validateBucket(options.bucket)
  }

  private async getRegionalClient() {
    if (!this.rs3) {
      const res = await this.s3
        .getBucketLocation({
          Bucket: this.bucket,
        })
        .promise()
      const region = res.LocationConstraint
      this.rs3 = region ? this.account.getClient('S3', { region }) : this.s3
    }
    return this.rs3
  }

  // Events /////////////////////////////////////////////////////////

  public on(
    options: EventOptions,
    handler: CoreEventHandler,
    eventId?: string,
  ): EventConfiguration {
    if (
      options.type !== 'BucketChanged' &&
      options.type !== 'BucketInitialized' &&
      options.type !== 'ObjectAdded' &&
      options.type !== 'ObjectModified' &&
      options.type !== 'ObjectRemoved'
    ) {
      throw new Error(`Invalid event type: ${options.type}`)
    }
    const eid = eventId || { account: this.account, options }
    return this.eventManager.addEvent(options, handler, eid)
  }

  protected async onInterval(): Promise<void> {
    const [oldObjects, newObjects] = await this.store.update(this.bucket, () =>
      this.getObjectsInBucket(),
    )

    if (!oldObjects) {
      await this.eventManager.fire((ec) => ec.options.type === 'BucketInitialized', {
        objects: newObjects,
      })
      return
    }

    const diff = this.diffBuckets(oldObjects, newObjects)
    if (0 < diff.changeCount) {
      await this.eventManager.fire((ec) => ec.options.type === 'BucketChanged', {
        objects: newObjects,
      })
      await this.eventManager.fire((ec) => ec.options.type === 'ObjectAdded', diff.additions)
      await this.eventManager.fire((ec) => ec.options.type === 'ObjectModified', diff.modifications)
      await this.eventManager.fire((ec) => ec.options.type === 'ObjectRemoved', diff.removals)
    }
  }

  private async getObjectsInBucket() {
    const list = await this.listObjects()

    const objects: S3Bucket = {}

    for (const { Key, LastModified, ETag, Size } of list) {
      if (typeof Key !== 'string' || !Key) {
        throw new Error(`S3: Invalid object key: ${Key}`)
      }
      if (!(LastModified instanceof Date)) {
        throw new Error(`S3: Invalid object time stamp: ${LastModified}`)
      }
      if (typeof ETag !== 'string' || !ETag) {
        throw new Error(`S3: Invalid object tag: ${ETag}`)
      }
      if (typeof Size !== 'number' || Size < 0) {
        throw new Error(`S3: Invalid object size: ${Size}`)
      }
      objects[Key] = {
        key: Key,
        lastModified: LastModified.getTime(),
        eTag: ETag,
        size: Size,
      }
    }

    return objects
  }

  private diffBuckets(oldObjects: S3Bucket, newObjects: S3Bucket) {
    function likelyTheSameObject(o1: S3Object, o2: S3Object): boolean {
      // eTag comparison only works if objects are uploaded with
      // a single API request, as opposed to multipart uploads
      return o1.eTag === o2.eTag && o1.lastModified === o2.lastModified && o1.size === o2.size
    }

    const additions: S3Object[] = []
    const modifications: S3Object[] = []
    const removals: S3Object[] = []

    for (const key in newObjects) {
      if (key in oldObjects) {
        if (!likelyTheSameObject(newObjects[key], oldObjects[key])) {
          modifications.push(newObjects[key])
        }
      } else {
        additions.push(newObjects[key])
      }
    }

    for (const key in oldObjects) {
      if (!(key in newObjects)) {
        removals.push(oldObjects[key])
      }
    }

    return {
      changeCount: additions.length + modifications.length + removals.length,
      additions,
      modifications,
      removals,
    }
  }

  // Actions ////////////////////////////////////////////////////////

  public async getBucket(): Promise<string> {
    return this.bucket
  }

  public async listBuckets(): Promise<Record<string, any>[] | undefined> {
    const res = await this.s3.listBuckets().promise()
    return res.Buckets
  }

  public async listBucketNames(): Promise<string[]> {
    const buckets = await this.listBuckets()
    return buckets ? buckets.map((b) => b.Name) : []
  }

  public async createBucket(bucket: string, region: string): Promise<any> {
    const cfg = region
      ? {
          CreateBucketConfiguration: {
            LocationConstraint: region,
          },
        }
      : {}
    await this.s3.createBucket({ Bucket: bucket, ...cfg }).promise()
  }

  public async deleteBucket(bucket: string): Promise<void> {
    await this.s3.deleteBucket({ Bucket: bucket }).promise()
  }

  public async listObjects(bucket: string = this.bucket): Promise<Record<string, any>[]> {
    const list = []
    let continuationToken
    while (true) {
      const params: any = { Bucket: bucket }
      if (continuationToken) {
        params.ContinuationToken = continuationToken
      }
      const res = await this.s3.listObjectsV2(params).promise()
      if (res.Contents) {
        list.push(...res.Contents)
      }
      continuationToken = res.NextContinuationToken
      if (!continuationToken) {
        return list
      }
    }
  }

  public async listObjectKeys(bucket: string = this.bucket): Promise<string[]> {
    const objects = await this.listObjects(bucket)
    return objects ? objects.map((o) => o.Key) : []
  }

  public async copyObject(
    sourceBucket: string,
    sourceKey: string,
    targetBucket: string,
    targetKey: string,
  ): Promise<any> {
    const req = {
      CopySource: `/${sourceBucket}/${sourceKey}`,
      Bucket: targetBucket,
      Key: targetKey,
    }

    const res = await this.s3.copyObject(req).promise()
    return res.CopyObjectResult
  }

  public async deleteObject(key: string, bucket: string = this.bucket): Promise<void> {
    await this.s3.deleteObject({ Bucket: bucket, Key: key }).promise()
  }

  public async getObject(key: string, bucket: string = this.bucket): Promise<any> {
    return this.s3.getObject({ Bucket: bucket, Key: key }).promise()
  }

  public async putObject(key: string, buffer: Buffer, bucket: string = this.bucket): Promise<any> {
    return this.s3
      .putObject({
        Bucket: bucket,
        Key: key,
        Body: buffer,
      })
      .promise()
  }

  public async getSignedURL(operation: string, key: string, expires = 60): Promise<string> {
    const req = { Bucket: this.bucket, Key: key, Expires: expires }
    const s3 = await this.getRegionalClient()
    if (!s3) {
      throw new Error('No S3 client')
    }
    return s3.getSignedUrlPromise(operation, req)
  }

  public async getSignedObjectGetURL(key: string, expires: number): Promise<string> {
    return this.getSignedURL('getObject', key, expires)
  }

  public async getSignedObjectPutURL(key: string, expires: number): Promise<string> {
    return this.getSignedURL('putObject', key, expires)
  }

  public async getS3URL(key: string, bucket = this.bucket): Promise<string> {
    validateBucket(bucket)
    return `s3://${bucket}/${key}`
  }

  public async getWebURL(key: string, bucket = this.bucket): Promise<string> {
    const res = await this.s3.getBucketLocation({ Bucket: bucket }).promise()
    const region = res.LocationConstraint
    if (!region) {
      throw new Error(`Unable to determine region for S3 bucket: ${bucket}`)
    }
    return `http://${bucket}.s3-website-${region}.amazonaws.com/${key}`
  }

  // SDK ////////////////////////////////////////////////////////////

  public sdk(options?: Record<string, any>): AWS.S3 {
    return this.account.getClient('S3', options)
  }
}
