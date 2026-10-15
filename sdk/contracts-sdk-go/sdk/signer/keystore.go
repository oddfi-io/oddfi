package signer

import (
	"errors"
	"fmt"
	"os"

	"github.com/ethereum/go-ethereum/accounts/keystore"
	"github.com/ethereum/go-ethereum/crypto"
)

// NewFromKeystoreFile decrypts a v3 keystore JSON at path with the given
// password and returns a Signer. The plaintext private key never touches
// disk; raw bytes from the file are released to the GC immediately.
//
// Note: keystore + same-Pod password is *not* a meaningful security
// improvement over a plain raw-key secret. Prefer NewFromSecretFile for
// container deployments unless your password lives in a different
// security domain (e.g. external secret manager / HSM unwrapping).
func NewFromKeystoreFile(path, password string) (Signer, error) {
	if path == "" {
		return nil, errors.New("signer: NewFromKeystoreFile: empty path")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("signer: read keystore %q: %w", path, err)
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("signer: keystore %q empty: %w", path, ErrEmptyKeyMaterial)
	}
	key, err := keystore.DecryptKey(raw, password)
	if err != nil {
		return nil, fmt.Errorf("signer: decrypt keystore %q: %w", path, err)
	}
	if key == nil || key.PrivateKey == nil {
		return nil, fmt.Errorf("signer: keystore %q yielded nil key", path)
	}
	return &localSigner{
		key:  key.PrivateKey,
		addr: crypto.PubkeyToAddress(key.PrivateKey.PublicKey),
	}, nil
}
