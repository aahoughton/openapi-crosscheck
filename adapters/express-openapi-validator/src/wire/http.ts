import net from "node:net";
import type { WireRequest } from "../types/wire";

export interface RawResponse {
  readonly status: number;
  readonly body: string;
}

/**
 * Send a request target over a socket, byte for byte.
 *
 * Written by hand rather than through an HTTP client because every client
 * normalizes something: the target gets re-encoded, duplicate headers get
 * merged, casing gets canonicalized. Those normalizations are probe dimensions,
 * so a client that tidies them up quietly deletes the cases worth running.
 */
export function sendRaw(port: number, request: WireRequest): Promise<RawResponse> {
  return new Promise((resolve) => {
    const headers = [
      ...request.headers.map(([name, value]) => `${name}: ${value}`),
      "Connection: close",
    ].join("\r\n");
    const wire = `${request.method} ${request.target} HTTP/1.1\r\n${headers}\r\n\r\n`;

    const socket = net.connect(port, "127.0.0.1", () => socket.write(wire));
    let data = "";
    socket.setTimeout(10_000, () => {
      socket.destroy();
      resolve({ status: 0, body: "harness: socket timeout" });
    });
    socket.on("data", (chunk) => (data += chunk));
    socket.on("end", () => {
      const status = Number(/^HTTP\/1\.1 (\d+)/.exec(data)?.[1] ?? 0);
      const separator = data.indexOf("\r\n\r\n");
      resolve({ status, body: separator === -1 ? "" : data.slice(separator + 4).trim() });
    });
    socket.on("error", (error) => resolve({ status: 0, body: `harness: ${error.message}` }));
  });
}
