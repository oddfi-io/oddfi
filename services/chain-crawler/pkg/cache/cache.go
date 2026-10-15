package cache

import (
	"github.com/gomodule/redigo/redis"
	jsoniter "github.com/json-iterator/go"
)

type Cache struct {
	pool *redis.Pool
	db   int
}

func NewCache(pool *redis.Pool, db int) *Cache {
	return &Cache{pool, db}
}

// set
func (c Cache) Set(name string, v interface{}) error {
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return err
	}
	s, _ := jsoniter.Marshal(v) // 序列化
	_, err = conn.Do("SET", name, string(s))
	return err
}

// get
func (c Cache) Get(name string, v interface{}) error {
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return err
	}
	temp, _ := redis.Bytes(conn.Do("Get", name))
	return jsoniter.Unmarshal(temp, &v) // 反序列化
}

// 判断所在的 key 是否存在
func (c Cache) Exist(name string) (bool, error) {
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return false, err
	}
	v, err := redis.Bool(conn.Do("EXISTS", name))
	return v, err
}

// 自增
func (c Cache) StringIncr(name string) (int, error) {
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return 0, err
	}
	v, err := redis.Int(conn.Do("INCR", name))
	return v, err
}

// 设置过期时间 （单位 秒）
func (c Cache) Expire(name string, newSecondsLifeTime int64) error {
	// 设置key 的过期时间
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return err
	}
	_, err = conn.Do("EXPIRE", name, newSecondsLifeTime)
	return err
}

// 删除指定的键
func (c Cache) Delete(keys ...interface{}) (bool, error) {
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return false, err
	}
	v, err := redis.Bool(conn.Do("DEL", keys...))
	return v, err
}

// 查看指定的长度
func (c Cache) StrLen(name string) (int, error) {
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return 0, err
	}
	v, err := redis.Int(conn.Do("STRLEN", name))
	return v, err
}

func (c Cache) SetEx(name string, v interface{}, expire int64) error {
	conn := c.pool.Get()
	defer conn.Close()
	_, err := conn.Do("SELECT", c.db)
	if err != nil {
		return err
	}
	s, _ := jsoniter.Marshal(v) // 序列化
	_, err = conn.Do("SETEX", name, expire, string(s))
	return err
}
