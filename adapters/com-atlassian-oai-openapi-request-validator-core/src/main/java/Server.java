import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.model.SimpleRequest;
import com.atlassian.oai.validator.report.ValidationReport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

public final class Server {

  private static final int PROTOCOL_VERSION = 1;
  // The Maven coordinate rather than the bare artifact name, because the bare
  // name collides with an unrelated npm package already in this roster. Two
  // different libraries sharing a name across ecosystems is exactly what a
  // coordinate disambiguates.
  private static final String LIBRARY = "com.atlassian.oai:openapi-request-validator-core";
  // Where this library's source lives. Stated by this container, not resolved:
  // the artifact embeds only its module POM, and the scm is on its parent.
  private static final String LIBRARY_SOURCE =
      "https://bitbucket.org/atlassian/swagger-request-validator";
  private static final ObjectMapper JSON = new ObjectMapper();

  public static void main(String[] args) throws IOException {
    int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/describe", Server::describe);
    server.createContext("/run", Server::run);
    server.setExecutor(null);
    server.start();
  }

  private static void describe(HttpExchange exchange) throws IOException {
    ObjectNode splitting = JSON.createObjectNode();
    splitting.put("cookie", false);
    splitting.put("header", true);
    splitting.put("path", true);
    splitting.put("query", false);

    ObjectNode stages = JSON.createObjectNode();
    stages.put("routing", true);
    stages.set("splitting", splitting);
    stages.put("styleDeserialization", true);
    stages.put("contentDeserialization", false);
    stages.put("schemaValidation", true);
    stages.put("valueExposure", false);

    ObjectNode oasVersions = JSON.createObjectNode();
    oasVersions.put("3.0", true);
    oasVersions.put("3.1", true);
    oasVersions.put("3.2", false);

    ObjectNode capabilities = JSON.createObjectNode();
    capabilities.set("stages", stages);
    capabilities.set("oasVersions", oasVersions);

    ObjectNode configuration = JSON.createObjectNode();
    configuration.put("id", "inline-spec-simple-request");
    configuration.put(
        "description",
        "OpenApiInteractionValidator.createForInlineApiSpecification(document).build(), driven "
            + "through validateRequest with a SimpleRequest built from the raw path. "
            + "Raw query name/value pairs come from the harness preparse with no percent "
            + "decoding: the builder takes a name and values and there is no API accepting a "
            + "query string, so the split into pairs is the caller's and is recorded on every "
            + "cell. Duplicate raw names are grouped into the list shape the builder accepts. "
            + "Values are permanently unexposed: ValidationReport carries hasErrors and "
            + "getMessages and no channel for what was deserialized. "
            + "Known limitation: the request builder has no cookie API, so cookie parameters "
            + "cannot be put to the library through it and those cases are refused here rather "
            + "than answered.");
    configuration.set("options", JSON.createObjectNode());

    ObjectNode body = JSON.createObjectNode();
    body.put("protocol", PROTOCOL_VERSION);
    body.put("library", LIBRARY);
    body.put("libraryVersion", libraryVersion());
    body.put("librarySource", LIBRARY_SOURCE);
    body.set("libraryResolution", libraryResolution());
    body.set("capabilities", capabilities);
    body.set("configuration", configuration);
    send(exchange, 200, body);
  }

  private static String libraryVersion() {
    Package pkg = OpenApiInteractionValidator.class.getPackage();
    String version = pkg == null ? null : pkg.getImplementationVersion();
    if (version != null) return version;
    String path = OpenApiInteractionValidator.class.getProtectionDomain()
        .getCodeSource().getLocation().getPath();
    String file = path.substring(path.lastIndexOf('/') + 1);
    int dash = file.lastIndexOf('-');
    return dash == -1 ? "unknown" : file.substring(dash + 1).replace(".jar", "");
  }

  private static ObjectNode libraryResolution() {
    ObjectNode resolution = JSON.createObjectNode();
    String declared = declaredVersion();
    boolean local = declared != null
        && (declared.contains("file:") || declared.contains("${") || declared.endsWith("-SNAPSHOT"));
    resolution.put("kind", local ? "local" : "registry");
    if (declared == null) resolution.putNull("specifier");
    else resolution.put("specifier", declared);
    return resolution;
  }

  private static String declaredVersion() {
    try {
      String pom = Files.readString(Path.of("/app/pom.xml"), StandardCharsets.UTF_8);
      int artifact = pom.indexOf("<artifactId>openapi-request-validator-core</artifactId>");
      if (artifact == -1) return null;
      int open = pom.indexOf("<version>", artifact);
      int close = pom.indexOf("</version>", open);
      if (open == -1 || close == -1) return null;
      return pom.substring(open + "<version>".length(), close).trim();
    } catch (Exception error) {
      return null;
    }
  }

  private static void run(HttpExchange exchange) throws IOException {
    JsonNode message;
    try {
      message = JSON.readTree(exchange.getRequestBody());
    } catch (Exception error) {
      send(exchange, 200, adapterError("could not read the run request: " + error));
      return;
    }

    if (message.path("protocol").asInt() != PROTOCOL_VERSION) {
      ObjectNode error = JSON.createObjectNode();
      error.put(
          "error",
          "protocol " + message.path("protocol").asInt() + ", this container speaks "
              + PROTOCOL_VERSION);
      send(exchange, 400, error);
      return;
    }

    try {
      send(exchange, 200, runCase(message));
    } catch (Throwable error) {
      send(exchange, 200, adapterError(error.toString()));
    }
  }

  private static ObjectNode runCase(JsonNode message) {
    JsonNode document = message.get("document");

    if (declaresCookieParameter(document)) {
      ObjectNode body = JSON.createObjectNode();
      body.put("protocol", PROTOCOL_VERSION);
      body.put("outcome", "unsupported");
      body.put("reason", "adapterLimitation");
      body.put(
          "detail",
          "the request builder exposes no cookie API, so a cookie parameter cannot be put to "
              + "the library at all; supplying it as a raw header would measure this adapter's "
              + "cookie split rather than the library");
      return body;
    }

    OpenApiInteractionValidator validator;
    try {
      validator = OpenApiInteractionValidator.createForInlineApiSpecification(document.toString())
          .build();
    } catch (Throwable error) {
      ObjectNode body = JSON.createObjectNode();
      body.put("protocol", PROTOCOL_VERSION);
      body.put("outcome", "unsupported");
      body.put("reason", "libraryInitUnsupported");
      body.put("detail", error.toString());
      return body;
    }

    SimpleRequest request = buildRequest(message);
    String scope = "the method, path, query parameters and headers of the SimpleRequest "
        + "handed to validateRequest";
    String before = requestSnapshot(request);

    ValidationReport report;
    try {
      report = validator.validateRequest(request);
    } catch (Throwable error) {
      ObjectNode body = JSON.createObjectNode();
      body.put("protocol", PROTOCOL_VERSION);
      body.put("outcome", "libraryError");
      body.put("detail", error.toString());
      body.putNull("raw");
      return body;
    }

    ObjectNode deserialized = JSON.createObjectNode();
    deserialized.put("kind", "unexposed");
    deserialized.put("reason", "no published call returns the deserialized parameter values");

    ArrayNode messages = JSON.createArrayNode();
    for (ValidationReport.Message entry : report.getMessages()) {
      ObjectNode one = JSON.createObjectNode();
      one.put("key", entry.getKey());
      one.put("level", String.valueOf(entry.getLevel()));
      one.put("message", entry.getMessage());
      messages.add(one);
    }
    ObjectNode raw = JSON.createObjectNode();
    raw.put("hasErrors", report.hasErrors());
    raw.set("messages", messages);

    ObjectNode body = JSON.createObjectNode();
    body.put("protocol", PROTOCOL_VERSION);
    body.put("outcome", report.hasErrors() ? "rejected" : "accepted");
    body.set("deserialized", deserialized);
    body.set("inputMutation", inputMutation(before, requestSnapshot(request), scope));
    body.set("raw", raw);
    return body;
  }

  /**
   * Whether the library wrote back onto the request it was handed.
   *
   * <p>A library that writes deserialized values onto its caller's request object has handed that
   * caller the values with no published call returning them, and nothing else in the protocol can
   * see it. The snapshot covers the parts of the request that carry a case's values, and the
   * detail says so, because a comparison is only as good as its stated scope.
   */
  private static ObjectNode inputMutation(String before, String after, String scope) {
    ObjectNode mutation = JSON.createObjectNode();
    if (before.equals(after)) {
      mutation.put("kind", "none");
      mutation.put("detail", scope + ", unchanged");
      return mutation;
    }
    mutation.put("kind", "observed");
    mutation.put("detail", scope + "; it is now " + after + " where it was " + before);
    return mutation;
  }

  private static String requestSnapshot(SimpleRequest request) {
    StringBuilder built = new StringBuilder();
    built.append(request.getMethod()).append(' ').append(request.getPath());
    for (String name : new TreeSet<>(request.getQueryParameters())) {
      built.append("|q ").append(name).append('=').append(request.getQueryParameterValues(name));
    }
    for (String name : new TreeSet<>(request.getHeaders().keySet())) {
      built.append("|h ").append(name).append('=').append(request.getHeaderValues(name));
    }
    return built.toString();
  }

  private static SimpleRequest buildRequest(JsonNode message) {
    JsonNode wire = message.get("request");
    String target = new String(
        Base64.getDecoder().decode(wire.get("targetBase64").asText()), StandardCharsets.UTF_8);
    int question = target.indexOf('?');
    String path = question == -1 ? target : target.substring(0, question);

    SimpleRequest.Builder builder = new SimpleRequest.Builder(wire.get("method").asText(), path);

    JsonNode query = message.path("preparsed").path("query");
    if (query.isArray()) {
      Map<String, List<String>> queryValues = new LinkedHashMap<>();
      for (JsonNode pair : query) {
        if (pair.isArray() && pair.size() == 2) {
          queryValues.computeIfAbsent(pair.get(0).asText(), _name -> new ArrayList<>())
              .add(pair.get(1).asText());
        }
      }
      for (Map.Entry<String, List<String>> entry : queryValues.entrySet()) {
        builder = builder.withQueryParam(entry.getKey(), entry.getValue());
      }
    }

    for (JsonNode pair : wire.withArray("headers")) {
      builder = builder.withHeader(pair.get(0).asText(), List.of(pair.get(1).asText()));
    }
    return builder.build();
  }

  private static List<String> valuesOf(JsonNode node) {
    List<String> values = new ArrayList<>();
    if (node.isArray()) {
      for (JsonNode item : node) values.add(item.asText());
    } else {
      values.add(node.asText());
    }
    return values;
  }

  private static boolean declaresCookieParameter(JsonNode document) {
    for (JsonNode pathItem : document.path("paths")) {
      for (JsonNode operation : pathItem) {
        for (JsonNode parameter : operation.path("parameters")) {
          if ("cookie".equals(parameter.path("in").asText())) return true;
        }
      }
    }
    return false;
  }

  private static ObjectNode adapterError(String detail) {
    ObjectNode body = JSON.createObjectNode();
    body.put("protocol", PROTOCOL_VERSION);
    body.put("outcome", "adapterError");
    body.put("detail", detail);
    body.putNull("raw");
    return body;
  }

  private static void send(HttpExchange exchange, int status, JsonNode body) throws IOException {
    byte[] encoded = JSON.writeValueAsBytes(body);
    exchange.getResponseHeaders().set("content-type", "application/json");
    exchange.sendResponseHeaders(status, encoded.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(encoded);
    }
  }

  private Server() {}
}
