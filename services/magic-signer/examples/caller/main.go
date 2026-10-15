// caller is a minimal example of invoking the magic-signer service
// using the client SDK.
//
// Run:
//   MAGIC_SIGNER_URL=http://localhost:8443 \
//   MAGIC_SIGNER_TOKEN=<raw-token> \
//   go run ./examples/caller
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/crypto"

	magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"
)

func main() {
	url := os.Getenv("MAGIC_SIGNER_URL")
	token := os.Getenv("MAGIC_SIGNER_TOKEN")
	if url == "" || token == "" {
		log.Fatal("MAGIC_SIGNER_URL and MAGIC_SIGNER_TOKEN must be set")
	}

	cli, err := magicclient.New(magicclient.Config{
		BaseURL:   url,
		AuthToken: token,
		Timeout:   10 * time.Second,
	})
	if err != nil {
		log.Fatalf("magicclient.New: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	userID := "demo-user-12345"
	if v := os.Getenv("USER_ID"); v != "" {
		userID = v
	}

	addr, err := cli.WalletAddress(ctx, userID)
	if err != nil {
		log.Fatalf("WalletAddress: %v", err)
	}
	fmt.Printf("user_id=%s magic_address=%s\n", userID, addr.Hex())

	var digest [32]byte
	copy(digest[:], crypto.Keccak256([]byte("hello magic-signer")))
	sig, err := cli.SignDigest(ctx, userID, digest)
	if err != nil {
		log.Fatalf("SignDigest: %v", err)
	}
	fmt.Printf("signature=0x%x\n", sig)

	// Verify the signature recovers to the same address.
	sigBytes := make([]byte, 65)
	copy(sigBytes, sig[:])
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}
	pub, err := crypto.SigToPub(digest[:], sigBytes)
	if err != nil {
		log.Fatalf("SigToPub: %v", err)
	}
	recovered := crypto.PubkeyToAddress(*pub)
	if recovered != addr {
		log.Fatalf("recover mismatch: got %s, want %s", recovered.Hex(), addr.Hex())
	}
	fmt.Println("signature recovers to the same address — round trip OK")
}
