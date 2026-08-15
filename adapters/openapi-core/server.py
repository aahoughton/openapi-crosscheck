import base64
import copy
import json
import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version as installed_version
from pathlib import Path
from typing import Any

from openapi_core import OpenAPI
from openapi_core.datatypes import RequestParameters
from werkzeug.datastructures import ImmutableMultiDict

PROTOCOL_VERSION = 2
LIBRARY = "openapi-core"
# Where this library's source lives. Stated by this container, not resolved.
LIBRARY_SOURCE = "https://github.com/python-openapi/openapi-core"


def installed_resolution(package: str) -> dict[str, str | None]:
    """How this container was told to install the library."""
    try:
        text = Path("/app/requirements.txt").read_text(encoding="utf-8")
    except OSError:
        return {"kind": "registry", "specifier": None}
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.startswith("#")
    ]

    prefix = package.lower().replace("_", "-")
    for line in lines:
        named = line.lower().replace("_", "-").startswith(prefix)
        if not named and prefix not in line.lower():
            continue
        local_marks = ("file:", "/", ".whl", ".tar.gz", "git+", "-e ")
        kind = "local" if any(mark in line.lower() for mark in local_marks) else "registry"
        return {"kind": kind, "specifier": line}
    return {"kind": "registry", "specifier": None}


CAPABILITIES = {
    "stages": {
        "routing": True,
        "splitting": {"cookie": False, "header": True, "path": True, "query": False},
        "styleDeserialization": True,
        "contentDeserialization": True,
        "schemaValidation": True,
        "valueExposure": True,
    },
    "oasVersions": {"3.0": True, "3.1": True, "3.2": True},
}

CONFIGURATION = {
    "id": "unmarshal-request-protocol",
    "description": (
        "OpenAPI.from_dict(document) driven through unmarshal_request, with a request "
        "object implementing the library's published Request protocol rather than its "
        "testing helper. The raw path is handed over unparsed, so routing and path "
        "parameter extraction are the library's. "
        "Raw query name/value pairs come from the harness preparse with no percent "
        "decoding: this library takes a query mapping and raises PathNotFound if a query "
        "string is left in the path, so the split into pairs is the caller's and is "
        "recorded on every cell. Style and explode are still applied by the library to "
        "those pairs. Cookie pairs go in as the MultiDict this library documents for "
        "that field, so a repeated cookie name reaches it rather than being collapsed "
        "on the way in. Every value in both mappings is a string, so a query pair or a "
        "cookie crumb that arrived with no `=` at all is answered as a case this shape "
        "cannot represent rather than handed over as an empty value. "
        "Reading its values: a parameter appears once it was reached, deserialized and "
        "accepted by its schema, so an empty value cell on a rejected row means that "
        "parameter did not pass rather than that it deserialized to nothing."
    ),
    "options": {},
}

VANTAGE = "validatedOnly"


@dataclass
class ProtocolRequest:
    """The library's published Request protocol, implemented directly."""

    host_url: str
    path: str
    method: str
    parameters: RequestParameters
    body: bytes | None = None
    content_type: str = "application/json"
    mimetype: str = "application/json"


@dataclass
class Answer:
    outcome: str
    deserialized: dict[str, Any] | None = None
    input_mutation: dict[str, str] | None = None
    raw: Any = None
    reason: str | None = None
    detail: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


def native_type(value: Any) -> str:
    """Name the Python type, the way Python names it."""
    if value is None:
        return "NoneType"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, list):
        inner = sorted({native_type(item) for item in value})
        return f"list[{'|'.join(inner)}]" if inner else "list"
    if isinstance(value, dict):
        inner = sorted({native_type(item) for item in value.values()})
        return f"dict[str,{'|'.join(inner)}]" if inner else "dict"
    return type(value).__name__


def declared_parameters(document: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """Every parameter the document declares, across every path and operation.

    Collected rather than chosen. A case probing routing declares more than one
    path, and which parameter the library populated is the evidence of which one
    it matched, so picking a path first would answer the routing question on the
    library's behalf and report an empty cell whenever the library disagreed.
    Names are unique within a case, so collecting them all cannot collide.
    """
    found: list[Mapping[str, Any]] = []
    for item in document.get("paths", {}).values():
        for operation in (item.get("get"), item.get("post")):
            if operation is None:
                continue
            found.extend(operation.get("parameters", []))
    return found


def json_safe(value: Any) -> Any:
    """Serialize whatever the library returned."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if isinstance(value, Mapping):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, BaseException):
        return {"type": type(value).__name__, "message": str(value)}
    return {"type": type(value).__name__, "repr": repr(value)}


class UnspellableInputError(Exception):
    """The harness supplied an input this library's request shape cannot carry.

    Raised rather than approximated. Handing the library the nearest thing it
    can hold would publish its verdict on a request the case did not send.
    """


def build_request(message: Mapping[str, Any]) -> ProtocolRequest:
    wire = message["request"]
    target = base64.b64decode(wire["targetBase64"]).decode("utf-8", errors="surrogateescape")
    path = target.split("?", 1)[0]

    preparsed = message.get("preparsed") or {}
    # A pair whose value is null carried no `=` on the wire. Every value in a
    # MultiDict is a string, so `?p` cannot be spelled apart from `?p=` here and
    # the case is refused rather than answered on the other request.
    raw_query = [
        pair
        for pair in preparsed.get("query") or []
        if isinstance(pair, list) and len(pair) == 2
    ]
    if any(pair[1] is None for pair in raw_query):
        raise UnspellableInputError(
            "a query pair arrived with no `=`, and the Request protocol takes query "
            "values as strings, so `?p` cannot be handed over apart from `?p=`"
        )
    query_pairs: list[tuple[str, str]] = [(str(pair[0]), str(pair[1])) for pair in raw_query]

    headers: dict[str, str] = {}
    for name, value in wire.get("headers", []):
        headers[name] = value if name not in headers else f"{headers[name]},{value}"

    # A repeated cookie name survives the trip. The library documents this
    # field as a MultiDict and reads repeats out of one, so collapsing the
    # pairs here would answer the exploded-cookie cases on its behalf.
    raw_cookies = [
        pair
        for pair in preparsed.get("cookies") or []
        if isinstance(pair, list) and len(pair) == 2
    ]
    if any(pair[1] is None for pair in raw_cookies):
        raise UnspellableInputError(
            "a cookie crumb arrived with no `=`, and the Request protocol takes cookie "
            "values as strings, so `p` cannot be handed over apart from `p=`"
        )
    cookie_pairs: list[tuple[str, str]] = [(str(pair[0]), str(pair[1])) for pair in raw_cookies]

    return ProtocolRequest(
        host_url="http://harness.invalid",
        path=path,
        method=message["request"]["method"].lower(),
        parameters=RequestParameters(
            query=ImmutableMultiDict(query_pairs),
            header=headers,
            cookie=ImmutableMultiDict(cookie_pairs),
            path={},
        ),
    )


def input_mutation(before: Any, after: Any, scope: str) -> dict[str, str]:
    """Whether the library wrote back onto the input it was handed.

    A library that writes deserialized values onto the request object its caller
    passed has handed that caller the values with no published call returning
    them, and nothing else in the protocol can see it. The comparison is a deep
    copy taken before the call and the same object after, and the detail states
    the scope so a `none` is read against what was actually compared.
    """
    if before == after:
        return {"kind": "none", "detail": f"{scope}, unchanged"}
    return {"kind": "observed", "detail": f"{scope}; it is now {after!r} where it was {before!r}"}


def run(message: Mapping[str, Any]) -> Answer:
    document = message["document"]

    try:
        api = OpenAPI.from_dict(document)
    except Exception as error:  # noqa: BLE001
        return Answer(
            outcome="unsupported",
            reason="libraryInitUnsupported",
            detail=f"{type(error).__name__}: {error}",
        )

    scope = "the RequestParameters object handed to unmarshal_request"
    try:
        request = build_request(message)
    except UnspellableInputError as error:
        # Ours, not the library's: the request never reached it.
        return Answer(
            outcome="unsupported",
            reason="cannotRepresentCase",
            detail=str(error),
        )

    try:
        before = copy.deepcopy(request.parameters)
        result = api.unmarshal_request(request)
        mutation = input_mutation(before, request.parameters, scope)
    except Exception as error:  # noqa: BLE001
        return Answer(
            outcome="libraryError",
            detail=f"{type(error).__name__}: {error}",
            raw=json_safe(error),
        )

    errors = list(result.errors)
    by_location = {
        "path": result.parameters.path,
        "query": result.parameters.query,
        "header": result.parameters.header,
        "cookie": result.parameters.cookie,
    }

    values: dict[str, Any] = {}
    types: dict[str, str] = {}
    for parameter in declared_parameters(document):
        location = parameter.get("in")
        name = parameter.get("name")
        if not isinstance(location, str) or not isinstance(name, str):
            continue
        bucket = by_location.get(location, {})
        if name in bucket:
            value = bucket[name]
            values[name] = json_safe(value)
            types[name] = native_type(value)

    return Answer(
        outcome="rejected" if errors else "accepted",
        input_mutation=mutation,
        deserialized={
            "kind": "observed",
            "vantage": VANTAGE,
            "value": values,
            "nativeTypes": types,
        },
        raw={
            "errors": [{"type": type(e).__name__, "message": str(e)} for e in errors],
            "parameters": {
                location: json_safe(dict(bucket)) for location, bucket in by_location.items()
            },
        },
    )


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args: Any) -> None:
        """Silence per-request logging."""

    def _send(self, status: int, body: Any) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # name fixed by BaseHTTPRequestHandler
        if self.path != "/describe":
            self._send(404, {"error": "no such endpoint"})
            return
        self._send(
            200,
            {
                "protocol": PROTOCOL_VERSION,
                "library": LIBRARY,
                "libraryVersion": installed_version(LIBRARY),
                "librarySource": LIBRARY_SOURCE,
                "libraryResolution": installed_resolution(LIBRARY),
                "capabilities": CAPABILITIES,
                "configuration": CONFIGURATION,
            },
        )

    def do_POST(self) -> None:  # name fixed by BaseHTTPRequestHandler
        if self.path != "/run":
            self._send(404, {"error": "no such endpoint"})
            return
        length = int(self.headers.get("content-length", "0"))
        message = json.loads(self.rfile.read(length) or b"{}")

        if message.get("protocol") != PROTOCOL_VERSION:
            self._send(
                400,
                {
                    "error": f"protocol {message.get('protocol')}, "
                    f"this container speaks {PROTOCOL_VERSION}"
                },
            )
            return

        try:
            answer = run(message)
        except Exception as error:  # noqa: BLE001
            answer = Answer(
                outcome="adapterError",
                detail=f"{type(error).__name__}: {error}",
                raw=None,
            )

        body: dict[str, Any] = {"protocol": PROTOCOL_VERSION, "outcome": answer.outcome}
        if answer.outcome in ("accepted", "rejected"):
            body["deserialized"] = answer.deserialized
            body["inputMutation"] = answer.input_mutation
            body["raw"] = answer.raw
        elif answer.outcome == "unsupported":
            body["reason"] = answer.reason
            body["detail"] = answer.detail
        else:
            body["detail"] = answer.detail
            body["raw"] = answer.raw
        self._send(200, body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
