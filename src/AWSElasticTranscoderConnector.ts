import { AWS, BaseAWSConnector } from './BaseAWSConnector'
import { CoreEventHandler, Options, Reshuffle } from './CoreConnector'

interface EventOptions {
  pipelineId: string
}

export interface Job {
  Id: string
  Status: string
}

type JobSet = Record<string, Job>
type PipelineStatusSet = Record<string, JobSet>
export type Pipeline = Record<string, any>
export type Preset = Record<string, any>

function search(array: Array<Record<string, any>>, field: string, token: string) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`Token must be a non-empty string: ${token}`)
  }
  const lower = token.toLowerCase()
  return (
    array.find((p) => p[field] === token) ||
    array.find((p) => p[field].toLowerCase() === lower) ||
    array.find((p) => p[field].startsWith(token)) ||
    array.find((p) => p[field].includes(token))
  )
}

export class AWSElasticTranscoderConnector extends BaseAWSConnector {
  private et: AWS.ElasticTranscoder

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    if (!this.options.region) {
      throw new Error('No region')
    }
    this.et = this.account.getClient('ElasticTranscoder')
  }

  // Events /////////////////////////////////////////////////////////

  public on(options: EventOptions, handler: CoreEventHandler, eventId?: string) {
    if (!/^\d{13}-[a-z]{6}$/.test(options.pipelineId)) {
      throw new Error(`Invalid pipeline ID: ${options.pipelineId}`)
    }
    const eid = eventId || { account: this.account, options }
    return this.eventManager.addEvent(options, handler, eid)
  }

  protected async onInterval() {
    const ids = this.eventManager.mapEvents((ec) => ec.options.pipelineId) as string[]

    const [oldPipelines, newPipelines] = (await this.store.update('pipelines', async () =>
      Object.fromEntries(await Promise.all(ids.map((id) => this.getJobs(id)))),
    )) as PipelineStatusSet[]

    for (const [pipelineId, newJobs] of Object.entries(newPipelines)) {
      const oldJobs = (oldPipelines || {})[pipelineId]

      const updates = Object.values(newJobs)
        .filter((job) =>
          oldJobs
            ? job.Status !== (oldJobs[job.Id] || {}).Status
            : job.Status === 'Submitted' || job.Status === 'Progressing',
        )
        .map((job) => ({
          jobId: job.Id,
          current: job,
          old: (oldJobs || {})[job.Id] || { Id: job.Id, Status: 'New' },
        }))

      await this.eventManager.fire((ec) => ec.options.pipelineId === pipelineId, updates)
    }
  }

  private async getJobs(pipelineId: string): Promise<[string, JobSet]> {
    const req = { PipelineId: pipelineId }
    const res = await this.et.listJobsByPipeline(req).promise()
    const list = res.Jobs as Job[]
    const jobs: JobSet = {}
    for (const job of list) {
      jobs[job.Id] = job
    }
    return [pipelineId, jobs]
  }

  // Actions ////////////////////////////////////////////////////////

  public async cancelJob(id: string): Promise<void> {
    await this.et.cancelJob({ Id: id }).promise()
  }

  public async createJob(params: any): Promise<Job> {
    const res = await this.et.createJob(params).promise()
    return res.Job as Job
  }

  public async findPipelineByName(token: string): Promise<Pipeline> {
    const pipelines = await this.listPipelines()
    const pipeline = search(pipelines, 'Name', token)
    if (!pipeline) {
      throw new Error(`Pipeline not found for: ${token}`)
    }
    return pipeline
  }

  public async findPresetByDescription(token: string): Promise<Preset> {
    const presets = await this.listPresets()
    const preset = search(presets, 'Description', token)
    if (!preset) {
      throw new Error(`Preset not found for: ${token}`)
    }
    return preset
  }

  public async listPipelines(): Promise<Pipeline[]> {
    const res = await this.et.listPipelines({}).promise()
    return res.Pipelines as Pipeline[]
  }

  public async listPresets(): Promise<Preset[]> {
    const res = await this.et.listPresets({}).promise()
    return res.Presets as Preset[]
  }

  public async readJob(id: string): Promise<Job> {
    const res = await this.et.readJob({ Id: id }).promise()
    return res.Job as Job
  }

  // SDK ////////////////////////////////////////////////////////////

  public sdk(options?: Record<string, any>): AWS.ElasticTranscoder {
    return this.account.getClient('ElasticTranscoder', options)
  }
}
