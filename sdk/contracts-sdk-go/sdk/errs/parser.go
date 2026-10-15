package errs

import (
	"bytes"
	"fmt"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

// abiParser implements ErrorParser against a parsed go-ethereum ABI.
type abiParser struct {
	parsed abi.ABI
}

// NewABIParser wraps a go-ethereum *abi.ABI as an ErrorParser. The typical
// caller looks like:
//
//	parsed, _ := bettingpool.BettingPoolMetaData.GetAbi()
//	parser := errs.NewABIParser(*parsed)
//	err = errs.Wrap(rawErr, "LockBet", parser)
//
// nil-safe in the sense that NewABIParser(abi.ABI{}) just never matches.
func NewABIParser(parsed abi.ABI) ErrorParser {
	return &abiParser{parsed: parsed}
}

// ParseError implements ErrorParser.
func (p *abiParser) ParseError(data []byte) (string, map[string]interface{}, bool) {
	if len(data) < 4 {
		return "", nil, false
	}
	selector := data[:4]
	for name, e := range p.parsed.Errors {
		id := e.ID
		if !bytes.Equal(id[:4], selector) {
			continue
		}
		values, err := e.Inputs.Unpack(data[4:])
		if err != nil {
			// Selector matched but tail malformed: still return the name,
			// callers see a typed name with empty args + Raw they can debug.
			return name, nil, true
		}
		out := make(map[string]interface{}, len(e.Inputs))
		for i, in := range e.Inputs {
			key := in.Name
			if key == "" {
				key = fmt.Sprintf("arg%d", i)
			}
			out[key] = values[i]
		}
		return name, out, true
	}
	return "", nil, false
}
