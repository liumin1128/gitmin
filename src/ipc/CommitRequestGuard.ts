export class CommitRequestGuard {
  private activeRequestId: number | null = null;
  private expectedOffset = 0;
  private inFlightOffset: number | null = null;

  reserve(requestId: number, offset: number): boolean {
    if (offset === 0) {
      if (this.activeRequestId === null || requestId > this.activeRequestId) {
        this.activeRequestId = requestId;
        this.expectedOffset = 0;
        this.inFlightOffset = 0;
        return true;
      }
      if (
        this.activeRequestId === requestId &&
        this.expectedOffset === 0 &&
        this.inFlightOffset === null
      ) {
        this.inFlightOffset = 0;
        return true;
      }
      return false;
    }

    if (
      this.activeRequestId !== requestId ||
      this.expectedOffset !== offset ||
      this.inFlightOffset !== null
    ) return false;

    this.inFlightOffset = offset;
    return true;
  }

  isReserved(requestId: number, offset: number): boolean {
    return this.activeRequestId === requestId && this.inFlightOffset === offset;
  }

  complete(requestId: number, offset: number, nextOffset: number): boolean {
    if (!this.isReserved(requestId, offset)) return false;
    this.expectedOffset = nextOffset;
    this.inFlightOffset = null;
    return true;
  }

  release(requestId: number, offset: number): void {
    if (this.isReserved(requestId, offset)) this.inFlightOffset = null;
  }

  reset(): void {
    this.activeRequestId = null;
    this.expectedOffset = 0;
    this.inFlightOffset = null;
  }
}
