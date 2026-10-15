package fixtures

import "testing"

func TestLoadPinnedBlocks(t *testing.T) {
	pb, err := LoadPinnedBlocks()
	if err != nil {
		t.Fatal(err)
	}
	if pb.LastBumpedAt == "" {
		t.Error("LastBumpedAt empty — please record bump date in pinned-blocks.json")
	}
	// Testnet/Mainnet may legitimately be 0 (unset). Just sanity check the
	// JSON parsed without flipping fields around.
	_ = pb.Testnet
	_ = pb.Mainnet
}
