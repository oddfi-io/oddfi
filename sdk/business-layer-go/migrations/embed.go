// Package migrations embeds the .sql files so the library can run them at New
// time without depending on a filesystem path.
package migrations

import "embed"

// FS is the embedded filesystem of golang-migrate-compatible .sql files.
//
//go:embed *.sql
var FS embed.FS
