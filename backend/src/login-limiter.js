export class LoginAttemptLimiter {
  constructor({ maxFailures = 5, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.now = now;
    this.buckets = new Map();
  }

  #bucket(key) {
    const currentTime = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= currentTime) {
      bucket = { failures: 0, resetAt: currentTime + this.windowMs };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  isBlocked(keys) {
    return keys.some((key) => this.#bucket(key).failures >= this.maxFailures);
  }

  recordFailure(keys) {
    for (const key of keys) this.#bucket(key).failures += 1;
  }

  clear(keys) {
    for (const key of keys) this.buckets.delete(key);
  }
}
