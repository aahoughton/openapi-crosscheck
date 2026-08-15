import type { WireMessage } from "../types/container";
import type { WireRequest } from "../types/wire";

/**
 * The wire request's encoding, in one place because both sides must agree
 * exactly. A harness that encoded differently from how a container decoded
 * would still produce a full matrix, and every cell in it would be wrong in a
 * way nothing else in the project could detect.
 *
 * The target is base64 so nothing between the two can parse it. Every HTTP
 * client and server normalizes a target given the chance: re-encoding percent
 * escapes, resolving dot segments, rewriting delimiters. Those normalizations
 * are probe dimensions here, so a transport that tidies them up quietly deletes
 * the cases worth running.
 */
export function toWireMessage(request: WireRequest): WireMessage {
  return {
    method: request.method,
    targetBase64: Buffer.from(request.target, "utf8").toString("base64"),
    headers: request.headers.map(([name, value]) => [name, value] as const),
  };
}

export function fromWireMessage(message: WireMessage): WireRequest {
  return {
    method: message.method,
    target: Buffer.from(message.targetBase64, "base64").toString("utf8"),
    headers: message.headers.map(([name, value]) => [name, value] as const),
  };
}
