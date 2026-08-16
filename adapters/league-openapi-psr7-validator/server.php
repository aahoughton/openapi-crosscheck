<?php

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Composer\InstalledVersions;
use League\OpenAPIValidation\PSR7\Exception\ValidationFailed;
use League\OpenAPIValidation\PSR7\RequestValidator;
use League\OpenAPIValidation\PSR7\ValidatorBuilder;
use Nyholm\Psr7\Request;
use Nyholm\Psr7\Uri;
use Psr\Http\Message\RequestInterface;

const PROTOCOL_VERSION = 3;
const LIBRARY = 'league/openapi-psr7-validator';
// Where this library's source lives. Stated by this container.
const LIBRARY_SOURCE = 'https://github.com/thephpleague/openapi-psr7-validator';

/** @return array{stages: array<string, mixed>, oasVersions: array<string, bool>} */
function capabilities(): array
{
    return [
        'stages' => [
            'routing' => true,
            'splitting' => ['cookie' => true, 'header' => true, 'path' => true, 'query' => true],
            'styleDeserialization' => true,
            'contentDeserialization' => true,
            'schemaValidation' => true,
            'valueExposure' => false,
        ],
        'oasVersions' => ['3.0' => true, '3.1' => true, '3.2' => false],
    ];
}

/** @return array{id: string, description: string, options: array<string, mixed>} */
function configuration(): array
{
    return [
        'id' => 'request-validator-psr7',
        'description' =>
            'ValidatorBuilder::fromJson(document) driven through getRequestValidator()->validate(), '
            . 'with a PSR-7 RequestInterface built from the raw target. The plain request '
            . 'validator is used rather than the server request one, because the plain one reads '
            . 'the Cookie header itself where the server one takes a cookie array from its '
            . 'caller, so every location stays the library\'s. '
            . 'Known limitation: the PSR-7 URI type parses the target before the library sees '
            . 'it, so percent-encoding probes measure that parser as well as the library. '
            . 'Existing percent-encoded sequences reach the validator unchanged. '
            . 'Values are unexposed: validate() answers with an OperationAddress or raises, and '
            . 'the deserializer that converts a styled parameter is not reachable from the '
            . 'published validation call.',
        'options' => [],
    ];
}

/**
 * How this container was told to install the library.
 *
 * @return array{kind: string, specifier: string|null}
 */
function installedResolution(string $package): array
{
    $text = @file_get_contents(__DIR__ . '/composer.json');
    if ($text === false) {
        return ['kind' => 'registry', 'specifier' => null];
    }
    $manifest = json_decode($text, true);
    if (! is_array($manifest) || ! is_array($manifest['require'] ?? null)) {
        return ['kind' => 'registry', 'specifier' => null];
    }
    $specifier = $manifest['require'][$package] ?? null;
    if (! is_string($specifier)) {
        return ['kind' => 'registry', 'specifier' => null];
    }
    $localMarks = ['@dev', 'dev-', 'path', 'file:', '.zip', '.tar'];
    foreach ($localMarks as $mark) {
        if (str_contains($specifier, $mark)) {
            return ['kind' => 'local', 'specifier' => $specifier];
        }
    }

    return ['kind' => 'registry', 'specifier' => $specifier];
}

/** @return array{kind: string, reason: string} */
function unexposed(): array
{
    return [
        'kind' => 'unexposed',
        'reason' => 'no published call returns the deserialized parameter values',
    ];
}

/** @return array<string, mixed> */
function unsupported(string $reason, string $detail): array
{
    return [
        'protocol' => PROTOCOL_VERSION,
        'outcome' => 'unsupported',
        'reason' => $reason,
        'detail' => $detail,
    ];
}

/** @return array<string, mixed> */
function failure(string $outcome, string $detail): array
{
    return [
        'protocol' => PROTOCOL_VERSION,
        'outcome' => $outcome,
        'detail' => $detail,
        'raw' => null,
    ];
}

/** Serialize a raise, including whatever it was raised from. */
function describeThrowable(Throwable $error): mixed
{
    $previous = $error->getPrevious();

    return [
        'type' => $error::class,
        'message' => $error->getMessage(),
        'previous' => $previous === null ? null : describeThrowable($previous),
    ];
}

/**
 * Build the PSR-7 request the library validates.
 *
 * The target arrives base64-encoded and is handed to the URI type as it is.
 * Header pairs are added in the order they arrived, so duplicate names and
 * non-canonical casing survive; the Host the URI implies is dropped first so
 * the only Host on the request is the one the harness sent.
 *
 * @param array<mixed> $wire
 */
function buildRequest(array $wire): RequestInterface
{
    $method = is_string($wire['method'] ?? null) ? $wire['method'] : 'GET';
    $encoded = is_string($wire['targetBase64'] ?? null) ? $wire['targetBase64'] : '';
    $target = base64_decode($encoded, true);
    if ($target === false) {
        throw new RuntimeException('target was not base64');
    }

    $request = (new Request($method, new Uri('http://harness.invalid' . $target)))
        ->withoutHeader('Host');
    $headers = $wire['headers'] ?? [];
    if (is_array($headers)) {
        foreach ($headers as $pair) {
            if (is_array($pair) && is_string($pair[0] ?? null) && is_string($pair[1] ?? null)) {
                $request = $request->withAddedHeader($pair[0], $pair[1]);
            }
        }
    }

    return $request;
}

/**
 * Whether the library wrote back onto the request it was handed.
 *
 * A library that writes deserialized values onto its caller's request object
 * has handed that caller the values with no published call returning them, and
 * nothing else in the protocol can see it. PSR-7 makes the answer structural
 * rather than lucky: every `with*` method returns a new instance, so a library
 * cannot write through the reference this container holds. The comparison is
 * made anyway, because the guarantee is the interface's and this reports what
 * was seen rather than what was promised.
 *
 * @return array{kind: string, detail: string}
 */
function inputMutation(string $before, string $after, string $scope): array
{
    if ($before === $after) {
        return ['kind' => 'none', 'detail' => $scope . ', unchanged'];
    }

    return [
        'kind' => 'observed',
        'detail' => $scope . '; it is now ' . $after . ' where it was ' . $before,
    ];
}

/** The parts of a request that carry a case's values, as one comparable string. */
function requestSnapshot(RequestInterface $request): string
{
    $parts = [$request->getMethod(), (string) $request->getUri()];
    $headers = $request->getHeaders();
    ksort($headers);
    foreach ($headers as $name => $values) {
        $parts[] = $name . '=' . implode("\x00", $values);
    }

    return implode('|', $parts);
}

/**
 * @param array<mixed> $message
 *
 * @return array<string, mixed>
 */
function runCase(array $message): array
{
    $document = json_encode($message['document'] ?? null);
    if ($document === false) {
        return failure('adapterError', 'the document could not be re-encoded as JSON');
    }

    try {
        $validator = (new ValidatorBuilder())->fromJson($document)->getRequestValidator();
    } catch (Throwable $error) {
        return unsupported('libraryInitUnsupported', $error::class . ': ' . $error->getMessage());
    }

    $wire = $message['request'] ?? null;
    if (! is_array($wire)) {
        return failure('adapterError', 'the run request carried no request');
    }

    try {
        $request = buildRequest($wire);
    } catch (InvalidArgumentException $error) {
        return unsupported(
            'cannotRepresentCase',
            'the PSR-7 URI type this library validates through cannot hold the target: '
            . $error->getMessage()
        );
    } catch (Throwable $error) {
        return failure('adapterError', $error::class . ': ' . $error->getMessage());
    }

    return validate($validator, $request);
}

/** @return array<string, mixed> */
function validate(RequestValidator $validator, RequestInterface $request): array
{
    $scope = 'the method, target and headers of the PSR-7 request handed to validate()';
    $before = requestSnapshot($request);

    try {
        $address = $validator->validate($request);
    } catch (ValidationFailed $rejection) {
        return [
            'protocol' => PROTOCOL_VERSION,
            'outcome' => 'rejected',
            'deserialized' => unexposed(),
            'inputMutation' => inputMutation($before, requestSnapshot($request), $scope),
            'raw' => ['error' => describeThrowable($rejection)],
        ];
    } catch (Throwable $error) {
        return [
            'protocol' => PROTOCOL_VERSION,
            'outcome' => 'libraryError',
            'detail' => $error::class . ': ' . $error->getMessage(),
            'raw' => describeThrowable($error),
        ];
    }

    return [
        'protocol' => PROTOCOL_VERSION,
        'outcome' => 'accepted',
        'deserialized' => unexposed(),
        'inputMutation' => inputMutation($before, requestSnapshot($request), $scope),
        'raw' => ['matched' => ['path' => $address->path(), 'method' => $address->method()]],
    ];
}

function send(int $status, mixed $body): void
{
    // Substitution rather than a failure to answer: a library's own message can
    // carry bytes that are not valid UTF-8, and losing the whole result to that
    // would report an adapter fault where there is a measurement.
    $encoded = json_encode($body, JSON_INVALID_UTF8_SUBSTITUTE);
    if ($encoded === false) {
        $encoded = '{"error":"could not encode the response"}';
    }
    http_response_code($status);
    header('content-type: application/json');
    header('content-length: ' . (string) strlen($encoded));
    echo $encoded;
}

$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$path = strtok(is_string($requestUri) ? $requestUri : '', '?');
$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET' && $path === '/describe') {
    send(200, [
        'protocol' => PROTOCOL_VERSION,
        'library' => LIBRARY,
        'libraryVersion' => InstalledVersions::getPrettyVersion(LIBRARY),
        'librarySource' => LIBRARY_SOURCE,
        'libraryResolution' => installedResolution(LIBRARY),
        'capabilities' => capabilities(),
        'configuration' => configuration(),
    ]);

    return;
}

if ($method !== 'POST' || $path !== '/run') {
    send(404, ['error' => 'no such endpoint']);

    return;
}

$body = file_get_contents('php://input');
$message = json_decode($body === false ? '' : $body, true);
if (! is_array($message)) {
    send(200, failure('adapterError', 'the run request was not a JSON object'));

    return;
}

if (($message['protocol'] ?? null) !== PROTOCOL_VERSION) {
    send(400, [
        'error' => 'protocol ' . json_encode($message['protocol'] ?? null)
            . ', this container speaks ' . (string) PROTOCOL_VERSION,
    ]);

    return;
}

try {
    send(200, runCase($message));
} catch (Throwable $error) {
    send(200, failure('adapterError', $error::class . ': ' . $error->getMessage()));
}
