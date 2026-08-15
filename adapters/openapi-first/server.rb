# frozen_string_literal: true

require "base64"
require "json"
require "rack"
require "stringio"
require "webrick"

require "openapi_first"

PROTOCOL_VERSION = 1
LIBRARY = "openapi_first"
# Where this library's source lives. Stated by this container.
LIBRARY_SOURCE = "https://github.com/ahx/openapi_first"
VANTAGE = "parsedBeforeValidation"

CAPABILITIES = {
  "stages" => {
    "routing" => true,
    "splitting" => { "cookie" => true, "header" => true, "path" => true, "query" => true },
    "styleDeserialization" => true,
    "contentDeserialization" => true,
    "schemaValidation" => true,
    "valueExposure" => true
  },
  "oasVersions" => { "3.0" => true, "3.1" => true, "3.2" => false }
}.freeze

CONFIGURATION = {
  "id" => "validate-request-rack",
  "description" =>
    "OpenapiFirst.parse(document) driven through validate_request with a Rack::Request built " \
    "from the raw target. The path is handed over as PATH_INFO with no decoding of its own, " \
    "and the query string as QUERY_STRING, so the library splits and deserializes both. " \
    "Header names are put into the Rack environment under its own convention, which upcases " \
    "them and joins duplicates with a comma, because that environment is the only request " \
    "shape this library's public call accepts. " \
    "Reading its values: parsed parameters are reported whether or not the request was then " \
    "rejected, so a value cell on a rejected row shows what the library had parsed at the " \
    "point it refused rather than what it accepted.",
  "options" => {}
}.freeze

# How this container was told to install the library.
def installed_resolution(package)
  begin
    text = File.read(File.join(__dir__, "Gemfile"))
  rescue SystemCallError
    return { "kind" => "registry", "specifier" => nil }
  end

  line = text.lines.map(&:strip).find do |candidate|
    candidate.start_with?("gem ") && candidate.include?(package)
  end
  return { "kind" => "registry", "specifier" => nil } if line.nil?

  local_marks = ["path:", "git:", "github:", "branch:"]
  kind = local_marks.any? { |mark| line.include?(mark) } ? "local" : "registry"
  { "kind" => kind, "specifier" => line }
end

def library_version(package)
  Gem.loaded_specs.fetch(package).version.to_s
end

# Name the Ruby type, the way Ruby names it.
def native_type(value)
  case value
  when Array
    inner = value.map { |item| native_type(item) }.uniq.sort
    inner.empty? ? "Array" : "Array[#{inner.join('|')}]"
  when Hash
    inner = value.values.map { |item| native_type(item) }.uniq.sort
    inner.empty? ? "Hash" : "Hash[String,#{inner.join('|')}]"
  else
    value.class.name
  end
end

# Serialize whatever the library returned.
def json_safe(value)
  case value
  when nil, true, false, Numeric, String then value
  when Symbol then value.to_s
  when Array then value.map { |item| json_safe(item) }
  when Hash then value.to_h { |key, item| [key.to_s, json_safe(item)] }
  else { "type" => value.class.name, "inspect" => value.inspect }
  end
end

# Every parameter the document declares, across every path and every operation.
#
# Collected rather than chosen. A case probing routing declares more than one
# path, and which parameter the library populated is the evidence of which one
# it matched, so a container that picked a path first would have answered the
# routing question on the library's behalf and reported an empty cell whenever
# the library disagreed with it. Names are unique within a case, so collecting
# them all cannot make two parameters collide.
def declared_parameters(document)
  paths = document["paths"]
  return [] unless paths.is_a?(Hash)

  paths.values.flat_map do |item|
    next [] unless item.is_a?(Hash)

    [item["get"], item["post"]].flat_map do |operation|
      parameters = operation.is_a?(Hash) ? operation["parameters"] : nil
      parameters.is_a?(Array) ? parameters : []
    end
  end
end

# The Rack environment name for a header, which is the only spelling the request
# shape this library accepts has for one.
def rack_header_key(name)
  upper = name.upcase.tr("-", "_")
  return upper if %w[CONTENT_TYPE CONTENT_LENGTH].include?(upper)

  "HTTP_#{upper}"
end

def build_request(message)
  wire = message.fetch("request")
  target = Base64.strict_decode64(wire.fetch("targetBase64"))
  path, _separator, query = target.partition("?")

  env = {
    "REQUEST_METHOD" => wire.fetch("method"),
    "PATH_INFO" => path,
    "QUERY_STRING" => query,
    "SCRIPT_NAME" => "",
    "SERVER_NAME" => "harness.invalid",
    "SERVER_PORT" => "80",
    "rack.url_scheme" => "http",
    "rack.input" => StringIO.new("")
  }

  (wire["headers"] || []).each do |pair|
    next unless pair.is_a?(Array) && pair.length == 2

    key = rack_header_key(pair[0].to_s)
    existing = env[key]
    env[key] = existing.nil? ? pair[1].to_s : "#{existing}, #{pair[1]}"
  end

  Rack::Request.new(env)
end

# What the library parsed, keyed by the parameter names the case declares and
# read from the location each was declared in.
def observed_values(document, validated)
  by_location = {
    "path" => validated.parsed_path_parameters,
    "query" => validated.parsed_query,
    "header" => validated.parsed_headers,
    "cookie" => validated.parsed_cookies
  }

  values = {}
  types = {}
  declared_parameters(document).each do |parameter|
    name = parameter["name"]
    location = parameter["in"]
    next unless name.is_a?(String) && location.is_a?(String)

    bucket = by_location[location]
    next unless bucket.is_a?(Hash) && bucket.key?(name)

    values[name] = json_safe(bucket[name])
    types[name] = native_type(bucket[name])
  end

  { "kind" => "observed", "vantage" => VANTAGE, "value" => values, "nativeTypes" => types }
end

def not_reached(reason)
  { "kind" => "notReached", "reason" => reason }
end

def unsupported(reason, detail)
  { "protocol" => PROTOCOL_VERSION, "outcome" => "unsupported", "reason" => reason,
    "detail" => detail }
end

def failure(outcome, detail, raw)
  { "protocol" => PROTOCOL_VERSION, "outcome" => outcome, "detail" => detail, "raw" => raw }
end

# Whether the library wrote back onto the Rack environment it was handed.
#
# A library that writes deserialized values into its caller's environment has
# handed that caller the values with no published call returning them, and
# nothing else in the protocol can see it. Rack middleware conventionally does
# exactly this, so the question is a live one here rather than theoretical.
#
# The input stream is left out of the snapshot: it is an IO whose position moves
# when anything reads it, and a read is not a write-back.
def env_snapshot(env)
  Marshal.dump(env.reject { |key, _| key == "rack.input" }.sort.to_h)
end

def input_mutation(before, after, scope)
  return { "kind" => "none", "detail" => "#{scope}, unchanged" } if before == after

  { "kind" => "observed",
    "detail" => "#{scope}; the environment differs after the call" }
end

def run_case(message)
  document = message.fetch("document")

  begin
    definition = OpenapiFirst.parse(document)
  rescue StandardError => e
    return unsupported("libraryInitUnsupported", "#{e.class}: #{e.message}")
  end

  request = build_request(message)
  scope = "the Rack environment handed to validate_request"
  before = env_snapshot(request.env)

  begin
    validated = definition.validate_request(request)
  rescue StandardError => e
    return failure("libraryError", "#{e.class}: #{e.message}", { "type" => e.class.name })
  end
  mutation = input_mutation(before, env_snapshot(request.env), scope)

  deserialized = begin
    observed_values(document, validated)
  rescue StandardError
    not_reached("no operation matched, so no parameters were parsed")
  end

  error = validated.error
  {
    "protocol" => PROTOCOL_VERSION,
    "outcome" => error.nil? ? "accepted" : "rejected",
    "deserialized" => deserialized,
    "inputMutation" => mutation,
    "raw" => {
      "valid" => validated.valid?,
      "error" => error.nil? ? nil : { "type" => error.type.to_s, "message" => error.message }
    }
  }
end

def describe
  {
    "protocol" => PROTOCOL_VERSION,
    "library" => LIBRARY,
    "libraryVersion" => library_version(LIBRARY),
    "librarySource" => LIBRARY_SOURCE,
    "libraryResolution" => installed_resolution(LIBRARY),
    "capabilities" => CAPABILITIES,
    "configuration" => CONFIGURATION
  }
end

def answer(body)
  message = JSON.parse(body)
  unless message.is_a?(Hash)
    return [200, failure("adapterError", "the run request was not a JSON object", nil)]
  end

  if message["protocol"] != PROTOCOL_VERSION
    return [400, { "error" => "protocol #{message['protocol']}, " \
                              "this container speaks #{PROTOCOL_VERSION}" }]
  end

  [200, run_case(message)]
rescue StandardError => e
  [200, failure("adapterError", "#{e.class}: #{e.message}", nil)]
end

def respond(response, status, body)
  encoded = JSON.generate(body)
  response.status = status
  response["content-type"] = "application/json"
  response.body = encoded
end

server = WEBrick::HTTPServer.new(
  Port: Integer(ENV.fetch("PORT", "8080")),
  BindAddress: "0.0.0.0",
  Logger: WEBrick::Log.new(File::NULL),
  AccessLog: []
)

server.mount_proc("/describe") do |request, response|
  if request.request_method == "GET"
    respond(response, 200, describe)
  else
    respond(response, 404, { "error" => "no such endpoint" })
  end
end

server.mount_proc("/run") do |request, response|
  if request.request_method == "POST"
    status, body = answer(request.body.to_s)
    respond(response, status, body)
  else
    respond(response, 404, { "error" => "no such endpoint" })
  end
end

trap("INT") { server.shutdown }
trap("TERM") { server.shutdown }
server.start
