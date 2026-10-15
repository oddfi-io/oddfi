package oddfi

import "math/big"

func requireBigInts(op string, values ...*big.Int) error {
	for _, value := range values {
		if value == nil {
			return wrapUserError(op, ErrNilBigIntParam)
		}
	}
	return nil
}

func requireBigIntSlice(op string, values []*big.Int) error {
	if values == nil {
		return wrapUserError(op, ErrNilBigIntParam)
	}
	for _, value := range values {
		if value == nil {
			return wrapUserError(op, ErrNilBigIntParam)
		}
	}
	return nil
}
