package redis

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/gomodule/redigo/redis"
	"github.com/samber/lo"
	"github.com/spf13/cast"
	"github.com/stretchr/testify/assert"
)

var pool = &redis.Pool{
	Dial: func() (redis.Conn, error) {
		c, err := redis.Dial("tcp", "127.0.0.1:6379")
		if err != nil {
			return nil, err
		}
		return c, err
	},
}

func TestRedisProxy_HSet_HGet_Ex(t *testing.T) {
	type fields struct {
		redisPool *redis.Pool
	}
	type args struct {
		ctx        context.Context
		key        string
		fields     map[string]interface{}
		expireTime time.Duration
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr assert.ErrorAssertionFunc
	}{
		// TODO: Add test cases.
		{
			name: "test_1",
			fields: fields{
				redisPool: pool,
			},
			args: args{
				ctx:        context.Background(),
				key:        "key",
				fields:     map[string]interface{}{"key1": "value11", "key2": "value22", "key3": 11},
				expireTime: 10 * time.Second,
			},
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewRedisProxy(tt.fields.redisPool)
			tt.wantErr(t, r.HSetEx(tt.args.ctx, tt.args.key, tt.args.fields, tt.args.expireTime))

			for k, v := range tt.args.fields {
				value, err := r.HGet(tt.args.ctx, tt.args.key, k, nil)
				assert.NoError(t, err)
				assert.Equal(t, cast.ToString(v), string(value))
				hlen, err := r.HLen(tt.args.ctx, tt.args.key)
				fmt.Println("hlen", hlen)
			}
		})
	}

	v, err := NewRedisProxy(pool).HGet(context.Background(), "1__key", "key1", nil)
	assert.NoError(t, err)
	assert.Equal(t, "value11", string(v))

	v, err = NewRedisProxy(pool).HGet(context.Background(), fmt.Sprintf("fuckkkkk_%d", time.Now().Unix()), "key1", nil)
	assert.NoError(t, err)
	assert.Equal(t, "value11", string(v))
}

func TestRedisProxy_SAdd(t *testing.T) {
	type fields struct {
		redisPool *redis.Pool
	}
	type args struct {
		ctx        context.Context
		key        string
		value      []string
		expireTime time.Duration
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr assert.ErrorAssertionFunc
	}{
		// TODO: Add test cases.
		{
			name: "test_1",
			fields: fields{
				redisPool: pool,
			},
			args: args{
				ctx:        context.Background(),
				key:        "test_set_key_1",
				value:      []string{"key1", "key2", "key3"},
				expireTime: 10 * time.Second,
			},
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &RedisProxy{
				redisPool: tt.fields.redisPool,
			}
			tt.wantErr(t, r.SAdd(tt.args.ctx, tt.args.key, tt.args.value, tt.args.expireTime))
			v := make(map[string]string)
			for _, i := range tt.args.value {
				v[i] = i
			}

			count, err := r.SCard(tt.args.ctx, tt.args.key)
			fmt.Println(count, err)
			for range tt.args.value {
				value, err := r.SPop(tt.args.ctx, tt.args.key, 1, nil)
				assert.NoError(t, err)
				_, ok := v[string(value[0])]
				assert.Equal(t, true, ok)

				delete(v, string(value[0]))
			}

			assert.Equal(t, 0, len(v))

			x, err := r.SPop(tt.args.ctx, tt.args.key, 1, nil)
			assert.NoError(t, err)
			assert.Equal(t, []byte(nil), x)
		})
	}
}

func TestRedisProxy_ZAdd(t *testing.T) {
	type fields struct {
		redisPool *redis.Pool
	}
	type args struct {
		ctx        context.Context
		key        string
		value      map[int]string
		expireTime time.Duration
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr assert.ErrorAssertionFunc
	}{
		// TODO: Add test cases.
		{
			name: "test_1",
			fields: fields{
				redisPool: pool,
			},
			args: args{
				ctx:        context.Background(),
				key:        "test_zset_key_1",
				value:      map[int]string{1: "key1", 2: "key2", 3: "key3"},
				expireTime: 10 * time.Second,
			},
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &RedisProxy{
				redisPool: tt.fields.redisPool,
			}
			tt.wantErr(t, r.ZAdd(tt.args.ctx, tt.args.key, tt.args.value, tt.args.expireTime))

			v, err := r.ZRangeByScore(tt.args.ctx, tt.args.key, 1, 3, true, nil)
			assert.NoError(t, err)
			assert.Equal(t, []string{"key1", "1", "key2", "2", "key3", "3"}, v)
		})
	}
}

func TestRedisProxy_Pipeline(t *testing.T) {
	type fields struct {
		redisPool *redis.Pool
	}
	type args struct {
		ctx  context.Context
		cmds []PipeLineCmd
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr assert.ErrorAssertionFunc
	}{
		// TODO: Add test cases.
		{
			name: "test_1",
			fields: fields{
				redisPool: pool,
			},
			args: args{
				ctx: context.Background(),
				cmds: []PipeLineCmd{
					{Cmd: Set, Args: []interface{}{"key1", "value1"}, ExpireTime: 2 * time.Second, reply: nil},
					{Cmd: HSet, Args: []interface{}{"pipe_line_hset_test_key", "key2", "value2"}, ExpireTime: 10 * time.Second, reply: nil},
					{Cmd: HGet, Args: []interface{}{"pipe_line_hset_test_key", "key2"}, reply: nil},
					{Cmd: SAdd, Args: []interface{}{"pipe_line_sadd_test_key", "key2", "value2"}, ExpireTime: 10 * time.Second, reply: nil},
					{Cmd: SPop, Args: []interface{}{"pipe_line_sadd_test_key"}, reply: nil},
					{Cmd: ZAdd, Args: []interface{}{"pipe_line_zadd_test_key", 1, "value1", 2, "value2", 3, "value3"}, ExpireTime: time.Second * 10, reply: nil},
					{Cmd: ZRemRangeByScore, Args: []interface{}{"pipe_line_zadd_test_key", 2, 2}, reply: nil},
				},
			},
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &RedisProxy{
				redisPool: tt.fields.redisPool,
			}
			_, err := r.Pipeline(tt.args.ctx, tt.args.cmds)
			tt.wantErr(t, err, fmt.Sprintf("Pipeline(%v, %v)", tt.args.ctx, tt.args.cmds))
		})
	}
}

func TestRedisProxy_Eval(t *testing.T) {
	type fields struct {
		redisPool *redis.Pool
	}
	type args struct {
		ctx        context.Context
		script     string
		keys       []interface{}
		scriptArgs []interface{}
		receiver   func(interface{}) (string, error)
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr assert.ErrorAssertionFunc
	}{
		// TODO: Add test cases.
		{
			name: "test_1",
			fields: fields{
				redisPool: pool,
			},
			args: args{
				ctx: context.Background(),
				// script: `return redis.call('GET',KEYS[1])`,
				script:     `local key = KEYS[1]; local minScore = ARGV[1]; local maxScore = ARGV[2]; local removed = redis.call('ZADD', key, minScore, maxScore); local f = redis.call('EXPIRE', key, 10); return removed`,
				keys:       []interface{}{"script_zadd_key"},
				scriptArgs: []interface{}{1, "1"},
				// scriptArgs: []interface{}{},
				receiver: func(i interface{}) (string, error) {
					return i.(string), nil
				},
			},
			wantErr: assert.NoError,
		},
		//{
		//	name: "test_latest_candlestick",
		//	fields: fields{
		//		redisPool: pool,
		//	},
		//	args: args{
		//		ctx:        context.Background(),
		//		script:     "",
		//		keys:       []interface{}{"script_zadd_key"},
		//		scriptArgs: []interface{}{"key", 12, `[11,1721391744,1721391744,"{\"10\":[1,2,3,4,5,1721391744,1721391744]}"]`},
		//		receiver:   nil,
		//	},
		//},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &RedisProxy{
				redisPool: tt.fields.redisPool,
			}
			tt.wantErr(t, r.Eval(tt.args.ctx, tt.args.script, tt.args.keys, tt.args.scriptArgs, tt.args.receiver))

			cmds := []PipeLineCmd{}
			for _, key := range tt.args.keys {
				cmds = append(cmds, PipeLineCmd{Cmd: Expire, Args: []interface{}{key, 10}, reply: nil})
			}
			r.Pipeline(context.Background(), cmds)
		})
	}
}

func TestRedisProxy_HKeys(t *testing.T) {

	key := fmt.Sprintf("TestRedisProxy_HKeys_%d", time.Now().Unix())
	NewRedisProxy(pool).HSetEx(context.Background(), key, map[string]interface{}{"key1": "value1", "key2": "value2", "key3": "value3"}, 10*time.Second)
	type fields struct {
		redisPool *redis.Pool
	}
	type args struct {
		ctx context.Context
		key string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    []string
		wantErr assert.ErrorAssertionFunc
	}{
		// TODO: Add test cases.
		{
			name: "test_1",
			fields: fields{
				redisPool: pool,
			},
			args: args{
				ctx: context.Background(),
				key: key,
			},
			want:    []string{"key1", "key2", "key3"},
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &RedisProxy{
				redisPool: tt.fields.redisPool,
			}
			got, err := r.HKeys(tt.args.ctx, tt.args.key)
			if !tt.wantErr(t, err, fmt.Sprintf("HKeys(%v, %v)", tt.args.ctx, tt.args.key)) {
				return
			}
			assert.Equalf(t, tt.want, got, "HKeys(%v, %v)", tt.args.ctx, tt.args.key)
		})
	}
}

func TestRedisProxy_HDel(t *testing.T) {
	proxy := NewRedisProxy(pool)

	values := make(map[string]interface{}, 0)
	for i := 0; i < 1000; i++ {
		values[fmt.Sprintf("key_%d", i)] = fmt.Sprintf("value_%d", i)
	}
	key := cast.ToString(time.Now().Unix())
	err := proxy.HSetEx(context.Background(), key, values, 0)
	if err != nil {
		t.Error(err)
	}

	cursor, results, err := proxy.HScan(context.Background(), key+key, 0)
	cursor, results, err = proxy.HScan(context.Background(), key, 0)
	for cursor > 0 {
		hashKeys := lo.Keys(results)
		count, err := proxy.HDel(context.Background(), key, hashKeys...)
		if err != nil {
			t.Error(err)
		}
		fmt.Println("cursor: ", cursor, " count: ", count)
		cursor, results, err = proxy.HScan(context.Background(), key, cursor)
	}

}
