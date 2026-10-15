package service

import (
	"context"

	"github.com/IBM/sarama"
)

type Service interface {
	Start()
	Stop()
	HandleMessage(context.Context, *sarama.ConsumerMessage) error
}
