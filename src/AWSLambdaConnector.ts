import crypto from 'crypto'
import { promises as fs } from 'fs'
import { Folder, zipOne } from './Folder'
import { CoreEventHandler, Options, Reshuffle } from './CoreConnector'
import { AWS, BaseAWSConnector, validateS3URL, validateURL } from './BaseAWSConnector'

interface EventOptions {
  type: string
}

const COMMAND_TAG_NAME = 'deployed-by'
const COMMAND_TAG_VALUE = 'reshuffle-aws-lambda-connector'

interface Payload {
  code?: string
  filename?: string
  buffer?: Buffer
}

const QUEUE_CONCURRENCY_LIMIT = 100

interface Job {
  functionName: string
  payload: any
  queue: Queue
  index: number
}

interface Queue {
  functionName: string
  payloads: any[]
  id: string
  active: number
  complete: number
  statuses: Array<string | null>
  resolutions: any[]
  maxConcurrent: number
}

type QueueSet = Record<string, Queue>

function createQueue(functionName: string, payloads: any[], maxConcurrent: number): Queue {
  return {
    functionName,
    payloads,
    id: crypto.randomBytes(8).toString('hex'),
    active: 0,
    complete: 0,
    statuses: payloads.map(() => null),
    resolutions: new Array(payloads.length),
    maxConcurrent: Math.min(payloads.length, Math.round(maxConcurrent), QUEUE_CONCURRENCY_LIMIT),
  }
}

function getNextJobFromQueue(queue: Queue): Job | undefined {
  if (queueIsComplete(queue) || !queueHasPendingJobs(queue)) {
    return
  }

  const index = queue.statuses.findIndex((st) => st === null)
  if (index < 0) {
    return
  }

  queue.statuses[index] = 'running'
  queue.active++

  return {
    functionName: queue.functionName,
    payload: queue.payloads[index],
    queue,
    index,
  }
}

function queueHasPendingJobs(queue: Queue): boolean {
  return queue.active < queue.maxConcurrent
}

function queueIsComplete(queue: Queue): boolean {
  return queue.complete === queue.payloads.length
}

function onQueueJobDone(queue: Queue, job: Job, resolution: any) {
  const index = job.index
  if (queue.statuses[index] !== 'running') {
    return
  }

  queue.statuses[index] = 'complete'
  queue.resolutions[index] = resolution
  queue.complete++
  queue.active--
}

export class AWSLambdaConnector extends BaseAWSConnector {
  private lambda: AWS.Lambda

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    if (!this.options.region) {
      throw new Error('No region')
    }
    this.lambda = this.account.getClient('Lambda')
  }

  // Events /////////////////////////////////////////////////////////

  public on(options: EventOptions, handler: CoreEventHandler, eventId?: string) {
    if (options.type !== 'QueueComplete') {
      throw new Error(`Invalid event type: ${options.type}`)
    }
    const eid = eventId || { account: this.account, options }
    return this.eventManager.addEvent(options, handler, eid)
  }

  // Actions ////////////////////////////////////////////////////////

  public async command(
    functionName: string,
    executable: string,
    command: string,
    files: string | string[] = [],
    options: Options = {},
  ): Promise<any> {
    if (typeof command !== 'string' || command.trim().length === 0) {
      throw new Error(`Invalid commmand: ${command}`)
    }

    if (typeof executable === 'string' && executable.startsWith('http')) {
      validateURL(executable)
    } else if (typeof executable === 'string' && executable.startsWith('s3')) {
      validateS3URL(executable)
    } else {
      throw new Error(`Invalid executable: ${executable}`)
    }

    const urls = Array.isArray(files) ? files : [files]
    for (const url of urls) {
      validateS3URL(url)
    }

    await this.commandCreateFunction(functionName, executable, options)
    return this.invoke(functionName, { command, urls })
  }

  private async commandCreateFunction(functionName: string, executable: string, options: Options) {
    if (!options.force) {
      const info = await this.getFunctionInfo(functionName)
      if (info) {
        if (info.Tags[COMMAND_TAG_NAME] !== COMMAND_TAG_VALUE) {
          throw new Error(`Lambda exists but is not a command function: ${functionName}`)
        }
        console.log(`${functionName}: Using existing Lambda function`)
        return
      }
    }

    const folder = new Folder(
      `reshuffle-awslambdaconnector-${crypto.randomBytes(8).toString('hex')}`,
    )

    try {
      console.log(`${functionName}: Building code tree`)
      await folder.copy('index.js', `${__dirname}/lambda-command.js`)
      await folder.copy('Folder.js', `${__dirname}/Folder.js`)
      await folder.write(
        'package.json',
        JSON.stringify({
          main: 'index.js',
          dependencies: {
            'aws-sdk': '^2.741.0',
            jszip: '^3.5.0',
            'node-fetch': '^2.6.0',
            rimraf: '^3.0.2',
          },
        }),
      )
      await folder.exec('npm install')

      console.log(`${functionName}: Building deployment package`)
      const buffer = await folder.zip()
      console.log(`${functionName}: Package size ${buffer.length} bytes`)

      console.log(`${functionName}: Deploying to Lambda`)
      const func = await this.createFromBuffer(functionName, buffer, {
        ...options,
        env: {
          ...(options.env || {}),
          EXECUTABLE: executable,
        },
        tags: {
          ...(options.tags || {}),
          [COMMAND_TAG_NAME]: COMMAND_TAG_VALUE,
        },
        timeout: options.timeout || 300,
      }) // must explicitly await for finally
      return func
    } finally {
      await folder.destroy()
    }
  }

  public async create(functionName: string, payload: Payload, options: Options = {}) {
    this.validateFunctionName(functionName)
    const buffer = await this.makeBuffer(payload)

    const role = await this.identity.getOrCreateServiceRole(
      options.roleName || 'reshuffle_AWSLambdaConnector',
      'lambda.amazonaws.com',
      this.identity.createSimplePolicy('arn:aws:logs:*:*:*', [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ]),
    )

    return this.lambda
      .createFunction({
        Code: { ZipFile: buffer },
        Environment: options.env ? { Variables: options.env } : {},
        FunctionName: functionName,
        Handler: 'index.handler',
        MemorySize: options.memorySize || 256,
        Publish: true,
        Runtime: options.runtime || 'nodejs12.x',
        Role: role.Arn,
        Tags: options.tags || {},
        Timeout: options.timeout || 3,
      })
      .promise()
  }

  private async makeBuffer(payload: Payload): Promise<Buffer> {
    if (payload.buffer instanceof Buffer) {
      return payload.buffer
    }

    if (typeof payload.filename === 'string') {
      payload.code = await fs.readFile(payload.filename, 'utf-8')
    }

    if (typeof payload.code !== 'string' || payload.code.length === 0) {
      throw new Error(`Invalid code for lambda function: ${payload.code}`)
    }

    return zipOne('index.js', payload.code)
  }

  public async createFromBuffer(functionName: string, buffer: Buffer, options?: Options) {
    return this.create(functionName, { buffer }, options)
  }

  public async createFromCode(functionName: string, code: string, options?: Options) {
    return this.create(functionName, { code }, options)
  }

  public async createFromFile(functionName: string, filename: string, options?: Options) {
    return this.create(functionName, { filename }, options)
  }

  public async delete(functionName: string): Promise<void> {
    this.validateFunctionName(functionName)
    await this.lambda
      .deleteFunction({
        FunctionName: functionName,
      })
      .promise()
  }

  public async enqueue(
    functionName: string,
    payload: any | any[],
    maxConcurrent: number = QUEUE_CONCURRENCY_LIMIT,
  ) {
    this.validateFunctionName(functionName)

    const payloads = Array.isArray(payload) ? payload : [payload]

    if (typeof maxConcurrent !== 'number' || maxConcurrent < 1) {
      throw new Error(`Invalid max concurrent: ${maxConcurrent}`)
    }

    const queue = createQueue(functionName, payloads, maxConcurrent)
    console.log('Create queue:', queue.id, queue.functionName)

    await this.store.update('queues', async (queues: QueueSet = {}) => {
      queues[queue.id] = queue
      return queues
    })

    setTimeout(() => this.onQueueReady(), 0)

    return queue.id
  }

  private async onQueueReady() {
    const jobs: Job[] = []
    const complete: Queue[] = []

    await this.store.update('queues', async (queues: QueueSet) => {
      for (const queue of Object.values(queues)) {
        if (queueIsComplete(queue)) {
          console.log('Qeueue complete:', queue.id)
          complete.push(queue)
          delete queues[queue.id]
          continue
        }
        for (;;) {
          const job = getNextJobFromQueue(queue)
          if (!job) {
            break
          }
          jobs.push(job)
        }
      }
      return queues
    })

    const startJob = async (job: Job) => {
      console.log('Starting job:', job.functionName, job.payload)
      const res = await this.lambda
        .invoke({
          FunctionName: job.functionName,
          Payload: JSON.stringify(job.payload),
        })
        .promise()
      const resolution = this.parseResponse(res, job.functionName)

      await this.store.update('queues', async (queues: QueueSet) => {
        onQueueJobDone(queues[job.queue.id], job, resolution)
        console.log('Job done:', job.functionName, job.payload)
        return queues
      })

      void this.onQueueReady()
    }

    for (const job of jobs) {
      void startJob(job)
    }

    if (0 < complete.length) {
      await this.eventManager.fire(
        (ec) => ec.options.type === 'QueueComplete',
        complete.map((queue) => ({
          qid: queue.id,
          payloads: queue.payloads,
          resolutions: queue.resolutions,
        })),
      )
    }
  }

  public async getFunctionInfo(functionName: string): Promise<any> {
    try {
      const info = await this.lambda
        .getFunction({
          FunctionName: functionName,
        })
        .promise() // must explicitly await for catch
      return info
    } catch (e) {
      if (e.code === 'ResourceNotFoundException') {
        return
      }
      throw e
    }
  }

  public async invoke(functionName: string, payload: any) {
    this.validateFunctionName(functionName)

    const res = await this.lambda
      .invoke({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
      })
      .promise()

    const response = this.parseResponse(res, functionName)
    if (response instanceof Error) {
      throw response
    }
    return response
  }

  private parseResponse(res: any, functionName?: string) {
    function err(code: number | string) {
      const fn = functionName ? `: ${functionName}` : ''
      return new Error(`Error ${code} invoking lambda function${fn}`)
    }

    if (res.StatusCode !== 200) {
      return err(res.StatusCode)
    }

    const payload = JSON.parse(res.Payload)
    if (payload === null) {
      return err('unknown')
    }

    if (typeof payload.statusCode !== 'number') {
      return payload
    }

    if (payload.statusCode < 200 || 300 <= payload.statusCode) {
      return err(payload.statusCode || payload.errorMessage || res.FunctionError)
    }

    try {
      return JSON.parse(payload.body)
    } catch {
      return payload.body
    }
  }

  private validateFunctionName(functionName: string): void {
    if (typeof functionName !== 'string') {
      throw new Error(`Lambda function name not a string: ${functionName}`)
    }
    if (!/^[a-zA-z0-9\-]{1,64}$/.test(functionName)) {
      throw new Error(`Invalid lambda function name: ${functionName}`)
    }
  }

  public async listFunctions() {
    const res = await this.lambda.listFunctions({}).promise()
    return res.Functions
  }

  // SDK ////////////////////////////////////////////////////////////

  public sdk(options?: Record<string, any>): AWS.Lambda {
    return this.account.getClient('Lambda', options)
  }
}
