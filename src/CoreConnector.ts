import objhash from 'object-hash'
import {
  BaseConnector,
  EventConfiguration,
  PersistentStore,
  Reshuffle,
  Updater,
} from 'reshuffle-base-connector'

export { Reshuffle }
export type Options = Record<string, any>

export type CoreEventFilter = (ec: EventConfiguration) => boolean
export type CoreEventHandler = (event: Record<string, any>) => void
export type CoreEventMapper = (ec: EventConfiguration) => any

export class CoreEventManager {
  private eventConfigurationSet: Record<string, EventConfiguration> = {}

  constructor(private connector: BaseConnector) {
  }

  public addEvent(
    eventOptions: any,
    handler: CoreEventHandler,
    eventId: string | Record<string, any>,
  ): EventConfiguration {
    const id = typeof eventId == 'string' ? eventId :
      `${this.connector.constructor.name}:${
        objhash(eventId)}:${this.connector.id}`
    const ec = new EventConfiguration(id, this.connector, eventOptions)
    this.eventConfigurationSet[ec.id] = ec
    this.connector.app.when(ec, handler as any)
    return ec
  }

  public removeEvent(ec: EventConfiguration) {
    delete this.eventConfigurationSet[ec.id]
  }

  public mapEvents(mapper: CoreEventMapper): any[] {
    return Object.values(this.eventConfigurationSet)
      .map(mapper)
      .sort()
      .filter((e, i, a) => i === a.indexOf(e)) // unique
  }

  public async fire(filter: CoreEventFilter, events: any | any[]) {
    const evs = Array.isArray(events) ? events : [events]
    const ecs = Object.values(this.eventConfigurationSet).filter(filter)
    for (const ec of ecs) {
      for (const ev of evs) {
        await this.connector.app!.handleEvent(ec.id, ev)
      }
    }
  }
}

export class CorePersistentStore implements PersistentStore {
  private prefix: string

  constructor(private connector: BaseConnector, descriptor: any) {
    this.prefix = `${this.connector.constructor.name}:`
    if (descriptor) {
      this.prefix += `${objhash(descriptor)}:`
    }
  }

  private getStore() {
    return this.connector.app!.getPersistentStore()
  }

  public del(key: string): Promise<void> {
    this.validateKey(key)
    return this.getStore().del(this.prefix + key)
  }

  public get(key: string): Promise<any> {
    this.validateKey(key)
    return this.getStore().get(this.prefix + key)
  }

  public async list(): Promise<string[]> {
    const array = await this.getStore().list()
    return array.filter((key) => key.startsWith(this.prefix))
  }

  public set(key: string, value: any): Promise<any> {
    this.validateKey(key)
    this.validateValue(value)
    return this.getStore().set(this.prefix + key, value)
  }

  public async update(key: string, updater: Updater): Promise<any[]> {
    this.validateKey(key)
    return this.getStore().update(this.prefix + key, updater)
  }

  public validateKey(key: string): void {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(`PersistentStore: Invalid key: ${key}`)
    }
  }

  public validateValue(value: any): void {
    if (value === undefined) {
      throw new Error(`PersistentStore: Invalid value: ${value}`)
    }
  }
}

const INTERVAL_DELAY_MS =
  parseInt(process.env.RESHUFFLE_INTERVAL_DELAY_MS || '30000', 10)

export class CoreConnector extends BaseConnector {
  protected eventManager = new CoreEventManager(this)
  protected store: CorePersistentStore
  protected interval?: NodeJS.Timer

  constructor(app: Reshuffle, protected options: Options, id?: string) {
    super(app, options, id)
    this.store = new CorePersistentStore(this, options)
  }

  public onStart() {
    const onInterval = (this as any).onInterval
    if (typeof onInterval == 'function') {
      this.interval = setInterval(onInterval.bind(this), INTERVAL_DELAY_MS)
    }
  }

  public onStop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }
  }

  public onRemoveEvent(event: EventConfiguration): void {
    this.eventManager.removeEvent(event)
  }
}
