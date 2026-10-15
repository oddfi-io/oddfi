// Package signer abstracts transaction signing for the SDK.
//
// Phase 1 implementations: NewFromHex, NewFromSecretFile, NewFromKeystoreFile,
// and NewAuto (env→file fallback with mainnet-safety guards).
//
// Phase 2 (sub-package signer/awskms): KMS-backed signing for production.
package signer
