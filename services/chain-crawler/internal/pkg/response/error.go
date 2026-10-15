package response

type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Err     error  `json:"error"`
}

func (e Error) Error() string {
	return e.Err.Error()
}

var (
	ErrInvalidParams  = Error{Code: 422, Message: "Invalid Parameters"}
	ErrBadRequest     = Error{Code: 400, Message: "Bad Request"}
	ErrNotFound       = Error{Code: 404, Message: "Not Found"}
	ErrInternalServer = Error{Code: 500, Message: "Internal Server Error"}
)

func BuildError(respErr Error, err error) error {
	respErr.Err = err
	return respErr
}
