import { AWS, BaseAWSConnector } from './BaseAWSConnector'
import { CoreEventHandler, EventConfiguration, Options, Reshuffle } from './CoreConnector'

interface EventOptions {
  type: string
}

export interface Job {
  Id: string
  Status?: string
}

type JobSet = Record<string, Job>

export class AWSMediaConvertConnector extends BaseAWSConnector {
  private mc?: AWS.MediaConvert
  private roleArn?: string

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    if (!this.options.region) {
      throw new Error('No region')
    }
  }

  private async getRoleArn(): Promise<string> {
    if (!this.roleArn) {
      const rn = this.options.roleName || 'reshuffle_AWSMediaConvertConnector'
      const role = await this.identity.getOrCreateServiceRole(rn, 'mediaconvert.amazonaws.com', [
        'arn:aws:iam::aws:policy/AmazonS3FullAccess',
        'arn:aws:iam::aws:policy/AmazonAPIGatewayInvokeFullAccess',
      ])
      if (typeof role.Arn !== 'string') {
        throw new Error(`Error creating IAM role: ${rn}`)
      }
      this.roleArn = role.Arn
    }
    if (!this.roleArn) {
      throw new Error('No role')
    }
    return this.roleArn
  }

  private async getClient(): Promise<AWS.MediaConvert> {
    if (!this.mc) {
      const cl = this.account.getClient('MediaConvert', {
        apiVersion: '2017-08-29',
      })
      const ep: any = await cl.describeEndpoints({ MaxResults: 0 }).promise()
      this.mc = this.account.getClient('MediaConvert', {
        apiVersion: '2017-08-29',
        endpoint: ep.Endpoints[0].Url,
      })
    }
    if (!this.mc) {
      throw new Error('No MediaConvert client')
    }
    return this.mc
  }

  // Events /////////////////////////////////////////////////////////

  public on(
    options: EventOptions,
    handler: CoreEventHandler,
    eventId?: string,
  ): EventConfiguration {
    if (options.type !== 'JobStatusChanged') {
      throw new Error(`Invalid event type: ${options.type}`)
    }
    const eid = eventId || { account: this.account, options }
    return this.eventManager.addEvent(options, handler, eid)
  }

  protected async onInterval(): Promise<void> {
    const [oldJobs, newJobs] = (await this.store.update('jobs', () =>
      this.listJobsById(),
    )) as JobSet[]

    if (oldJobs) {
      for (const job of Object.values(newJobs)) {
        if (job.Status !== oldJobs[job.Id]?.Status) {
          const old = oldJobs[job.Id] || { Id: job.Id, Status: 'UNKNOWN' }
          await this.fireJobStatusChanged(job, old)
        }
      }
    }
  }

  private fireJobStatusChanged(job: Job, old: Job) {
    return this.eventManager.fire((ec) => ec.options.type === 'JobStatusChanged', {
      jobId: job.Id,
      old,
      current: job,
    })
  }

  // Actions ////////////////////////////////////////////////////////

  public async cancelJob(job: Job): Promise<void> {
    const client = await this.getClient()
    await client.cancelJob(job).promise()
  }

  public async cancelJobById(id: string): Promise<void> {
    return this.cancelJob({ Id: id })
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async createJob(params: any): Promise<Job> {
    const client = await this.getClient()
    const res: any = await client.createJob(params).promise()
    const job = res.Job

    await this.fireJobStatusChanged(job, { Id: job.Id, Status: 'NEW' })

    await this.store.update('jobs', (jobs = {}) => {
      jobs[job.Id] = job
      return jobs
    })

    return job
  }

  public async createSimpleJob(
    input: Record<string, any>,
    outputGroup: Record<string, any>,
    settings: Record<string, any> = {},
  ): Promise<Job> {
    return this.createJob({
      Role: await this.getRoleArn(),
      Settings: {
        Inputs: [input],
        OutputGroups: [outputGroup],
        ...settings,
      },
    })
  }

  public async createSingleJob(
    src: string,
    dst: string,
    output: Record<string, any>,
    settings?: Record<string, any>,
  ): Promise<Job> {
    return this.createSimpleJob(
      { FileInput: src },
      {
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: { Destination: dst },
        },
        Outputs: [output],
      },
      settings,
    )
  }

  public async getJobStatus(job: Job): Promise<Job> {
    const client = await this.getClient()
    const res: any = await client.getJob(job).promise()
    return res.Job
  }

  public async getJobStatusById(id: string): Promise<Job> {
    return this.getJobStatus({ Id: id })
  }

  public async listJobs(max = 20): Promise<Job[]> {
    const client = await this.getClient()
    const res: any = await client.listJobs({ MaxResults: max }).promise()
    return res.Jobs
  }

  public async listJobsById(max?: number): Promise<Record<string, Job>> {
    const list = await this.listJobs(max)
    const obj: Record<string, Job> = {}
    for (const job of list) {
      obj[job.Id] = job
    }
    return obj
  }

  // SDK ////////////////////////////////////////////////////////////

  public sdk(options?: Record<string, any>): AWS.MediaConvert {
    return this.account.getClient('MediaConvert', options)
  }
}
