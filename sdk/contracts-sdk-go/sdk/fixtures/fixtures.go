// Package fixtures embeds test fixtures used by the SDK's test suite:
//
//   - pinned-blocks.json: per-environment pinned block heights for anvil
//     fork tests (so test runs are deterministic across PRs).
//
// Bump pinned-blocks.json quarterly via PR. The lastBumpedAt field tracks
// the most recent bump for sanity at code review time.
//
// Note: this package would naturally be named "testdata", but Go tooling
// excludes any directory called "testdata" from compilation, so we use
// "fixtures" instead.
package fixtures

import (
	"embed"
	"encoding/json"
	"fmt"
)

//go:embed pinned-blocks.json
var fs embed.FS

// PinnedBlocks is the parsed view of pinned-blocks.json.
type PinnedBlocks struct {
	Testnet      uint64 `json:"testnet"`
	Mainnet      uint64 `json:"mainnet"`
	LastBumpedAt string `json:"lastBumpedAt"`
	BumpPolicy   string `json:"bumpPolicy"`
	Notes        string `json:"notes"`
}

// LoadPinnedBlocks parses the embedded pinned-blocks.json.
func LoadPinnedBlocks() (*PinnedBlocks, error) {
	data, err := fs.ReadFile("pinned-blocks.json")
	if err != nil {
		return nil, fmt.Errorf("testdata: read pinned-blocks: %w", err)
	}
	var pb PinnedBlocks
	if err := json.Unmarshal(data, &pb); err != nil {
		return nil, fmt.Errorf("testdata: parse pinned-blocks: %w", err)
	}
	return &pb, nil
}
