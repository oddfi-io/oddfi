package internal

type HandleResult int

const (
	HandleResultOK HandleResult = iota
	HandleResultRetry
	HandleResultFatal
)
