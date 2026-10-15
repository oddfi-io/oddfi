package oddfi

import (
	"errors"
	"testing"
)

func TestParseAddress(t *testing.T) {
	t.Parallel()

	address, err := ParseAddress("0x52908400098527886E0F7030069857D2E4169EE7")
	if err != nil {
		t.Fatalf("ParseAddress: %v", err)
	}
	if got := address.String(); got != "0x52908400098527886E0F7030069857D2E4169EE7" {
		t.Fatalf("String() = %s", got)
	}
	if _, err := ParseAddress("0x52908400098527886E0F7030069857D2E4169Ee7"); !errors.Is(err, ErrInvalidAddress) {
		t.Fatalf("invalid checksum error = %v", err)
	}
	if _, err := ParseAddress("0xde709f2102306220921060314715629080e2fb77"); err != nil {
		t.Fatalf("lowercase address error = %v", err)
	}
}
