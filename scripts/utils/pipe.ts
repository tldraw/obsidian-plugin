import { Transform } from "stream";

declare module "stream" {
  interface Transform {
    _leftover?: string;
  }
}

export function createPrefixer(prefix: string): Transform {
  return new Transform({
    transform(chunk, encoding, callback) {
      // 1. Get current data + any leftovers from previous chunk
      let data = (this._leftover || '') + chunk.toString();
      let lines = data.split('\n');

      // 2. The last element might be an incomplete line; save it
      this._leftover = lines.pop();

      // 3. Prepend prefix to complete lines and push them
      for (const line of lines) {
        this.push(`${prefix}${line}\n`);
      }
      callback();
    },
    flush(callback) {
      // 4. Handle any remaining data at the end of the stream
      if (this._leftover) {
        this.push(`${prefix}${this._leftover}\n`);
      }
      callback();
    }
  });
}