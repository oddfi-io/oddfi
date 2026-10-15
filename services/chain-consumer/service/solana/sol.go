package solana

type SolBlockMsg struct {
	BlockTime   string `json:"BlockTime"`
	Blockhash   string `json:"Blockhash"`
	BlockHeight int64  `json:"BlockHeight"`
}
