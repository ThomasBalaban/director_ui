import { Directive, OnDestroy, OnInit } from '@angular/core';

@Directive()
export abstract class PollingComponent implements OnInit, OnDestroy {
  private _timeout?: ReturnType<typeof setTimeout>;
  private _currentDelay = 0;
  private _destroyed = false;

  /** Base polling interval in ms when healthy. Default: 3000 */
  protected pollingInterval = 3000;
  /** Cap on backoff delay when poll() is failing. Default: 30000 */
  protected pollingMaxInterval = 30000;

  /**
   * Implementations MUST throw (or reject) on failure so the base class can
   * apply exponential backoff. Silent failures keep the poll hammering at the
   * base interval and spam the dev-server proxy log.
   */
  abstract poll(): void | Promise<void>;

  ngOnInit(): void {
    this._currentDelay = this.pollingInterval;
    this._schedule(0);
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    if (this._timeout) clearTimeout(this._timeout);
  }

  private _schedule(delay: number): void {
    this._timeout = setTimeout(async () => {
      if (this._destroyed) return;
      try {
        await this.poll();
        this._currentDelay = this.pollingInterval;
      } catch {
        this._currentDelay = Math.min(this._currentDelay * 2, this.pollingMaxInterval);
      }
      if (!this._destroyed) this._schedule(this._currentDelay);
    }, delay);
  }
}
