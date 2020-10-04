import {
  BaseConnector,
  EventConfiguration,
  Reshuffle,
} from 'reshuffle-base-connector'
import { CoreEventHandler, CoreEventManager } from './CoreEventManager'
import { CorePersistentStore } from './CorePersistentStore'

export type Options = Record<string, any>
export { CoreEventHandler, Reshuffle }

const INTERVAL_DELAY_MS =
  parseInt(process.env.RESHUFFLE_INTERVAL_DELAY_MS || '10000', 10)

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
