package snowflake

import (
	"sync"

	"github.com/bwmarrin/snowflake"
)

var (
	node *snowflake.Node
	once sync.Once
)

func Init(nodeID int64) {
	var err error
	once.Do(func() {
		node, err = snowflake.NewNode(nodeID)
	})
	if err != nil {
		panic(err)
	}
}

func GenerateID() uint64 {
	return uint64(node.Generate().Int64())
}

func GenerateIDString() string {
	return node.Generate().String()
}
