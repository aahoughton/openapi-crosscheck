package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime/debug"
	"sort"
	"strings"

	"github.com/pb33f/libopenapi"
	validator "github.com/pb33f/libopenapi-validator"
)

const (
	protocolVersion = 2
	library         = "github.com/pb33f/libopenapi-validator"
	modulePath      = "github.com/pb33f/libopenapi-validator"
	// Where this library's source lives. Stated by this container.
	librarySource = "https://github.com/pb33f/libopenapi-validator"
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
		ValueExposure:          false,
	},
	OasVersions: map[string]bool{"3.0": true, "3.1": true, "3.2": false},
}

var declaredConfiguration = configuration{
	ID: "validate-http-request",
	Description: "libopenapi.NewDocument(document) handed to validator.NewValidator and driven " +
		"through ValidateHttpRequest, from an http.Request built on the raw target. " +
		"Routing is the library's: an unmatched path comes back as a validation error of " +
		"type path rather than as a separate call. " +
		"Known limitation: Go's net/url parses the target before the library sees it, so " +
		"percent-encoding probes measure that parser as well as the library. The escaped " +
		"path is what reaches the validator, so the encoding survives to that point. " +
		"Values are unexposed: ValidateHttpRequest answers with a boolean and a list of " +
		"validation errors, and the helpers that decode a styled parameter are internal " +
		"packages, so no published call hands the deserialized values back.",
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

func unsupported(detail string) map[string]any {
	return map[string]any{
		"protocol": protocolVersion,
		"outcome":  "unsupported",
		"reason":   "libraryInitUnsupported",
		"detail":   detail,
	}
}

func runCase(message runRequest) map[string]any {
	document, err := libopenapi.NewDocument(message.Document)
	if err != nil {
		return unsupported(fmt.Sprintf("load: %v", err))
	}

	requestValidator, buildErrors := validator.NewValidator(document)
	if len(buildErrors) > 0 {
		return unsupported(fmt.Sprintf("validator: %v", buildErrors))
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

	const scope = "the method, target and headers of the http.Request handed to ValidateHttpRequest"
	before := requestSnapshot(request, nil)
	valid, validationErrors := requestValidator.ValidateHttpRequest(request)
	mutation := inputMutation(before, requestSnapshot(request, nil), scope)

	reported := make([]map[string]any, 0, len(validationErrors))
	for _, validationError := range validationErrors {
		if validationError == nil {
			continue
		}
		reported = append(reported, map[string]any{
			"validationType":    validationError.ValidationType,
			"validationSubType": validationError.ValidationSubType,
			"message":           validationError.Message,
			"reason":            validationError.Reason,
		})
	}

	outcome := "accepted"
	if !valid {
		outcome = "rejected"
	}

	return map[string]any{
		"protocol":      protocolVersion,
		"outcome":       outcome,
		"deserialized":  unexposed(),
		"inputMutation": mutation,
		"raw":           map[string]any{"valid": valid, "errors": reported},
	}
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
