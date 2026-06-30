/**
 * Mongoose connection helper for GitRoasted.
 *
 * In a serverless environment (e.g. Vercel functions) module-level state can
 * be reused across invocations, but new invocations and hot reloads in
 * development would otherwise open a fresh database connection every time and
 * exhaust the MongoDB connection pool. To avoid this we cache both the active
 * connection and the in-flight connection promise on the Node.js `global`
 * object so that concurrent callers share a single connection attempt.
 *
 * Reads the connection string from the `MONGODB_URI` environment variable.
 */

import mongoose, { type Mongoose } from "mongoose";

/** Shape of the connection cache stored on the global object. */
interface MongooseCache {
  /** The resolved connection, or null before the first successful connect. */
  conn: Mongoose | null;
  /** The in-flight connection promise, or null when no connect is pending. */
  promise: Promise<Mongoose> | null;
}

// Augment the global scope with a typed slot for the cache so repeated
// imports (and hot reloads) reuse the same object rather than reconnecting.
const globalForMongoose = globalThis as typeof globalThis & {
  _mongooseCache?: MongooseCache;
};

const cache: MongooseCache =
  globalForMongoose._mongooseCache ??
  (globalForMongoose._mongooseCache = { conn: null, promise: null });

/**
 * Connect to MongoDB, reusing an existing connection when one is available.
 *
 * The first call initiates a connection and caches the promise; concurrent
 * callers await the same promise. Subsequent calls return the cached
 * connection immediately. If a connection attempt fails, the cached promise is
 * cleared so a later call can retry.
 *
 * @throws Error when `MONGODB_URI` is not set.
 */
export async function connectToDatabase(): Promise<Mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI environment variable is not set. Add it to your .env.local file.",
      );
    }

    // `bufferCommands: false` makes model operations fail fast instead of
    // queueing while disconnected, which surfaces connection problems early.
    cache.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((instance) => instance);
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Clear the failed promise so the next call can attempt a fresh connect.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

export default connectToDatabase;
