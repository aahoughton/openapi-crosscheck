package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime/debug"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
)

const (
	protocolVersion = 2
	library         = "github.com/getkin/kin-openapi"
	modulePath      = "github.com/getkin/kin-openapi"
	// Where this library's source lives. Stated by this container.
	librarySource = "https://github.com/getkin/kin-openapi"
)

type splitting struct {
	Cookie bool `json:"cookie"`
	Header bool `json:"header"`
	Path   bool `json:"path"`
	Query  bool `json:"query"`
}

type stages struct {
	Routing                bool      `json:"routing"`
	Splitting              splitting `json:"splitting"`
	StyleDeserialization   bool      `json:"styleDeserialization"`
	ContentDeserialization bool      `json:"contentDeserialization"`
	SchemaValidation       bool      `json:"schemaValidation"`
	ValueExposure          bool      `json:"valueExposure"`
}

type capabilities struct {
	Stages stages `json:"stages"`
	// A map rather than a struct: the JSON keys are "3.0", "3.1" and "3.2",
	// which no Go field name can produce.
	OasVersions map[string]bool `json:"oasVersions"`
}

type configuration struct {
	ID          string         `json:"id"`
	Description string         `json:"description"`
	Options     map[string]any `json:"options"`
}

var declaredCapabilities = capabilities{
	Stages: stages{
		Routing:                true,
		Splitting:              splitting{Cookie: true, Header: true, Path: true, Query: true},
		StyleDeserialization:   true,
		ContentDeserialization: true,
		SchemaValidation:       true,
		ValueExposure:          true,
	},
	OasVersions: map[string]bool{"3.0": true, "3.1": true, "3.2": true},
}

var declaredConfiguration = configuration{
	ID: "validate-request-gorillamux",
	Description: "openapi3.NewLoader().LoadFromData(document) routed with gorillamux and " +
		"validated through openapi3filter.ValidateRequest, driven from an http.Request " +
		"built from the raw target. " +
		"Known limitation: Go's net/url parses the target before the library sees it, so " +
		"percent-encoding probes measure that parser as well as the library. The escaped " +
		"path is what reaches the router, so the encoding survives to that point. " +
		"Values are read from a write-back channel: the function that decodes a styled " +
		"parameter is unexported and no published call returns decoded values, and " +
		"ValidateRequest writes values it supplies, such as schema defaults for absent " +
		"query parameters, back onto the http.Request it was handed. This adapter reports " +
		"the declared parameters whose values changed across the call, at vantage " +
		"parsedBeforeValidation. An input the library left unchanged reports no values.",
	Options: map[string]any{},
}

type wireMessage struct {
	Method       string     `json:"method"`
	TargetBase64 string     `json:"targetBase64"`
	Headers      [][]string `json:"headers"`
}

type runRequest struct {
	Protocol int             `json:"protocol"`
	CaseID   string          `json:"caseId"`
	Document json.RawMessage `json:"document"`
	Request  wireMessage     `json:"request"`
}

func libraryVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "unknown"
	}
	for _, dep := range info.Deps {
		if dep.Path == modulePath {
			return strings.TrimPrefix(dep.Version, "v")
		}
	}
	return "unknown"
}

func libraryResolution() map[string]any {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return map[string]any{"kind": "registry", "specifier": nil}
	}
	for _, dep := range info.Deps {
		if dep.Path != modulePath {
			continue
		}
		if dep.Replace != nil {
			return map[string]any{
				"kind":      "local",
				"specifier": dep.Replace.Path + "@" + dep.Replace.Version,
			}
		}
	}
	return map[string]any{"kind": "registry", "specifier": nil}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	encoded, err := json.Marshal(body)
	if err != nil {
		http.Error(w, "encode failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(encoded)
}

func describe(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"protocol":          protocolVersion,
		"library":           library,
		"libraryVersion":    libraryVersion(),
		"librarySource":     librarySource,
		"libraryResolution": libraryResolution(),
		"capabilities":      declaredCapabilities,
		"configuration":     declaredConfiguration,
	})
}

func unexposed() map[string]any {
	return map[string]any{
		"kind":   "unexposed",
		"reason": "no published call returns the deserialized parameter values",
	}
}

func runCase(message runRequest) map[string]any {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(message.Document)
	if err != nil {
		return map[string]any{
			"protocol": protocolVersion,
			"outcome":  "unsupported",
			"reason":   "libraryInitUnsupported",
			"detail":   fmt.Sprintf("load: %v", err),
		}
	}
	if err := doc.Validate(loader.Context); err != nil {
		return map[string]any{
			"protocol": protocolVersion,
			"outcome":  "unsupported",
			"reason":   "libraryInitUnsupported",
			"detail":   fmt.Sprintf("document rejected: %v", err),
		}
	}

	router, err := gorillamux.NewRouter(doc)
	if err != nil {
		return map[string]any{
			"protocol": protocolVersion,
			"outcome":  "unsupported",
			"reason":   "libraryInitUnsupported",
			"detail":   fmt.Sprintf("router: %v", err),
		}
	}

	target, err := base64.StdEncoding.DecodeString(message.Request.TargetBase64)
	if err != nil {
		return adapterError(fmt.Sprintf("target was not base64: %v", err))
	}

	// The target is rebuilt into a URL here, which is where Go's parser gets to
	// see it. That is the boundary named in the configuration description, and it
	// is recorded rather than worked around: working around it would mean this
	// adapter doing the parsing that is under measurement.
	request, err := http.NewRequest(message.Request.Method, "http://harness.invalid"+string(target), nil)
	if err != nil {
		return adapterError(fmt.Sprintf("could not build a request from the target: %v", err))
	}
	for _, pair := range message.Request.Headers {
		if len(pair) == 2 {
			request.Header.Add(pair[0], pair[1])
		}
	}

	route, pathParams, err := router.FindRoute(request)
	if err != nil {
		return map[string]any{
			"protocol":     protocolVersion,
			"outcome":      "rejected",
			"deserialized": unexposed(),
			"inputMutation": map[string]any{
				"kind":   "none",
				"detail": "routing refused the request, so nothing was handed to validation to change",
			},
			"raw": map[string]any{"stage": "routing", "error": err.Error()},
		}
	}

	input := &openapi3filter.RequestValidationInput{
		Request:    request,
		PathParams: pathParams,
		Route:      route,
	}
	const scope = "the method, target, headers and path parameters handed to ValidateRequest"
	declared := declaredParameters(route)
	before := requestSnapshot(request, pathParams)
	beforeValues := parameterValues(request, pathParams, declared)
	validationErr := openapi3filter.ValidateRequest(context.Background(), input)
	mutation := inputMutation(before, requestSnapshot(request, pathParams), scope)
	afterValues := parameterValues(request, pathParams, declared)

	outcome := "accepted"
	raw := map[string]any{"stage": "validation", "pathParams": pathParams, "error": nil}
	if validationErr != nil {
		outcome = "rejected"
		raw["error"] = map[string]any{
			"type":    fmt.Sprintf("%T", validationErr),
			"message": validationErr.Error(),
		}
	}

	return map[string]any{
		"protocol":      protocolVersion,
		"outcome":       outcome,
		"deserialized":  deserializedObservation(declared, beforeValues, afterValues, mutation),
		"inputMutation": mutation,
		"raw":           raw,
	}
}

// A declared parameter's name and location, the position a write-back is read
// from. Cookies are included: the comparison covers every location the library
// could write onto, and a location it never touches simply never differs.
type parameterPosition struct {
	name     string
	location string
}

func declaredParameters(route *routers.Route) []parameterPosition {
	seen := map[parameterPosition]bool{}
	positions := []parameterPosition{}
	add := func(refs openapi3.Parameters) {
		for _, ref := range refs {
			if ref == nil || ref.Value == nil {
				continue
			}
			position := parameterPosition{name: ref.Value.Name, location: ref.Value.In}
			if !seen[position] {
				seen[position] = true
				positions = append(positions, position)
			}
		}
	}
	if route.PathItem != nil {
		add(route.PathItem.Parameters)
	}
	if route.Operation != nil {
		add(route.Operation.Parameters)
	}
	return positions
}

// parameterValues reads the current value at each declared position, so the
// same read before and after the call shows what the library wrote. Query and
// header positions hold every value under the name; path and cookie hold one.
func parameterValues(request *http.Request, pathParams map[string]string, declared []parameterPosition) map[string][]string {
	values := map[string][]string{}
	query := request.URL.Query()
	for _, position := range declared {
		key := position.location + " " + position.name
		switch position.location {
		case "query":
			values[key] = append([]string(nil), query[position.name]...)
		case "header":
			values[key] = append([]string(nil), request.Header.Values(position.name)...)
		case "path":
			if value, ok := pathParams[position.name]; ok {
				values[key] = []string{value}
			}
		case "cookie":
			if cookie, err := request.Cookie(position.name); err == nil {
				values[key] = []string{cookie.Value}
			}
		}
	}
	return values
}

func equalStrings(one, other []string) bool {
	if len(one) != len(other) {
		return false
	}
	for index := range one {
		if one[index] != other[index] {
			return false
		}
	}
	return true
}

// deserializedObservation reports the write-back value channel.
//
// Only positions the library demonstrably wrote are reported; echoing an
// untouched position would report this adapter's own request building as
// library output. An unchanged input reports unexposed, and when the whole
// snapshot was unchanged the reason says the write-back channel carried
// nothing either.
func deserializedObservation(declared []parameterPosition, before, after map[string][]string, mutation map[string]any) map[string]any {
	value := map[string]any{}
	nativeTypes := map[string]any{}
	for _, position := range declared {
		key := position.location + " " + position.name
		if equalStrings(before[key], after[key]) {
			continue
		}
		now := after[key]
		if len(now) == 1 {
			value[position.name] = now[0]
			nativeTypes[position.name] = "string"
		} else {
			value[position.name] = now
			nativeTypes[position.name] = "[]string"
		}
	}
	if len(value) > 0 {
		return map[string]any{
			"kind":        "observed",
			"vantage":     "parsedBeforeValidation",
			"value":       value,
			"nativeTypes": nativeTypes,
		}
	}
	reason := "no published call returns the deserialized parameter values"
	if mutation["kind"] == "none" {
		reason += ", and the library wrote nothing back onto this request"
	}
	return map[string]any{"kind": "unexposed", "reason": reason}
}

// Whether the library wrote back onto the input it was handed.
//
// A library that writes deserialized values onto the request its caller passed
// has handed that caller the values with no published call returning them, and
// nothing else in the protocol can see it. The snapshot covers what carries the
// case's values, and the detail says so, because a comparison is only as good
// as its stated scope.
func requestSnapshot(request *http.Request, pathParams map[string]string) string {
	var built strings.Builder
	built.WriteString(request.Method)
	built.WriteString(" ")
	built.WriteString(request.URL.String())

	names := make([]string, 0, len(request.Header))
	for name := range request.Header {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		built.WriteString("|h ")
		built.WriteString(name)
		built.WriteString("=")
		built.WriteString(strings.Join(request.Header[name], "\x00"))
	}

	keys := make([]string, 0, len(pathParams))
	for key := range pathParams {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		built.WriteString("|p ")
		built.WriteString(key)
		built.WriteString("=")
		built.WriteString(pathParams[key])
	}

	return built.String()
}

func inputMutation(before, after, scope string) map[string]any {
	if before == after {
		return map[string]any{"kind": "none", "detail": scope + ", unchanged"}
	}
	return map[string]any{
		"kind":   "observed",
		"detail": fmt.Sprintf("%s; it is now %q where it was %q", scope, after, before),
	}
}

func adapterError(detail string) map[string]any {
	return map[string]any{
		"protocol": protocolVersion,
		"outcome":  "adapterError",
		"detail":   detail,
		"raw":      nil,
	}
}

// libraryError is the library raising instead of answering. Attributable to it,
// and never folded into rejected: a rejection is a verdict, a raise is the
// absence of one.
func libraryError(detail string) map[string]any {
	return map[string]any{
		"protocol": protocolVersion,
		"outcome":  "libraryError",
		"detail":   detail,
		"raw":      nil,
	}
}

func run(w http.ResponseWriter, r *http.Request) {
	var message runRequest
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		writeJSON(w, http.StatusOK, adapterError(fmt.Sprintf("could not read the run request: %v", err)))
		return
	}
	if message.Protocol != protocolVersion {
		// Refused rather than guessed at. A harness and a container disagreeing
		// about what a field means produce cells that look perfectly fine.
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error": fmt.Sprintf("protocol %d, this container speaks %d", message.Protocol, protocolVersion),
		})
		return
	}
	writeJSON(w, http.StatusOK, answer(message))
}

// answer runs one case, turning a panic out of the library into a libraryError.
//
// Go reports a validation failure by returning an error, so the raise this
// recovers is a panic and nothing else. Without it a panic unwinds past the
// handler, the harness sees a dropped connection, and the cell blames the
// harness for something the library did.
func answer(message runRequest) (result map[string]any) {
	defer func() {
		if raised := recover(); raised != nil {
			result = libraryError(fmt.Sprintf("%v", raised))
		}
	}()
	return runCase(message)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /describe", describe)
	mux.HandleFunc("POST /run", run)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		panic(err)
	}
}
