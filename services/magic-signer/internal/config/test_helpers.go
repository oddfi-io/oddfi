package config

// NewAuthTableForTest constructs an AuthTable from a pre-computed
// sha256-hex-keyed map. Intended for tests in other packages that need to
// build a table without going through env-var loading.
//
// The key in entries must be the lowercase hex SHA-256 of the raw token.
func NewAuthTableForTest(entries map[string]CallerInfo) AuthTable {
	dup := make(map[string]CallerInfo, len(entries))
	for k, v := range entries {
		dup[k] = v
	}
	return AuthTable{entries: dup}
}
