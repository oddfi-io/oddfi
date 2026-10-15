package mongoclient

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

var (
	RequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "mongo",
		Name:      "request_duration",
		Help:      "Request duration",
	}, []string{
		"database",
		"collection",
		"method",
	})
)

type MongoConfig struct {
	URI             string `mapstructure:"uri"`
	Database        string `mapstructure:"database"`
	ConnectTimeout  int    `mapstructure:"connect_timeout"`
	MaxPoolSize     uint64 `mapstructure:"max_pool_size"`
	MinPoolSize     uint64 `mapstructure:"min_pool_size"`
	MaxConnIdleTime int    `mapstructure:"max_conn_idle_time"`
}

type MongoClient struct {
	client   *mongo.Client
	database string
}

func NewMongoClient(cfg MongoConfig) (*MongoClient, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.ConnectTimeout)*time.Second)
	defer cancel()

	opts := options.Client().ApplyURI(cfg.URI)
	if cfg.MaxPoolSize > 0 {
		opts.SetMaxPoolSize(cfg.MaxPoolSize)
	}
	if cfg.MinPoolSize > 0 {
		opts.SetMinPoolSize(cfg.MinPoolSize)
	}
	if cfg.MaxConnIdleTime > 0 {
		opts.SetMaxConnIdleTime(time.Duration(cfg.MaxConnIdleTime) * time.Second)
	}

	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("mongo connect error: %w", err)
	}

	if err = client.Ping(ctx, readpref.Primary()); err != nil {
		return nil, fmt.Errorf("mongo ping error: %w", err)
	}

	return &MongoClient{
		client:   client,
		database: cfg.Database,
	}, nil
}

func (m *MongoClient) Client() *mongo.Client {
	return m.client
}

func (m *MongoClient) Database() *mongo.Database {
	return m.client.Database(m.database)
}

func (m *MongoClient) Collection(name string) *mongo.Collection {
	return m.client.Database(m.database).Collection(name)
}

func (m *MongoClient) Close(ctx context.Context) error {
	return m.client.Disconnect(ctx)
}
