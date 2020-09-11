import objhash from 'object-hash'
import {
  BaseConnector,
  EventConfiguration,
  Reshuffle,
} from 'reshuffle-base-connector'
import { CoreEventHandler, CoreEventManager } from './CoreEventManager'
import { CorePersistentStore } from './CorePersistentStore'

export type Options = Record<string, any>
export { CoreEventHandler, Reshuffle }

const INTERVAL_DELAY_MILLISECONDS =
  parseInt(process.env.RESHUFFLE_INTERVAL_DELAY_MILLISECONDS || '10000', 10)

export class CoreConnector extends BaseConnector {
  protected options?: Options
  protected eventManager = new CoreEventManager(this)
  protected store?: CorePersistentStore
  protected interval?: NodeJS.Timer
  protected intervalDelayMs?: number = INTERVAL_DELAY_MILLISECONDS

  // Lifecycle //////////////////////////////////////////////////////

  public onStart() {
    if (typeof this.intervalDelayMs == 'number' && 0 < this.intervalDelayMs) {
      this.interval = this.app!.setInterval(
        () => this.onInterval(),
        this.intervalDelayMs,
      )
    }
  }

  public onStop() {
    if (this.app && this.interval) {
      this.app.clearInterval(this.interval)
      this.interval = undefined
    }
  }

  public updateOptions(options: Options) {
    const optionsChanged =
      !this.options ||
      objhash(options) !== objhash(this.options)

    if (optionsChanged) {
      this.options = options
      this.store = new CorePersistentStore(this, options)
      this.onOptionsChanged(options)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected onOptionsChanged(_: Options) {
  }

  // Events /////////////////////////////////////////////////////////

  public onRemoveEvent(event: EventConfiguration): void {
    this.eventManager.removeEvent(event)
  }

  protected async onInterval() {
    throw new Error('Not implemented')
  }
}
