账户注册时候
1.创建账户时候，子账户充值地址需要从子账户表里获取，并修改deposit_address子地址状态
2.更新 user_balance表，增加user_id
3.更新 user_deposit_address ，增加user_id 对应的各链（evm/tron）充值地址
4.更新 user 表，增加user_id,password_hash
5.更新 user_login_log表，增加user_id
2.生成账户侧在生成账户后写入 user_deposit_address表(记录用户对应各链的充值地址)，
3.把子充值地址写入 redis 的 ZSet，写入时间是score, 再写入Set

4.每次扫链获取到地址然后把所有to地址查 写入的Set

注意：user_id 过滤掉生成0值

// 编译docker
docker build -t chain-consumer:dev -f Dockerfile .

//
docker tag  chain-consumer:dev knightjohn257/chain-consumer:dev

// 
docker push knightjohn257/chain-consumer:dev


// 拉取
docker pull knightjohn257/chain-consumer:dev

// stop
docker stop chain-consumer

// run
docker run -d \
  --name chain-consumer \
  --hostname chain-consumer \
  --restart unless-stopped \
  --log-opt max-size=500m \
  --log-opt max-file=3 \
  --network host \
  -e ENV=prod \
  knightjohn257/chain-consumer:dev
